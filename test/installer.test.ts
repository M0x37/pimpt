import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const cancelSymbol = Symbol("cancel");

  return {
    cancelSymbol,
    intro: vi.fn(),
    note: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    groupMultiselect: vi.fn(),
    select: vi.fn(),
    text: vi.fn(),
    confirm: vi.fn(),
    spinner: vi.fn(),
    logStep: vi.fn(),
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
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
  isCancel: mocks.isCancel,
}));

vi.mock("node:timers/promises", () => ({
  setTimeout: vi.fn(() => Promise.resolve()),
}));

import { runInstaller } from "../src/installer";

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
});

describe("runInstaller", () => {
  it("asks only the selected settings and renders a grouped summary", async () => {
    mocks.groupMultiselect.mockResolvedValue(["transparency", "background"]);
    mocks.select.mockResolvedValueOnce("80").mockResolvedValueOnce("#2E3440");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    expect(mocks.groupMultiselect).toHaveBeenCalledOnce();
    expect(mocks.select).toHaveBeenCalledTimes(2);
    expect(mocks.confirm).toHaveBeenCalledOnce();

    expect(summaryText()).toContain("Appearance");
    expect(summaryText()).toContain("Acrylic · 80% opacity");
    expect(summaryText()).toContain("Nord (#2E3440)");

    expect(spinner.start).toHaveBeenCalledOnce();
    expect(spinner.stop).toHaveBeenCalledOnce();
    expect(mocks.outro).toHaveBeenCalledOnce();
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

  it("supports boolean settings", async () => {
    mocks.groupMultiselect.mockResolvedValue(["copyOnSelect"]);
    mocks.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await runInstaller();

    expect(mocks.confirm).toHaveBeenCalledTimes(2);
    expect(summaryText()).toContain("Copy on select");
    expect(summaryText()).toContain("Disabled");
  });

  it("stops when the user declines the installation", async () => {
    mocks.groupMultiselect.mockResolvedValue(["transparency"]);
    mocks.select.mockResolvedValue("70");
    mocks.confirm.mockResolvedValue(false);

    await runInstaller();

    expect(mocks.cancel).toHaveBeenCalledWith(
      "Setup cancelled. Nothing was changed.",
    );
    expect(mocks.spinner).not.toHaveBeenCalled();
    expect(mocks.outro).not.toHaveBeenCalled();
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
});
