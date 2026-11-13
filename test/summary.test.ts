import { describe, expect, it } from "vitest";
import { buildSummaryRows, normalizeHex } from "../src/summary";

describe("normalizeHex", () => {
  it("adds a leading hash and uppercases the value", () => {
    expect(normalizeHex("1e1e2e")).toBe("#1E1E2E");
  });

  it("keeps an existing hash and trims whitespace", () => {
    expect(normalizeHex("  #0b1021  ")).toBe("#0B1021");
  });

  it("only strips a single leading hash", () => {
    expect(normalizeHex("#abc123")).toBe("#ABC123");
  });
});

describe("buildSummaryRows", () => {
  it("returns every selected option in display order", () => {
    const rows = buildSummaryRows({
      features: ["acrylic", "background", "icon"],
      acrylic: { opacity: 80 },
      background: { name: "Midnight", hex: "#0B1021" },
      icon: { label: "Classic terminal", value: "classic" },
    });

    expect(rows).toEqual([
      ["Transparency", "Acrylic at 80% opacity"],
      ["Background", "Midnight (#0B1021)"],
      ["Icon", "Classic terminal (classic)"],
    ]);
  });

  it("only includes options that were chosen", () => {
    const rows = buildSummaryRows({
      features: ["background"],
      acrylic: null,
      background: { name: "Custom", hex: "#1E1E2E" },
      icon: null,
    });

    expect(rows).toEqual([["Background", "Custom (#1E1E2E)"]]);
  });

  it("returns an empty list when nothing was chosen", () => {
    const rows = buildSummaryRows({
      features: [],
      acrylic: null,
      background: null,
      icon: null,
    });

    expect(rows).toEqual([]);
  });
});
