import { describe, expect, it } from "vitest";
import { buildSummarySections, normalizeHex } from "../src/summary";

describe("normalizeHex", () => {
  it("adds a leading hash and uppercases the value", () => {
    expect(normalizeHex("1e1e2e")).toBe("#1E1E2E");
  });

  it("keeps an existing hash and trims whitespace", () => {
    expect(normalizeHex("  #0b1021  ")).toBe("#0B1021");
  });
});

describe("buildSummarySections", () => {
  it("groups selected settings and formats their values", () => {
    const sections = buildSummarySections({
      transparency: "80",
      background: "#0B1021",
      icon: "classic",
      copyOnSelect: true,
    });

    expect(sections).toEqual([
      {
        group: "Appearance",
        rows: [
          ["Transparency", "Acrylic · 80% opacity"],
          ["Background color", "Midnight (#0B1021)"],
        ],
      },
      {
        group: "Profile",
        rows: [["Profile icon", "Classic terminal"]],
      },
      {
        group: "Behavior",
        rows: [["Copy on select", "Enabled"]],
      },
    ]);
  });

  it("formats custom colors and disabled toggles", () => {
    const sections = buildSummarySections({
      background: "#1E1E2E",
      confirmClose: false,
    });

    expect(sections).toEqual([
      {
        group: "Appearance",
        rows: [["Background color", "Custom (#1E1E2E)"]],
      },
      {
        group: "Behavior",
        rows: [["Confirm close", "Disabled"]],
      },
    ]);
  });

  it("returns no sections for an empty configuration", () => {
    expect(buildSummarySections({})).toEqual([]);
  });
});
