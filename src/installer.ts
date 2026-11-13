import {
  cancel,
  confirm,
  intro,
  isCancel,
  multiselect,
  note,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";
import pc from "picocolors";
import { setTimeout as delay } from "node:timers/promises";
import type {
  AcrylicChoice,
  BackgroundChoice,
  Feature,
  IconChoice,
  InstallerChoices,
} from "./types.js";

interface ChoiceOption<T> {
  value: T;
  label: string;
  hint: string;
}

const featureOptions: ChoiceOption<Feature>[] = [
  { value: "acrylic", label: "Transparency", hint: "Acrylic blur and opacity" },
  { value: "background", label: "Background color", hint: "Palette preset or custom hex" },
  { value: "icon", label: "Profile icon", hint: "Choose an icon style" },
];

const opacityOptions: ChoiceOption<number>[] = [
  { value: 90, label: "Subtle", hint: "90% opacity" },
  { value: 80, label: "Balanced", hint: "80% opacity" },
  { value: 70, label: "Frosted", hint: "70% opacity" },
  { value: 50, label: "Heavy", hint: "50% opacity" },
];

const backgroundPresets = {
  midnight: { name: "Midnight", hex: "#0B1021" },
  nord: { name: "Nord", hex: "#2E3440" },
  dracula: { name: "Dracula", hex: "#282A36" },
  solarized: { name: "Solarized Dark", hex: "#002B36" },
} satisfies Record<string, BackgroundChoice>;

type BackgroundValue = keyof typeof backgroundPresets | "custom";

const backgroundOptions: ChoiceOption<BackgroundValue>[] = [
  ...(Object.keys(backgroundPresets) as (keyof typeof backgroundPresets)[]).map(
    (value) => ({
      value,
      label: backgroundPresets[value].name,
      hint: backgroundPresets[value].hex,
    }),
  ),
  { value: "custom", label: "Custom hex", hint: "Enter your own color" },
];

const iconPresets = {
  classic: { label: "Classic terminal", hint: "Monochrome prompt glyph" },
  rocket: { label: "Rocket", hint: "Launch-ready" },
  bolt: { label: "Bolt", hint: "Fast and loud" },
  code: { label: "Code", hint: "Developer vibes" },
} satisfies Record<string, { label: string; hint: string }>;

type IconValue = keyof typeof iconPresets;

const iconOptions: ChoiceOption<IconValue>[] = (
  Object.keys(iconPresets) as IconValue[]
).map((value) => ({ value, ...iconPresets[value] }));

function bail<T>(value: T): Exclude<T, symbol> {
  if (isCancel(value)) {
    cancel("Setup cancelled. Nothing was changed.");
    process.exit(0);
  }
  return value as Exclude<T, symbol>;
}

function normalizeHex(value: string): string {
  const hex = value.trim().replace(/^#?/, "#");
  return hex.toUpperCase();
}

function renderSummary(choices: InstallerChoices): void {
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

  if (rows.length === 0) {
    note("No appearance options selected.", "Configuration summary");
    return;
  }

  const width = Math.max(...rows.map(([label]) => label.length));
  const lines = rows.map(
    ([label, value]) => `${pc.cyan(label.padEnd(width))}  ${value}`,
  );

  note(lines.join("\n"), "Configuration summary");
}

export async function runInstaller(): Promise<void> {
  intro(
    `${pc.bold(pc.bgCyan(pc.black(" pimpt ")))} ${pc.dim("Windows Terminal setup assistant")}`,
  );

  note(
    [
      "This is a preview of the installer.",
      "Your choices are collected and summarized, but settings.json is not modified yet.",
    ].join("\n"),
    "Preview mode",
  );

  const features = bail(
    await multiselect<Feature>({
      message: "What should pimpt personalize?",
      options: featureOptions,
      initialValues: ["acrylic", "background", "icon"],
      required: true,
    }),
  );

  let acrylic: AcrylicChoice | null = null;
  let background: BackgroundChoice | null = null;
  let icon: IconChoice | null = null;

  if (features.includes("acrylic")) {
    const opacity = bail(
      await select<number>({
        message: "How strong should the acrylic effect be?",
        options: opacityOptions,
        initialValue: 80,
      }),
    );
    acrylic = { opacity };
  }

  if (features.includes("background")) {
    const selected = bail(
      await select<BackgroundValue>({
        message: "Choose a background color",
        options: backgroundOptions,
      }),
    );

    if (selected === "custom") {
      const input = bail(
        await text({
          message: "Enter a hex color",
          placeholder: "#1E1E2E",
          validate: (value) => {
            const input = value ?? "";
            return /^#?[0-9a-fA-F]{6}$/.test(input.trim())
              ? undefined
              : "Use a 6-digit hex color, e.g. #1E1E2E";
          },
        }),
      );
      background = { name: "Custom", hex: normalizeHex(input) };
    } else {
      background = backgroundPresets[selected];
    }
  }

  if (features.includes("icon")) {
    const value = bail(
      await select<IconValue>({
        message: "Pick a profile icon style",
        options: iconOptions,
      }),
    );
    icon = { value, label: iconPresets[value].label };
  }

  renderSummary({ features, acrylic, background, icon });

  const proceed = bail(
    await confirm({
      message: "Run the preview installation?",
      initialValue: true,
    }),
  );

  if (!proceed) {
    cancel("Setup cancelled. Nothing was changed.");
    return;
  }

  const s = spinner();
  s.start("Preparing your configuration…");
  await delay(350);
  s.message("Checking preferences…");
  await delay(350);
  s.message("Simulating settings.json update…");
  await delay(500);
  s.stop("Preview complete — no files were changed.");

  outro(
    [
      `${pc.green("✓")} pimpt is ready for the next step.`,
      pc.dim("Real settings.json integration is not wired up yet."),
    ].join("\n"),
  );
}
