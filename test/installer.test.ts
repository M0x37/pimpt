import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const cancelSymbol = Symbol("cancel");

  return {
    cancelSymbol,
    InvalidSettingsFileError: class InvalidSettingsFileError extends Error {},
    intro: vi.fn(),
    note: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    logStep: vi.fn(),
    logWarn: vi.fn(),
    logInfo: vi.fn(),
    isFontInstalled: vi.fn(),
    canInstallFont: vi.fn(),
    installFont: vi.fn(),
    installNerdFont: vi.fn(),
    installTerminalIconsModule: vi.fn(),
    addTerminalIconsToPowerShellProfile: vi.fn(),
    installPSReadLineModule: vi.fn(),
    addHistoryPreviewToPowerShellProfile: vi.fn(),
    addTreeListingToPowerShellProfile: vi.fn(),
    readPowerShellProfileFeatures: vi.fn(() => ({
      terminalIcons: false,
      historyPreview: false,
      treeListing: false,
    })),
    createSettingsBackup: vi.fn(),
    listSettingsBackups: vi.fn(() => []),
    restoreSettingsBackup: vi.fn(),
    spawn: vi.fn(() => ({ on: vi.fn(), unref: vi.fn() })),
    select: vi.fn(),
    text: vi.fn(),
    confirm: vi.fn(),
    spinner: vi.fn(),
    isCancel: vi.fn((value: unknown) => value === cancelSymbol),
  };
});

it("preselects values already present in settings.json", async () => {
  readSettingsFile.mockReturnValue(`{
    "profiles": {
      "defaults": {
        "opacity": 5,
        "useAcrylic": true
      },
      "list": []
    }
  }`);
  setSetting.mockImplementation((content: string) => content);
  selectResponses("Appearance", "back", "done");
  mocks.confirm.mockResolvedValue(true);

  await runInstaller();

  const appearanceOptions = mocks.select.mock.calls[1]?.[0] as {
    options: { value: string; label: string }[];
  };
  expect(
    appearanceOptions.options.find((option) => option.value === "transparency")
      ?.label,
  ).toContain("●");
  expect(summaryText()).toContain("Acrylic · 5% opacity");
  expect(mocks.createSettingsBackup).not.toHaveBeenCalled();
  expect(writeSettingsFile).not.toHaveBeenCalled();
});

vi.mock("@clack/prompts", () => ({
  intro: mocks.intro,
  note: mocks.note,
  outro: mocks.outro,
  cancel: mocks.cancel,
  select: mocks.select,
  text: mocks.text,
  confirm: mocks.confirm,
  spinner: mocks.spinner,
  log: {
    step: mocks.logStep,
    info: mocks.logInfo,
    success: vi.fn(),
    warn: mocks.logWarn,
    error: vi.fn(),
    message: vi.fn(),
  },
  isCancel: mocks.isCancel,
}));

vi.mock("node:timers/promises", () => ({
  setTimeout: vi.fn(() => Promise.resolve()),
}));

vi.mock("node:child_process", () => ({
  spawn: mocks.spawn,
}));

vi.mock("../src/fonts", () => ({
  isFontInstalled: mocks.isFontInstalled,
  canInstallFont: mocks.canInstallFont,
  installFont: mocks.installFont,
  installNerdFont: mocks.installNerdFont,
  NERD_FONT_FAMILY: "Hack Nerd Font Mono",
}));

vi.mock("../src/powershell", () => ({
  installTerminalIconsModule: mocks.installTerminalIconsModule,
  addTerminalIconsToPowerShellProfile: mocks.addTerminalIconsToPowerShellProfile,
  installPSReadLineModule: mocks.installPSReadLineModule,
  addHistoryPreviewToPowerShellProfile: mocks.addHistoryPreviewToPowerShellProfile,
  addTreeListingToPowerShellProfile: mocks.addTreeListingToPowerShellProfile,
  readPowerShellProfileFeatures: mocks.readPowerShellProfileFeatures,
}));

vi.mock("../src/wtsettings", () => ({
  InvalidSettingsFileError: mocks.InvalidSettingsFileError,
  createSettingsBackup: mocks.createSettingsBackup,
  findSettingsPath: vi.fn(),
  listSettingsBackups: mocks.listSettingsBackups,
  readSettingsFile: vi.fn(),
  restoreSettingsBackup: mocks.restoreSettingsBackup,
  setSetting: vi.fn(),
  writeSettingsFile: vi.fn(),
}));

import { runInstaller } from "../src/installer";
import {
  canInstallFont,
  installFont,
  isFontInstalled,
} from "../src/fonts";
import {
  InvalidSettingsFileError,
  findSettingsPath,
  readSettingsFile,
  setSetting,
  writeSettingsFile,
} from "../src/wtsettings";

const spinner = {
  start: vi.fn(),
  stop: vi.fn(),
  message: vi.fn(),
  cancel: vi.fn(),
  error: vi.fn(),
  clear: vi.fn(),
  isCancelled: false,
};

function summaryText(): string {
  return (
    mocks.note.mock.calls
      .filter(([, title]) => title === "Your configuration")
      .map(([message]) => String(message))[0] ?? ""
  );
}

function selectResponses(...values: unknown[]): void {
  let activeArea: string | undefined;
  for (const value of values) {
    const settingArea =
      value === "historyPreview" || value === "treeListing"
        ? "Features"
        : value === "transparency" ||
            value === "background" ||
            value === "fontFace" ||
            value === "terminalIcons" ||
            value === "hidePowerShellBanner"
          ? "Appearance"
          : value === "startingDirectory"
            ? "Features"
          : undefined;
    if (settingArea && activeArea !== settingArea) {
      if (activeArea) mocks.select.mockResolvedValueOnce("back");
      mocks.select.mockResolvedValueOnce(settingArea);
      activeArea = settingArea;
    } else if (value === "restoreBackup" && activeArea !== "Other") {
      if (activeArea) mocks.select.mockResolvedValueOnce("back");
      mocks.select.mockResolvedValueOnce("Other");
      activeArea = "Other";
    } else if (value === "done" && activeArea) {
      mocks.select.mockResolvedValueOnce("back");
      activeArea = undefined;
    }
    mocks.select.mockResolvedValueOnce(value);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("WT_SESSION", "");
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  mocks.spinner.mockReturnValue(spinner);

  findSettingsPath.mockReturnValue(
    "C:/Users/test/AppData/Local/Packages/Microsoft.WindowsTerminal_8wekyb3d8bbwe/LocalState/settings.json",
  );
  readSettingsFile.mockReturnValue(`{
    "$schema": "https://aka.ms/terminal-profiles-schema",
    "profiles": {
      "defaults": {},
      "list": []
    }
  }`);
  setSetting.mockImplementation((_path: string, _jsonPath: (string | number)[], _value: unknown) => {
    return `{"modified": true}`;
  });
  vi.mocked(isFontInstalled).mockReturnValue(true);
  vi.mocked(canInstallFont).mockReturnValue(true);
  vi.mocked(installFont).mockResolvedValue(undefined);
  mocks.installNerdFont.mockResolvedValue(undefined);
  writeSettingsFile.mockImplementation(() => undefined);
  mocks.createSettingsBackup.mockReturnValue(
    "C:/Users/test/settings.json.backup-123-0",
  );
  mocks.listSettingsBackups.mockReturnValue([]);
  mocks.restoreSettingsBackup.mockReturnValue(
    "C:/Users/test/settings.json.backup-456-0",
  );
  mocks.readPowerShellProfileFeatures.mockReturnValue({
    terminalIcons: false,
    historyPreview: false,
    treeListing: false,
  });
});

describe("runInstaller", () => {
  it("preselects PowerShell profile features after restarting", async () => {
    mocks.readPowerShellProfileFeatures.mockReturnValue({
      terminalIcons: false,
      historyPreview: true,
      treeListing: true,
    });
    selectResponses("historyPreview", "done");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    const featureOptions = mocks.select.mock.calls[1]?.[0] as {
      options: { value: string; label: string }[];
    };
    expect(
      featureOptions.options.find((option) => option.value === "historyPreview")
        ?.label,
    ).toContain("●");
    expect(
      featureOptions.options.find((option) => option.value === "treeListing")
        ?.label,
    ).toContain("●");
  });

  it("preselects PowerShell file icons from the profile", async () => {
    mocks.readPowerShellProfileFeatures.mockReturnValue({
      terminalIcons: true,
      historyPreview: false,
      treeListing: false,
    });
    selectResponses("terminalIcons", "done");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    const appearanceOptions = mocks.select.mock.calls[1]?.[0] as {
      options: { value: string; label: string }[];
    };
    expect(
      appearanceOptions.options.find((option) => option.value === "terminalIcons")
        ?.label,
    ).toContain("●");
  });

  it("offers settings without automatically selecting background", async () => {
    selectResponses("transparency", "0", "done");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    const areas = mocks.select.mock.calls[0]?.[0] as {
      options: { value: string; label: string; hint: string }[];
      initialValue: string;
    };
    expect(areas.options.map((option) => option.value)).toEqual([
      "Appearance",
      "Features",
      "Other",
    ]);
    expect(areas.initialValue).toBe("Appearance");

    const options = mocks.select.mock.calls[1]?.[0] as {
      options: { value: string; label: string; hint: string }[];
      initialValue: string;
    };

    expect(options.options).toEqual([
      { value: "transparency", label: "Transparency", hint: "Window opacity" },
      {
        value: "background",
        label: "Background color",
        hint: "Preset or custom color",
      },
      {
        value: "fontFace",
        label: "Font",
        hint: "Terminal font",
      },
      {
        value: "terminalIcons",
        label: "PowerShell file icons",
        hint: "File icons in PowerShell",
      },
      {
        value: "hidePowerShellBanner",
        label: "Hide PowerShell startup banner",
        hint: "Hide the welcome text",
      },
      { value: "back", label: "Back", hint: "Choose another area" },
    ]);
    expect(options.options.every((option) => option.hint.length <= 30)).toBe(true);
    expect(options.initialValue).toBe("transparency");
    expect(setSetting).not.toHaveBeenCalledWith(
      expect.any(String),
      ["profiles", "defaults", "background"],
      expect.anything(),
    );
  });

  it("asks for background color and renders a grouped summary", async () => {
    selectResponses("background", "#2E3440", "done");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    expect(mocks.select).toHaveBeenCalledTimes(5);
    expect(mocks.confirm).toHaveBeenCalledOnce();

    const returnedAppearanceMenu = mocks.select.mock.calls[3]?.[0] as {
      message: string;
      options: { value: string }[];
    };
    expect(returnedAppearanceMenu.message).toBe("Appearance");
    expect(returnedAppearanceMenu.options.map((option) => option.value)).toContain(
      "transparency",
    );
    expect(mocks.select.mock.calls[4]?.[0]).toMatchObject({
      message: "Choose an area",
    });

    expect(summaryText()).toContain("Appearance");
    expect(summaryText()).toContain("Nord (#2E3440)");

    expect(spinner.start).toHaveBeenCalledOnce();
    expect(spinner.stop).toHaveBeenCalledOnce();
    expect(mocks.outro).toHaveBeenCalledOnce();
  });

  it("writes background color to settings.json", async () => {
    selectResponses("background", "#2E3440", "done");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    expect(findSettingsPath).toHaveBeenCalledOnce();
    expect(readSettingsFile).toHaveBeenCalledTimes(2);
    expect(setSetting).toHaveBeenCalledWith(
      expect.any(String),
      ["profiles", "defaults", "background"],
      "#2E3440",
    );
    expect(setSetting).toHaveBeenNthCalledWith(
      2,
      '{"modified": true}',
      ["profiles", "defaults", "tabColor"],
      "#2E3440",
    );
    expect(writeSettingsFile).toHaveBeenCalledOnce();
    expect(mocks.createSettingsBackup).toHaveBeenCalledOnce();
    expect(mocks.createSettingsBackup).toHaveBeenCalledBefore(writeSettingsFile);
    expect(spinner.stop).toHaveBeenCalledWith(
      "Configuration applied successfully.",
    );
  });

  it("offers font choices and writes the selected font", async () => {
    selectResponses("fontFace", "Cascadia Code", "done");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    const options = mocks.select.mock.calls[2]?.[0] as {
      options: { value: string; label: string; hint: string }[];
    };
    expect(options.options.map((option) => option.value)).toEqual([
      "keep",
      "Cascadia Mono",
      "Cascadia Code",
      "Consolas",
      "JetBrains Mono",
      "Fira Code",
      "Hack",
      "Source Code Pro",
      "IBM Plex Mono",
    ]);
    expect(options.options).toContainEqual({
      value: "Cascadia Code",
      label: "Cascadia Code",
      hint: "Ligatures included",
    });
    expect(summaryText()).toContain("Cascadia Code");
    expect(setSetting).toHaveBeenCalledWith(
      expect.any(String),
      ["profiles", "defaults", "font", "face"],
      "Cascadia Code",
    );
    expect(writeSettingsFile).toHaveBeenCalledOnce();
  });

  it("opens a new Windows Terminal tab after applying a font", async () => {
    selectResponses("fontFace", "Cascadia Code", "done");
    mocks.confirm.mockResolvedValue(true);
    vi.stubEnv("WT_SESSION", "test-session");

    await runInstaller();

    expect(mocks.spawn).toHaveBeenCalledWith(
      "wt.exe",
      ["-w", "0", "new-tab"],
      expect.objectContaining({ detached: true, stdio: "ignore" }),
    );
  });

  it("writes the selected font to the default profile as well as defaults", async () => {
    readSettingsFile.mockReturnValue(`{
      "defaultProfile": "powershell",
      "profiles": {
        "defaults": {},
        "list": [
          { "guid": "powershell", "name": "Windows PowerShell" },
          { "guid": "cmd", "name": "Command Prompt" }
        ]
      }
    }`);
    selectResponses("fontFace", "Hack", "done");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    expect(setSetting).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      ["profiles", "defaults", "font", "face"],
      "Hack",
    );
    expect(setSetting).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      ["profiles", "list", 0, "font", "face"],
      "Hack",
    );
  });

  it("accepts a typed or pasted starting directory and applies it to the default profile", async () => {
    readSettingsFile.mockReturnValue(`{
      "defaultProfile": "powershell",
      "profiles": {
        "defaults": { "startingDirectory": "C:\\\\Windows" },
        "list": [
          {
            "guid": "powershell",
            "name": "Windows PowerShell",
            "startingDirectory": "C:\\\\Windows"
          }
        ]
      }
    }`);
    selectResponses("startingDirectory", "done");
    mocks.text.mockResolvedValue("C:\\Program Files");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    expect(mocks.text).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "Enter or paste a path; relative paths start in your user folder",
        initialValue: "C:\\Windows",
      }),
    );
    expect(setSetting).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      ["profiles", "defaults", "startingDirectory"],
      "C:\\Program Files",
    );
    expect(setSetting).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      ["profiles", "list", 0, "startingDirectory"],
      "C:\\Program Files",
    );
    expect(summaryText()).toContain("C:\\Program Files");
    expect(writeSettingsFile).toHaveBeenCalledOnce();
  });

  it("resolves a relative starting folder from the user profile", async () => {
    vi.stubEnv("USERPROFILE", "C:\\Users\\test");
    selectResponses("startingDirectory", "done");
    mocks.text.mockResolvedValue('"Downloads"');
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    const textOptions = mocks.text.mock.calls[0]?.[0] as {
      validate: (value: string | undefined) => string | undefined;
    };
    expect(textOptions.validate("%PIMPT_MISSING_ENV_TEST%\\Downloads")).toContain(
      "Unknown environment variable",
    );
    expect(textOptions.validate("C:Downloads")).toContain(
      "Use an absolute drive path",
    );
    if (process.platform === "win32") {
      expect(
        textOptions.validate(`C:\\__pimpt_missing_${process.pid}`),
      ).toContain("Folder not found");
      expect(textOptions.validate(process.execPath)).toContain(
        "must be an existing folder",
      );
    }

    expect(setSetting).toHaveBeenCalledWith(
      expect.any(String),
      ["profiles", "defaults", "startingDirectory"],
      "C:\\Users\\test\\Downloads",
    );
    expect(summaryText()).toContain("C:\\Users\\test\\Downloads");
  });

  it("clears the starting directory when the text field is emptied", async () => {
    readSettingsFile.mockReturnValue(`{
      "defaultProfile": "powershell",
      "profiles": {
        "defaults": { "startingDirectory": "C:\\\\Windows" },
        "list": [
          {
            "guid": "powershell",
            "name": "Windows PowerShell",
            "startingDirectory": "C:\\\\Windows"
          }
        ]
      }
    }`);
    selectResponses("startingDirectory", "done");
    mocks.text.mockResolvedValue("");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    expect(setSetting).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      ["profiles", "defaults", "startingDirectory"],
      undefined,
    );
    expect(setSetting).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      ["profiles", "list", 0, "startingDirectory"],
      undefined,
    );
    expect(summaryText()).toContain("Default");
    expect(writeSettingsFile).toHaveBeenCalledOnce();
  });

  it("leaves the font unchanged when 'Keep current' is selected", async () => {
    selectResponses("fontFace", "keep", "done");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    expect(setSetting).not.toHaveBeenCalled();
    expect(writeSettingsFile).not.toHaveBeenCalled();
  });

  it("installs PowerShell file icons and selects the required Nerd Font", async () => {
    readSettingsFile.mockReturnValue(`{
      "defaultProfile": "powershell",
      "profiles": {
        "defaults": {},
        "list": [
          { "guid": "powershell", "name": "Windows PowerShell" }
        ]
      }
    }`);
    selectResponses("terminalIcons", "done");
    mocks.confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

    await runInstaller();

    expect(mocks.confirm.mock.calls[0]?.[0]).toMatchObject({
      message: expect.stringContaining(
        "installs Terminal-Icons and Hack Nerd Font Mono if needed",
      ),
    });
    expect(summaryText()).toContain("Hack Nerd Font Mono");
    expect(mocks.installNerdFont).toHaveBeenCalledOnce();
    expect(mocks.installTerminalIconsModule).toHaveBeenCalledOnce();
    expect(summaryText()).toContain("Appearance");
    expect(summaryText()).not.toContain("Behavior");
    expect(setSetting).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      ["profiles", "defaults", "font", "face"],
      "Hack Nerd Font Mono",
    );
    expect(setSetting).toHaveBeenNthCalledWith(
      2,
      '{"modified": true}',
      ["profiles", "list", 0, "font", "face"],
      "Hack Nerd Font Mono",
    );
    expect(writeSettingsFile).toHaveBeenCalledOnce();
    expect(mocks.addTerminalIconsToPowerShellProfile).toHaveBeenCalledOnce();
  });

  it("reports the Nerd Font when icons replace a previously selected font", async () => {
    selectResponses("fontFace", "Cascadia Code", "terminalIcons", "done");
    mocks.confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

    await runInstaller();

    expect(summaryText()).not.toContain("Cascadia Code");
    expect(summaryText()).toContain("Hack Nerd Font Mono");
    expect(setSetting).toHaveBeenCalledWith(
      expect.any(String),
      ["profiles", "defaults", "font", "face"],
      "Hack Nerd Font Mono",
    );
    expect(setSetting).not.toHaveBeenCalledWith(
      expect.any(String),
      ["profiles", "defaults", "font", "face"],
      "Cascadia Code",
    );
  });

  it("does not install icons when the user declines", async () => {
    selectResponses("terminalIcons", "done");
    mocks.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await runInstaller();

    expect(mocks.installNerdFont).not.toHaveBeenCalled();
    expect(mocks.installTerminalIconsModule).not.toHaveBeenCalled();
    expect(mocks.addTerminalIconsToPowerShellProfile).not.toHaveBeenCalled();
    expect(writeSettingsFile).not.toHaveBeenCalled();
  });

  it("enables a scrollable PowerShell command history preview", async () => {
    selectResponses("historyPreview", "done");
    mocks.confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

    await runInstaller();

    const featureOptions = mocks.select.mock.calls[1]?.[0] as {
      options: { value: string }[];
    };
    expect(featureOptions.options.map((option) => option.value)).toEqual([
      "startingDirectory",
      "historyPreview",
      "treeListing",
      "back",
    ]);
    expect(mocks.confirm.mock.calls[0]?.[0]).toMatchObject({
      message: expect.stringContaining("Up and Down arrows"),
    });
    expect(summaryText()).toContain("Command history preview");
    expect(summaryText()).toContain("Features");
    expect(mocks.installPSReadLineModule).toHaveBeenCalledOnce();
    expect(mocks.addHistoryPreviewToPowerShellProfile).toHaveBeenCalledOnce();
    expect(setSetting).not.toHaveBeenCalled();
    expect(writeSettingsFile).not.toHaveBeenCalled();
  });

  it("enables tree-style directory listings for PowerShell", async () => {
    selectResponses("treeListing", "done");
    mocks.confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

    await runInstaller();

    const featureOptions = mocks.select.mock.calls[1]?.[0] as {
      options: { value: string }[];
    };
    expect(featureOptions.options.map((option) => option.value)).toEqual([
      "startingDirectory",
      "historyPreview",
      "treeListing",
      "back",
    ]);
    expect(mocks.confirm.mock.calls[0]?.[0]).toMatchObject({
      message: expect.stringContaining("colored tree"),
    });
    expect(summaryText()).toContain("Tree-style ls");
    expect(mocks.addTreeListingToPowerShellProfile).toHaveBeenCalledOnce();
    expect(setSetting).not.toHaveBeenCalled();
    expect(writeSettingsFile).not.toHaveBeenCalled();
  });

  it("adds -NoLogo to the Windows PowerShell profile", async () => {
    readSettingsFile.mockReturnValue(`{
      "profiles": {
        "list": [
          { "name": "Windows PowerShell", "commandline": "powershell.exe" },
          { "name": "Command Prompt", "commandline": "cmd.exe" }
        ]
      }
    }`);
    selectResponses("hidePowerShellBanner", "done");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    expect(setSetting).toHaveBeenCalledWith(
      expect.any(String),
      ["profiles", "list", 0, "commandline"],
      "powershell.exe -NoLogo",
    );
    expect(setSetting).not.toHaveBeenCalledWith(
      expect.any(String),
      ["profiles", "list", 1, "commandline"],
      expect.anything(),
    );
    expect(mocks.createSettingsBackup).toHaveBeenCalledOnce();
    expect(writeSettingsFile).toHaveBeenCalledOnce();
    expect(summaryText()).toContain("Appearance");
    expect(summaryText()).not.toContain("Features");
  });

  it("does not add a duplicate -NoLogo argument", async () => {
    readSettingsFile.mockReturnValue(`{
      "profiles": {
        "list": [
          { "name": "Windows PowerShell", "commandline": "powershell.exe -NoLogo" }
        ]
      }
    }`);
    selectResponses("hidePowerShellBanner", "done");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    expect(setSetting).not.toHaveBeenCalled();
    expect(mocks.createSettingsBackup).not.toHaveBeenCalled();
    expect(writeSettingsFile).not.toHaveBeenCalled();
  });

  it("does not install the history preview when the user declines", async () => {
    selectResponses("historyPreview", "done");
    mocks.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await runInstaller();

    expect(mocks.installPSReadLineModule).not.toHaveBeenCalled();
    expect(mocks.addHistoryPreviewToPowerShellProfile).not.toHaveBeenCalled();
  });

  it("restores a selected backup after confirming and keeps a safety backup", async () => {
    const backupPath = "C:/Users/test/settings.json.backup-123-0";
    mocks.listSettingsBackups.mockReturnValue([
      { path: backupPath, createdAt: new Date("2026-01-02T03:04:05Z") },
    ]);
    selectResponses("restoreBackup", backupPath);
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    const otherOptions = mocks.select.mock.calls[1]?.[0] as {
      options: { value: string }[];
    };
    expect(otherOptions.options.map((option) => option.value)).toEqual([
      "restoreBackup",
      "back",
    ]);
    expect(mocks.restoreSettingsBackup).toHaveBeenCalledWith(
      expect.any(String),
      backupPath,
    );
    expect(mocks.outro).toHaveBeenCalledWith(
      expect.stringContaining("settings.json was restored"),
    );
    expect(writeSettingsFile).not.toHaveBeenCalled();
  });

  it("does not install icons when Windows Terminal settings are invalid", async () => {
    const originalExitCode = process.exitCode;
    selectResponses("terminalIcons", "done");
    mocks.confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
    setSetting.mockImplementation(() => {
      throw new InvalidSettingsFileError("Invalid JSONC.");
    });

    try {
      await runInstaller();

      expect(mocks.installNerdFont).not.toHaveBeenCalled();
      expect(mocks.installTerminalIconsModule).not.toHaveBeenCalled();
      expect(mocks.addTerminalIconsToPowerShellProfile).not.toHaveBeenCalled();
      expect(writeSettingsFile).not.toHaveBeenCalled();
      expect(spinner.error).toHaveBeenCalledWith("Invalid JSONC.");
    } finally {
      process.exitCode = originalExitCode;
    }
  });

  it("asks before installing a missing font", async () => {
    selectResponses("fontFace", "Source Code Pro", "done");
    mocks.isFontInstalled.mockReturnValue(false);
    mocks.confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

    await runInstaller();

    expect(mocks.confirm.mock.calls[0]?.[0]).toMatchObject({
      message: expect.stringContaining(
        "Source Code Pro is not installed. Install it now?",
      ),
    });
    expect(installFont).toHaveBeenCalledWith("Source Code Pro");
    expect(spinner.stop).toHaveBeenCalledWith(
      "Source Code Pro installed. Restart Windows Terminal to use it.",
    );
    expect(setSetting).toHaveBeenCalledWith(
      expect.any(String),
      ["profiles", "defaults", "font", "face"],
      "Source Code Pro",
    );
  });

  it("returns to the font list when installation is declined", async () => {
    selectResponses(
      "fontFace",
      "Source Code Pro",
      "JetBrains Mono",
      "done",
    );
    mocks.isFontInstalled.mockImplementation(
      (fontFamily: string) => fontFamily === "JetBrains Mono",
    );
    mocks.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await runInstaller();

    expect(installFont).not.toHaveBeenCalled();
    expect(setSetting).toHaveBeenCalledWith(
      expect.any(String),
      ["profiles", "defaults", "font", "face"],
      "JetBrains Mono",
    );
  });

  it("offers full transparency and writes opacity plus acrylic settings", async () => {
    selectResponses("transparency", "0", "done");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    const options = mocks.select.mock.calls[2]?.[0] as {
      options: { value: string; label: string; hint: string }[];
    };
    expect(options.options).toContainEqual({
      value: "0",
      label: "Fully transparent",
      hint: "Content 0%; tab row 50% acrylic",
    });
    expect(summaryText()).toContain("Fully transparent");
    expect(setSetting).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      ["profiles", "defaults", "opacity"],
      0,
    );
    expect(setSetting).toHaveBeenNthCalledWith(
      2,
      '{"modified": true}',
      ["profiles", "defaults", "useAcrylic"],
      true,
    );
    expect(setSetting).toHaveBeenNthCalledWith(
      3,
      '{"modified": true}',
      ["useAcrylicInTabRow"],
      true,
    );
    expect(writeSettingsFile).toHaveBeenCalledOnce();
  });

  it("disables acrylic when transparency is off", async () => {
    selectResponses("transparency", "off", "done");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    expect(setSetting).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      ["profiles", "defaults", "opacity"],
      100,
    );
    expect(setSetting).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      ["profiles", "defaults", "useAcrylic"],
      false,
    );
    expect(setSetting).toHaveBeenNthCalledWith(
      3,
      expect.any(String),
      ["useAcrylicInTabRow"],
      false,
    );
  });

  it("asks for a custom background color and validates it", async () => {
    selectResponses("background", "custom", "done");
    mocks.text.mockResolvedValue("1e1e2e");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    expect(summaryText()).toContain("Custom (#1E1E2E)");

    const options = mocks.text.mock.calls[0]?.[0] as {
      validate: (value?: string) => string | undefined;
    };

    expect(options.validate("#1E1E2E")).toBeUndefined();
    expect(options.validate("nope")).toContain("hex color");
    expect(options.validate(undefined)).toContain("hex color");
  });

  it("skips writing when value is 'keep'", async () => {
    selectResponses("background", "keep", "done");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    expect(setSetting).not.toHaveBeenCalled();
    expect(writeSettingsFile).not.toHaveBeenCalled();
  });

  it("stops when the user declines the installation", async () => {
    selectResponses("background", "70", "done");
    mocks.confirm.mockResolvedValue(false);

    await runInstaller();

    expect(mocks.cancel).toHaveBeenCalledWith(
      "Setup cancelled. Nothing was changed.",
    );
    expect(mocks.spinner).not.toHaveBeenCalled();
    expect(mocks.outro).not.toHaveBeenCalled();
    expect(writeSettingsFile).not.toHaveBeenCalled();
  });

  it("exits when a prompt is cancelled", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    selectResponses(mocks.cancelSymbol);

    await expect(runInstaller()).rejects.toThrow("exit:0");

    expect(mocks.cancel).toHaveBeenCalledWith(
      "Setup cancelled. Nothing was changed.",
    );
    expect(mocks.outro).not.toHaveBeenCalled();

    exit.mockRestore();
  });

  it("warns when settings.json is not found", async () => {
    vi.mocked(findSettingsPath).mockReturnValue(undefined);
    selectResponses("background", "#2E3440", "done");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    expect(mocks.logWarn).toHaveBeenCalledWith(
      expect.stringContaining("Could not find Windows Terminal settings.json"),
    );
    expect(writeSettingsFile).not.toHaveBeenCalled();
  });

  it("reports invalid settings without showing a success message", async () => {
    const originalExitCode = process.exitCode;
    selectResponses("background", "#2E3440", "done");
    mocks.confirm.mockResolvedValue(true);
    setSetting.mockImplementation(() => {
      throw new InvalidSettingsFileError(
        "Windows Terminal settings.json is invalid JSONC. No changes were written. Restore the file from a backup before trying again.",
      );
    });

    try {
      await runInstaller();

      expect(spinner.error).toHaveBeenCalledWith(
        expect.stringContaining("settings.json is invalid JSONC"),
      );
      expect(spinner.stop).not.toHaveBeenCalled();
      expect(mocks.outro).not.toHaveBeenCalled();
      expect(writeSettingsFile).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = originalExitCode;
    }
  });
});
