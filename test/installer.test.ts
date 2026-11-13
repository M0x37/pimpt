import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const cancelSymbol = Symbol("cancel");

  return {
    cancelSymbol,
    intro: vi.fn(),
    note: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    multiselect: vi.fn(),
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
  multiselect: mocks.multiselect,
  select: mocks.select,
  text: mocks.text,
  confirm: mocks.confirm,
  spinner: mocks.spinner,
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
  return mocks.note.mock.calls
    .map(([message]) => String(message))
    .find((message) => message.includes("Transparency") || message.includes("Background") || message.includes("Icon")) ?? "";
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.spinner.mockReturnValue(spinner);
});

describe("runInstaller", () => {
  it("runs the full flow with all default choices", async () => {
    mocks.multiselect.mockResolvedValue(["acrylic", "background", "icon"]);
    mocks.select
      .mockResolvedValueOnce(80)
      .mockResolvedValueOnce("midnight")
      .mockResolvedValueOnce("classic");
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    expect(mocks.intro).toHaveBeenCalledOnce();
    expect(mocks.multiselect).toHaveBeenCalledOnce();
    expect(mocks.select).toHaveBeenCalledTimes(3);
    expect(mocks.confirm).toHaveBeenCalledOnce();

    expect(summaryText()).toContain("Acrylic at 80% opacity");
    expect(summaryText()).toContain("Midnight (#0B1021)");
    expect(summaryText()).toContain("Classic terminal (classic)");

    expect(spinner.start).toHaveBeenCalledOnce();
    expect(spinner.stop).toHaveBeenCalledOnce();
    expect(mocks.outro).toHaveBeenCalledOnce();
  });

  it("handles a custom background color", async () => {
    mocks.multiselect.mockResolvedValue(["background"]);
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

  it("stops when the user declines the installation", async () => {
    mocks.multiselect.mockResolvedValue(["acrylic"]);
    mocks.select.mockResolvedValue(70);
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

    mocks.multiselect.mockResolvedValue(mocks.cancelSymbol);

    await expect(runInstaller()).rejects.toThrow("exit:0");

    expect(mocks.cancel).toHaveBeenCalledWith(
      "Setup cancelled. Nothing was changed.",
    );
    expect(mocks.outro).not.toHaveBeenCalled();

    exit.mockRestore();
  });
});
