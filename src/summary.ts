import type { InstallerChoices } from "./types.js";

export function normalizeHex(value: string): string {
  return value.trim().replace(/^#?/, "#").toUpperCase();
}

export function buildSummaryRows(
  choices: InstallerChoices,
): [string, string][] {
  const rows: [string, string][] = [];

  if (choices.acrylic) {
    rows.push(["Transparency", `Acrylic at ${choices.acrylic.opacity}% opacity`]);
  }
  if (choices.background) {
    rows.push([
      "Background",
      `${choices.background.name} (${choices.background.hex})`,
    ]);
  }
  if (choices.icon) {
    rows.push(["Icon", `${choices.icon.label} (${choices.icon.value})`]);
  }

  return rows;
}
