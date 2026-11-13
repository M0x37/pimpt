import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "jsonc-parser";
import { describe, expect, it } from "vitest";
import {
  createSettingsBackup,
  listSettingsBackups,
  restoreSettingsBackup,
  setSetting,
} from "../src/wtsettings";

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

describe("settings backups", () => {
  it("creates and lists a backup of the current settings", () => {
    const directory = mkdtempSync(join(tmpdir(), "pimpt-settings-"));
    try {
      const settingsPath = join(directory, "settings.json");
      writeFileSync(settingsPath, '{"profiles":{}}', "utf8");

      const backupPath = createSettingsBackup(settingsPath);
      const backups = listSettingsBackups(settingsPath);

      expect(readFileSync(backupPath, "utf8")).toBe('{"profiles":{}}');
      expect(backups.map((backup) => backup.path)).toContain(backupPath);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("restores a valid backup while backing up the current settings", () => {
    const directory = mkdtempSync(join(tmpdir(), "pimpt-settings-"));
    try {
      const settingsPath = join(directory, "settings.json");
      writeFileSync(settingsPath, '{"new":true}', "utf8");
      const backupPath = createSettingsBackup(settingsPath);
      writeFileSync(settingsPath, '{"current":true}', "utf8");

      const safetyBackupPath = restoreSettingsBackup(settingsPath, backupPath);

      expect(readFileSync(settingsPath, "utf8")).toBe('{"new":true}');
      expect(readFileSync(safetyBackupPath, "utf8")).toBe('{"current":true}');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("does not restore an invalid backup", () => {
    const directory = mkdtempSync(join(tmpdir(), "pimpt-settings-"));
    try {
      const settingsPath = join(directory, "settings.json");
      writeFileSync(settingsPath, '{"current":true}', "utf8");
      const backupPath = createSettingsBackup(settingsPath);
      writeFileSync(backupPath, "invalid", "utf8");

      expect(() => restoreSettingsBackup(settingsPath, backupPath)).toThrow(
        "The selected backup is invalid JSONC",
      );
      expect(readFileSync(settingsPath, "utf8")).toBe('{"current":true}');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
