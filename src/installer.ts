import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  note,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";
import { spawn } from "node:child_process";
import { parse } from "jsonc-parser";
import pc from "picocolors";
import { setTimeout as delay } from "node:timers/promises";
import {
  BACKGROUND_CUSTOM,
  settings,
  type SettingDefinition,
  type SettingValue,
} from "./settings.js";
import {
  canInstallFont,
  installFont,
  installNerdFont,
  isFontInstalled,
  NERD_FONT_FAMILY,
} from "./fonts.js";
import {
  addTerminalIconsToPowerShellProfile,
  installTerminalIconsModule,
} from "./icons.js";
import { buildSummarySections, normalizeHex } from "./summary.js";
import {
  findSettingsPath,
  InvalidSettingsFileError,
  readSettingsFile,
  setSetting,
  writeSettingsFile,
} from "./wtsettings.js";

const BANNER = `
   ██████╗ ██╗███╗   ███╗██████╗ ████████╗
   ██╔══██╗██║████╗ ████║██╔══██╗╚══██╔══╝
   ██████╔╝██║██╔████╔██║██████╔╝   ██║
   ██╔═══╝ ██║██║╚██╔╝██║██╔═══╝    ██║
   ██║     ██║██║ ╚═╝ ██║██║        ██║
   ╚═╝     ╚═╝╚═╝     ╚═╝╚═╝        ╚═╝
`;

function bail<T>(value: T): Exclude<T, symbol> {
  if (isCancel(value)) {
    cancel("Setup cancelled. Nothing was changed.");
    process.exit(0);
  }
  return value as Exclude<T, symbol>;
}

async function askSetting(setting: SettingDefinition): Promise<SettingValue> {
  const prompt = setting.prompt;

  if (prompt.kind === "select") {
    const selectValue = async () =>
      bail(
        await select<string>({
          message: prompt.message,
          options: prompt.options,
          initialValue: prompt.initialValue,
        }),
      );

    if (setting.id === "fontFace") {
      while (true) {
        const fontFamily = await selectValue();
        if (fontFamily === "keep" || isFontInstalled(fontFamily)) {
          return fontFamily;
        }

        if (!canInstallFont(fontFamily)) {
          log.warn(
            pc.yellow(
              `${fontFamily} is not installed and cannot be installed automatically. Choose another font.`,
            ),
          );
          continue;
        }

        const shouldInstall = bail(
          await confirm({
            message: `${fontFamily} is not installed. Install it now? Select No to choose another font.`,
            initialValue: true,
          }),
        );
        if (!shouldInstall) continue;

        const fontSpinner = spinner();
        fontSpinner.start(`Installing ${fontFamily}…`);
        try {
          await installFont(fontFamily);
        } catch (error) {
          fontSpinner.error(`Could not install ${fontFamily}.`);
          throw error;
        }
        fontSpinner.stop(
          `${fontFamily} installed. Restart Windows Terminal to use it.`,
        );
        return fontFamily;
      }
    }

    const value = await selectValue();

    // Hintergrundfarbe: bei "Custom" folgt eine Hex-Eingabe mit Validierung.
    if (setting.id === "background" && value === BACKGROUND_CUSTOM) {
      const custom = bail(
        await text({
          message: "Enter a background color",
          placeholder: "#1E1E2E",
          initialValue: "",
          validate: (input) => {
            const raw = input ?? "";
            return /^#?[0-9a-fA-F]{6}$/.test(raw.trim())
              ? undefined
              : "Use a 6-digit hex color, e.g. #1E1E2E";
          },
        }),
      );
      return normalizeHex(custom);
    }

    return value;
  }

  if (prompt.kind === "text") {
    return bail(
      await text({
        message: prompt.message,
        placeholder: prompt.placeholder,
        initialValue: prompt.initialValue,
        ...(prompt.validate ? { validate: prompt.validate } : {}),
      }),
    );
  }

  return bail(
    await confirm({
      message: prompt.message,
      initialValue: prompt.initialValue,
    }),
  );
}

function renderSummary(answers: Record<string, SettingValue>): void {
  const sections = buildSummarySections(answers);

  if (sections.length === 0) {
    note("No settings selected.", "Configuration summary");
    return;
  }

  const labelWidth = Math.max(
    ...sections.flatMap((section) =>
      section.rows.map(([label]) => label.length),
    ),
  );

  const lines: string[] = [];

  sections.forEach((section, index) => {
    if (index > 0) lines.push("");
    lines.push(pc.bold(pc.cyan(section.group)));

    for (const [label, value] of section.rows) {
      lines.push(`  ${pc.dim(label.padEnd(labelWidth))}  ${value}`);
    }
  });

  note(lines.join("\n"), "Your configuration");
}

function openNewTerminalTab(): boolean {
  if (!process.env.WT_SESSION) return false;

  try {
    const terminal = spawn("wt.exe", ["-w", "0", "new-tab"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    terminal.on("error", (error) => {
      log.warn(
        pc.yellow(`Could not open a new Windows Terminal tab: ${error.message}`),
      );
    });
    terminal.unref();
    return true;
  } catch (error) {
    log.warn(
      pc.yellow(`Could not open a new Windows Terminal tab: ${String(error)}`),
    );
    return false;
  }
}

function getDefaultProfileIndex(content: string): number | undefined {
  const parsed = parse(content) as {
    defaultProfile?: unknown;
    profiles?: { list?: unknown };
  };
  if (
    typeof parsed.defaultProfile !== "string" ||
    !parsed.profiles ||
    typeof parsed.profiles !== "object" ||
    !Array.isArray(parsed.profiles.list)
  ) {
    return undefined;
  }

  const index = parsed.profiles.list.findIndex(
    (profile: unknown) =>
      profile !== null &&
      typeof profile === "object" &&
      "guid" in profile &&
      profile.guid === parsed.defaultProfile,
  );
  return index < 0 ? undefined : index;
}

/**
 * Schreibt die Antworten in verfügbare Terminal-Einstellungen. Kommentare und
 * Formatierung der JSONC-Dateien werden erhalten.
 */
async function applySettings(
  answers: Record<string, SettingValue>,
): Promise<void> {
  const terminalIconsEnabled = answers.terminalIcons === true;
  const settingsPath = findSettingsPath();

  if (!settingsPath) {
    if (terminalIconsEnabled) {
      throw new Error(
        "Cannot enable PowerShell file icons because Windows Terminal settings.json could not be found.",
      );
    }
    log.warn(
      pc.dim("Could not find Windows Terminal settings.json. Skipping write."),
    );
    return;
  }

  log.info(pc.dim(`Writing to ${settingsPath}…`));

  let content = readSettingsFile(settingsPath);
  let dirty = false;
  for (const setting of settings) {
    const value = answers[setting.id];
    if (value === undefined) continue;
    if (!setting.jsonPath) continue;
    if (setting.skipIfKeep && value === "keep") continue;
    if (terminalIconsEnabled && setting.id === "fontFace") continue;

    if (setting.id === "transparency") {
      const opacity = value === "off" ? 100 : Number(value);
      if (!Number.isInteger(opacity) || opacity < 0 || opacity > 100) {
        throw new Error(`Invalid transparency value: ${String(value)}`);
      }

      content = setSetting(content, setting.jsonPath, opacity);
      content = setSetting(
        content,
        ["profiles", "defaults", "useAcrylic"],
        value !== "off",
      );
      content = setSetting(
        content,
        ["useAcrylicInTabRow"],
        value !== "off",
      );
    } else if (setting.id === "background") {
      content = setSetting(content, setting.jsonPath, value);
      content = setSetting(
        content,
        ["profiles", "defaults", "tabColor"],
        value,
      );
    } else if (setting.id === "fontFace") {
      const defaultProfileIndex = getDefaultProfileIndex(content);
      content = setSetting(content, setting.jsonPath, value);
      if (defaultProfileIndex !== undefined) {
        content = setSetting(
          content,
          ["profiles", "list", defaultProfileIndex, "font", "face"],
          value,
        );
      }
    } else {
      content = setSetting(content, setting.jsonPath, value);
    }
    dirty = true;
  }

  if (terminalIconsEnabled) {
    const defaultProfileIndex = getDefaultProfileIndex(content);
    content = setSetting(
      content,
      ["profiles", "defaults", "font", "face"],
      NERD_FONT_FAMILY,
    );
    if (defaultProfileIndex !== undefined) {
      content = setSetting(
        content,
        ["profiles", "list", defaultProfileIndex, "font", "face"],
        NERD_FONT_FAMILY,
      );
    }
    dirty = true;
  }

  if (terminalIconsEnabled) {
    await installNerdFont();
    installTerminalIconsModule();
  }

  if (dirty) {
    writeSettingsFile(settingsPath, content);
  }

  if (terminalIconsEnabled) {
    addTerminalIconsToPowerShellProfile();
  }
}

export async function runInstaller(): Promise<void> {
  console.log(pc.cyan(BANNER));
  intro(pc.bold("Let's make your terminal yours."));

  note(
    [
      "This is a preview of the installer.",
      "Your choices are collected and written to settings.json after confirmation.",
    ].join("\n"),
    "Preview mode",
  );

  const selectableSettings = settings.filter(
    (setting) =>
      (setting.group === "Appearance" && setting.jsonPath !== undefined) ||
      setting.id === "terminalIcons",
  );
  const answers: Record<string, SettingValue> = {};
  let initialPickerValue = selectableSettings[0]?.id;

  while (true) {
    const visibleSettings = selectableSettings.filter(
      (setting) =>
        !(answers.terminalIcons === true && setting.id === "fontFace"),
    );
    const options = visibleSettings.map((setting) => ({
      value: setting.id,
      label:
        answers[setting.id] === undefined
          ? setting.label
          : `${pc.blue("●")} ${setting.label}`,
      hint: setting.hint,
    }));
    if (Object.keys(answers).length > 0) {
      options.push({
        value: "done",
        label: "Done",
        hint: "Review and apply your settings",
      });
    }

    const firstOption = options[0];
    if (!firstOption) {
      throw new Error("No settings are available.");
    }

    const selectedId = bail(
      await select<string>({
        message: "What would you like to customize?",
        options,
        initialValue: initialPickerValue ?? firstOption.value,
      }),
    );
    if (selectedId === "done") break;

    const setting = selectableSettings.find(
      (candidate) => candidate.id === selectedId,
    );
    if (!setting) {
      throw new Error(`Unknown appearance setting selected: ${selectedId}`);
    }

    initialPickerValue = selectedId;
    log.step(pc.bold(pc.cyan(setting.group)));
    answers[setting.id] = await askSetting(setting);
    if (setting.id === "terminalIcons" && answers.terminalIcons === true) {
      answers.fontFace = NERD_FONT_FAMILY;
      initialPickerValue = "terminalIcons";
    }
  }

  renderSummary(answers);

  const proceed = bail(
    await confirm({
      message: "Install these settings? (writes to settings.json)",
      initialValue: true,
    }),
  );

  if (!proceed) {
    cancel("Setup cancelled. Nothing was changed.");
    return;
  }

  const s = spinner();
  s.start("Building your configuration…");
  await delay(300);
  s.message("Checking compatibility…");
  await delay(300);
  s.message(
    answers.terminalIcons === true
      ? "Installing PowerShell file icons…"
      : "Writing settings.json…",
  );
  await delay(400);

  try {
    await applySettings(answers);
  } catch (error) {
    if (!(error instanceof InvalidSettingsFileError)) throw error;

    s.error(error.message);
    process.exitCode = 1;
    return;
  }

  s.stop("Settings written to settings.json.");

  const fontSelected =
    answers.fontFace !== undefined && answers.fontFace !== "keep";
  if (fontSelected) openNewTerminalTab();
  outro(
    [
      `${pc.green("✓")} Your configuration is ready.`,
      pc.dim("Your settings are stored in settings.json."),
    ].join("\n"),
  );
}
