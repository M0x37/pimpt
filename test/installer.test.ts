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

vi.mock("../src/wtsettings", () => ({
  InvalidSettingsFileError: mocks.InvalidSettingsFileError,
  findSettingsPath: vi.fn(),
  readSettingsFile: vi.fn(),
  setSetting: vi.fn(),
  writeSettingsFile: vi.fn(),
}));

import { runInstaller } from "../src/installer";
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
  setSetting.mockImplementation((_path: string, _jsonPath: string[], _value: unknown) => {
    return `{"modified": true}`;
  });
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
