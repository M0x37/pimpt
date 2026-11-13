import {
  cancel,
  confirm,
  groupMultiselect,
  intro,
  isCancel,
  log,
  note,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";
import pc from "picocolors";
import { setTimeout as delay } from "node:timers/promises";
import {
  BACKGROUND_CUSTOM,
  buildGroupedOptions,
  settings,
  type SettingDefinition,
  type SettingValue,
} from "./settings.js";
import { buildSummarySections, normalizeHex } from "./summary.js";

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
    const value = bail(
      await select<string>({
        message: prompt.message,
        options: prompt.options,
        initialValue: prompt.initialValue,
      }),
    );

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

export async function runInstaller(): Promise<void> {
  console.log(pc.cyan(BANNER));
  intro(pc.bold("Let's make your terminal yours."));

  note(
    [
      "This is a preview of the installer.",
      "Your choices are collected and summarized, but settings.json is not modified yet.",
    ].join("\n"),
    "Preview mode",
  );

  // Erster Schritt: nur die Appearance-Gruppe, und darin nur "Background".
  const appearanceOptions = Object.fromEntries(
    Object.entries(buildGroupedOptions()).filter(
      ([group]) => group === "Appearance",
    ),
  );
  appearanceOptions.Appearance =
    appearanceOptions.Appearance?.filter((option) => option.value === "background") ?? [];

  const selected = bail(
    await groupMultiselect<string>({
      message: "What would you like to customize?",
      options: appearanceOptions,
      initialValues: ["background"],
      required: true,
      selectableGroups: false,
      maxItems: 8,
    }),
  );

  const chosen = settings.filter(
    (setting) => setting.group === "Appearance" && selected.includes(setting.id),
  );
  const answers: Record<string, SettingValue> = {};

  for (const setting of chosen) {
    log.step(pc.bold(pc.cyan(setting.group)));
    answers[setting.id] = await askSetting(setting);
  }

  renderSummary(answers);

  const proceed = bail(
    await confirm({
      message: "Install these settings? (preview only)",
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
  s.message("Simulating settings.json update…");
  await delay(400);
  s.stop("Preview complete — no files were changed.");

  outro(
    [
      `${pc.green("✓")} Your configuration is ready.`,
      pc.dim("Real settings.json integration is not wired up yet."),
    ].join("\n"),
  );
}
