import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const cancelSymbol = Symbol("cancel");

  return {
    cancelSymbol,
    intro: vi.fn(),
    note: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    logStep: vi.fn(),
    logWarn: vi.fn(),
    logInfo: vi.fn(),
    groupMultiselect: vi.fn(),
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
  groupMultiselect: mocks.groupMultiselect,
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
  findSettingsPath: vi.fn(),
  readSettingsFile: vi.fn(),
  setSetting: vi.fn(),
  writeSettingsFile: vi.fn(),
}));

import { runInstaller } from "../src/installer";
import {
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
  it("offers only the Appearance group with background preselected", async () => {
    mocks.groupMultiselect.mockResolvedValue(["background"]);
    mocks.select.mockResolvedValue("#2E3440");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    expect(mocks.groupMultiselect).toHaveBeenCalledOnce();

    const options = mocks.groupMultiselect.mock.calls[0]?.[0] as {
      options: Record<string, unknown>;
      initialValues?: string[];
      maxItems?: number;
      selectableGroups?: boolean;
    };

    expect(Object.keys(options.options)).toEqual(["Appearance"]);
    expect((options.options as Record<string, unknown>).Appearance).toEqual([
      { value: "background", label: "Background color", hint: "Palette preset or custom hex" },
    ]);
    expect(options.initialValues).toEqual(["background"]);
    expect(options.maxItems).toBe(8);
    expect(options.selectableGroups).toBe(false);
  });

  it("asks for background color and renders a grouped summary", async () => {
    mocks.groupMultiselect.mockResolvedValue(["background"]);
    mocks.select.mockResolvedValue("#2E3440");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    expect(mocks.select).toHaveBeenCalledTimes(1);
    expect(mocks.confirm).toHaveBeenCalledOnce();

    expect(summaryText()).toContain("Appearance");
    expect(summaryText()).toContain("Nord (#2E3440)");

    expect(spinner.start).toHaveBeenCalledOnce();
    expect(spinner.stop).toHaveBeenCalledOnce();
    expect(mocks.outro).toHaveBeenCalledOnce();
  });

  it("writes background color to settings.json", async () => {
    mocks.groupMultiselect.mockResolvedValue(["background"]);
    mocks.select.mockResolvedValue("#2E3440");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    expect(findSettingsPath).toHaveBeenCalledOnce();
    expect(readSettingsFile).toHaveBeenCalledOnce();
    expect(setSetting).toHaveBeenCalledWith(
      expect.any(String),
      ["profiles", "defaults", "background"],
      "#2E3440",
    );
    expect(writeSettingsFile).toHaveBeenCalledOnce();
    expect(spinner.stop).toHaveBeenCalledWith(
      "Settings written to settings.json.",
    );
  });

  it("asks for a custom background color and validates it", async () => {
    mocks.groupMultiselect.mockResolvedValue(["background"]);
    mocks.select.mockResolvedValue("custom");
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
    mocks.groupMultiselect.mockResolvedValue(["background"]);
    mocks.select.mockResolvedValue("keep");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    expect(setSetting).not.toHaveBeenCalled();
    expect(writeSettingsFile).not.toHaveBeenCalled();
  });

  it("stops when the user declines the installation", async () => {
    mocks.groupMultiselect.mockResolvedValue(["background"]);
    mocks.select.mockResolvedValue("70");
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

    mocks.groupMultiselect.mockResolvedValue(mocks.cancelSymbol);

    await expect(runInstaller()).rejects.toThrow("exit:0");

    expect(mocks.cancel).toHaveBeenCalledWith(
      "Setup cancelled. Nothing was changed.",
    );
    expect(mocks.outro).not.toHaveBeenCalled();

    exit.mockRestore();
  });

  it("warns when settings.json is not found", async () => {
    vi.mocked(findSettingsPath).mockReturnValue(undefined);
    mocks.groupMultiselect.mockResolvedValue(["background"]);
    mocks.select.mockResolvedValue("#2E3440");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    expect(mocks.logWarn).toHaveBeenCalledWith(
      expect.stringContaining("Could not find Windows Terminal settings.json"),
    );
    expect(writeSettingsFile).not.toHaveBeenCalled();
  });
});
