import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "jsonc-parser";
import { afterEach, describe, expect, it } from "vitest";
import { setSetting } from "../src/wtsettings";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("setSetting", () => {
  it("applies jsonc-parser edits to the original content", () => {
    const directory = mkdtempSync(join(tmpdir(), "pimpt-wtsettings-"));
    temporaryDirectories.push(directory);
    const settingsPath = join(directory, "settings.json");
    const originalContent = `{
  // Keep this comment.
  "profiles": {
    "defaults": {}
  }
}`;
    writeFileSync(settingsPath, originalContent, "utf8");

    const result = setSetting(
      settingsPath,
      ["profiles", "defaults", "background"],
      "#1E1E2E",
    );

    expect(result).not.toContain("[object Object]");
    expect(result).toContain("// Keep this comment.");
    expect(parse(result)).toEqual({
      profiles: { defaults: { background: "#1E1E2E" } },
    });
  });

  it("rejects invalid JSONC without changing the file", () => {
    const directory = mkdtempSync(join(tmpdir(), "pimpt-wtsettings-"));
    temporaryDirectories.push(directory);
    const settingsPath = join(directory, "settings.json");
    const invalidContent = "[object Object]";
    writeFileSync(settingsPath, invalidContent, "utf8");

    expect(() =>
      setSetting(
        settingsPath,
        ["profiles", "defaults", "background"],
        "#1E1E2E",
      ),
    ).toThrow(
      "Windows Terminal settings.json is invalid JSONC. No changes were written.",
    );
    expect(readFileSync(settingsPath, "utf8")).toBe(invalidContent);
  });
});
