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
    spawn: vi.fn(() => ({ on: vi.fn(), unref: vi.fn() })),
    select: vi.fn(),
    text: vi.fn(),
    confirm: vi.fn(),
    spinner: vi.fn(),
    isCancel: vi.fn((value: unknown) => value === cancelSymbol),
  };
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

vi.mock("../src/icons", () => ({
  installTerminalIconsModule: mocks.installTerminalIconsModule,
  addTerminalIconsToPowerShellProfile: mocks.addTerminalIconsToPowerShellProfile,
}));

vi.mock("../src/wtsettings", () => ({
  InvalidSettingsFileError: mocks.InvalidSettingsFileError,
  findSettingsPath: vi.fn(),
  readSettingsFile: vi.fn(),
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
  for (const value of values) {
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
});

describe("runInstaller", () => {
  it("offers settings without automatically selecting background", async () => {
    selectResponses("transparency", "0", "done");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    const options = mocks.select.mock.calls[0]?.[0] as {
      options: { value: string; label: string; hint: string }[];
      initialValue: string;
    };

    expect(options.options).toEqual([
      { value: "transparency", label: "Transparency", hint: "Window opacity and acrylic tab row" },
      {
        value: "background",
        label: "Background color",
        hint: "Palette preset or custom hex; also colors the active tab",
      },
      {
        value: "fontFace",
        label: "Font",
        hint: "Typeface used in Windows Terminal",
      },
      {
        value: "terminalIcons",
        label: "PowerShell file icons",
        hint: "Show file and folder icons in Windows PowerShell",
      },
    ]);
    expect(options.initialValue).toBe("transparency");
    const returnedOptions = mocks.select.mock.calls[2]?.[0] as {
      options: { value: string; label: string }[];
    };
    expect(
      returnedOptions.options.find((option) => option.value === "transparency")
        ?.label,
    ).toContain("●");
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

    expect(mocks.select).toHaveBeenCalledTimes(3);
    expect(mocks.confirm).toHaveBeenCalledOnce();

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
    expect(readSettingsFile).toHaveBeenCalledOnce();
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
    expect(spinner.stop).toHaveBeenCalledWith(
      "Settings written to settings.json.",
    );
  });

  it("offers font choices and writes the selected font", async () => {
    selectResponses("fontFace", "Cascadia Code", "done");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    const options = mocks.select.mock.calls[1]?.[0] as {
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

    const options = mocks.select.mock.calls[1]?.[0] as {
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
