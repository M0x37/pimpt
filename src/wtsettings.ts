import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { applyEdits, modify, parse, type ParseError } from "jsonc-parser";

export class InvalidSettingsFileError extends Error {
  constructor() {
    super(
      "Windows Terminal settings.json is invalid JSONC. No changes were written. Restore the file from a backup before trying again.",
    );
    this.name = "InvalidSettingsFileError";
  }
}

/**
 * Sucht die Windows Terminal settings.json.
 * Prüft Stable, Preview und Canary in dieser Reihenfolge.
 */
export function findSettingsPath(): string | undefined {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return undefined;

  const candidates = [
    join(localAppData, "Packages", "Microsoft.WindowsTerminal_8wekyb3d8bbwe", "LocalState", "settings.json"),
    join(localAppData, "Packages", "Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe", "LocalState", "settings.json"),
    join(localAppData, "Packages", "Microsoft.WindowsTerminal.Canary_8wekyb3d8bbwe", "LocalState", "settings.json"),
  ];

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }

  return undefined;
}

/**
 * Liest die settings.json als rohen Text.
 */
export function readSettingsFile(settingsPath: string): string {
  return readFileSync(settingsPath, "utf8");
}

/**
 * Schreibt die geänderte settings.json zurück. Kommentare und Formatierung
 * werden so weit wie möglich erhalten (jsonc-parser.modify).
 */
export function writeSettingsFile(settingsPath: string, content: string): void {
  writeFileSync(settingsPath, content, "utf8");
}

/**
 * Wendet eine Änderung an der settings.json an.
 *
 * @param content - Der aktuelle Inhalt der settings.json
 * @param jsonPath - Pfad im JSON, z. B. ["profiles", "defaults", "background"]
 * @param value - Der neue Wert
 * @returns Der neu geschriebene Dateiinhalt
 */
export function setSetting(
  content: string,
  jsonPath: string[],
  value: unknown,
): string {
  const parseErrors: ParseError[] = [];
  const parsedContent = parse(content, parseErrors, { allowTrailingComma: true });
  if (
    parseErrors.length > 0 ||
    parsedContent === null ||
    typeof parsedContent !== "object" ||
    Array.isArray(parsedContent)
  ) {
    throw new InvalidSettingsFileError();
  }

  const edits = modify(content, jsonPath, value, {
    formattingOptions: {
      tabSize: 4,
      insertSpaces: true,
    },
  });
  return applyEdits(content, edits);
}
