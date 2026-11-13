import { settings, type SettingValue } from "./settings.js";

export interface SummarySection {
  group: string;
  rows: [string, string][];
}

export function normalizeHex(value: string): string {
  return value.trim().replace(/^#?/, "#").toUpperCase();
}

export function buildSummarySections(
  answers: Record<string, SettingValue>,
): SummarySection[] {
  const sections: SummarySection[] = [];
  let current: SummarySection | null = null;

  for (const setting of settings) {
    const value = answers[setting.id];
    if (value === undefined) continue;

    if (!current || current.group !== setting.group) {
      current = { group: setting.group, rows: [] };
      sections.push(current);
    }

    current.rows.push([setting.label, setting.summarize(value)]);
  }

  return sections;
}
