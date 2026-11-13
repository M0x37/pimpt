import { parse } from "jsonc-parser";
import { describe, expect, it } from "vitest";
import { setSetting } from "../src/wtsettings";

describe("setSetting", () => {
  const originalContent = `{
  // Keep this comment.
  "profiles": {
    "defaults": {}
  }
}`;

  it("applies jsonc-parser edits to the original content", () => {
    const result = setSetting(
      originalContent,
      ["profiles", "defaults", "background"],
      "#1E1E2E",
    );

    expect(result).not.toContain("[object Object]");
    expect(result).toContain("// Keep this comment.");
    expect(parse(result)).toEqual({
      profiles: { defaults: { background: "#1E1E2E" } },
    });
  });

  it("applies multiple edits cumulatively", () => {
    const withOpacity = setSetting(
      originalContent,
      ["profiles", "defaults", "opacity"],
      0,
    );
    const withAcrylic = setSetting(
      withOpacity,
      ["profiles", "defaults", "useAcrylic"],
      true,
    );
    const result = setSetting(
      withAcrylic,
      ["useAcrylicInTabRow"],
      true,
    );

    expect(parse(result)).toEqual({
      profiles: { defaults: { opacity: 0, useAcrylic: true } },
      useAcrylicInTabRow: true,
    });
  });

  it("rejects invalid JSONC", () => {
    expect(() =>
      setSetting(
        "[object Object]",
        ["profiles", "defaults", "background"],
        "#1E1E2E",
      ),
    ).toThrow(
      "Windows Terminal settings.json is invalid JSONC. No changes were written.",
    );
  });
});
