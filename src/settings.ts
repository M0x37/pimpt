export type SettingValue = string | boolean;

export type SettingGroup =
  | "Appearance"
  | "Colors"
  | "Window & tabs"
  | "Profile"
  | "Behavior";

export interface Choice {
  value: string;
  label: string;
  hint: string;
}

export type Prompt =
  | {
      kind: "select";
      message: string;
      options: Choice[];
      initialValue: string;
    }
  | {
      kind: "text";
      message: string;
      placeholder: string;
      initialValue: string;
      validate?: (value: string | undefined) => string | undefined;
    }
  | {
      kind: "confirm";
      message: string;
      initialValue: boolean;
    };

export interface SettingDefinition {
  id: string;
  group: SettingGroup;
  label: string;
  hint: string;
  prompt: Prompt;
  summarize: (value: SettingValue) => string;
}

export const BACKGROUND_CUSTOM = "custom";

const transparencyOptions: Choice[] = [
  { value: "off", label: "Off", hint: "Solid background" },
  { value: "90", label: "Subtle", hint: "90% opacity" },
  { value: "80", label: "Balanced", hint: "80% opacity" },
  { value: "70", label: "Frosted", hint: "70% opacity" },
  { value: "50", label: "Heavy", hint: "50% opacity" },
];

const backgroundOptions: Choice[] = [
  { value: "keep", label: "Keep current", hint: "Leave the background unchanged" },
  { value: "#0B1021", label: "Midnight", hint: "#0B1021" },
  { value: "#2E3440", label: "Nord", hint: "#2E3440" },
  { value: "#282A36", label: "Dracula", hint: "#282A36" },
  { value: "#002B36", label: "Solarized Dark", hint: "#002B36" },
  {
    value: BACKGROUND_CUSTOM,
    label: "Custom hex",
    hint: "Enter your own color",
  },
];

const fontOptions: Choice[] = [
  { value: "keep", label: "Keep current", hint: "Use the configured font" },
  { value: "Cascadia Mono", label: "Cascadia Mono", hint: "Windows Terminal default" },
  { value: "Cascadia Code", label: "Cascadia Code", hint: "Ligatures included" },
  { value: "Consolas", label: "Consolas", hint: "Classic Windows font" },
  { value: "JetBrains Mono", label: "JetBrains Mono", hint: "Popular developer font" },
  { value: "Fira Code", label: "Fira Code", hint: "Monospace with ligatures" },
];

const fontSizeOptions: Choice[] = ["10", "11", "12", "14", "16", "18"].map(
  (value) => ({ value, label: `${value} pt`, hint: "Points" }),
);

const cursorOptions: Choice[] = [
  { value: "keep", label: "Keep current", hint: "Use the configured cursor" },
  { value: "bar", label: "Bar", hint: "Thin vertical line" },
  { value: "filledBox", label: "Block", hint: "Filled rectangle" },
  { value: "underscore", label: "Underline", hint: "Line below the text" },
  { value: "vintage", label: "Vintage", hint: "Retro terminal blink" },
];

const schemeOptions: Choice[] = [
  { value: "keep", label: "Keep current", hint: "Use the configured scheme" },
  { value: "Campbell", label: "Campbell", hint: "Windows Terminal default" },
  { value: "One Half Dark", label: "One Half Dark", hint: "Cool, muted palette" },
  { value: "Solarized Dark", label: "Solarized Dark", hint: "Low-contrast classic" },
  { value: "Tango Dark", label: "Tango Dark", hint: "Colorful and warm" },
  { value: "Vintage", label: "Vintage", hint: "Retro phosphor look" },
];

const launchModeOptions: Choice[] = [
  { value: "default", label: "Windowed", hint: "Normal window" },
  { value: "maximized", label: "Maximized", hint: "Fill the screen" },
  { value: "fullscreen", label: "Fullscreen", hint: "Hide the window frame" },
  { value: "focus", label: "Focus mode", hint: "Minimal distractions" },
  {
    value: "maximizedFocus",
    label: "Maximized focus",
    hint: "Maximized and distraction-free",
  },
];

const appThemeOptions: Choice[] = [
  { value: "system", label: "System", hint: "Follow Windows" },
  { value: "dark", label: "Dark", hint: "Always dark" },
  { value: "light", label: "Light", hint: "Always light" },
];

const tabLayoutOptions: Choice[] = [
  { value: "titlebar", label: "Tabs in titlebar", hint: "Compact, modern layout" },
  { value: "separate", label: "Separate tab row", hint: "Tabs below the titlebar" },
];

const tabWidthOptions: Choice[] = [
  { value: "equal", label: "Equal", hint: "All tabs share the width" },
  { value: "titleLength", label: "Title length", hint: "Width fits the title" },
  { value: "compact", label: "Compact", hint: "Shrink to fit" },
];

const iconOptions: Choice[] = [
  { value: "classic", label: "Classic terminal", hint: "Monochrome prompt glyph" },
  { value: "rocket", label: "Rocket", hint: "Launch-ready" },
  { value: "bolt", label: "Bolt", hint: "Fast and loud" },
  { value: "code", label: "Code", hint: "Developer vibes" },
];

function labelOf(options: Choice[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function onOff(value: SettingValue): string {
  return value === true ? "Enabled" : "Disabled";
}

export const settings: SettingDefinition[] = [
  {
    id: "transparency",
    group: "Appearance",
    label: "Transparency",
    hint: "Acrylic material and opacity",
    prompt: {
      kind: "select",
      message: "How transparent should the window be?",
      options: transparencyOptions,
      initialValue: "80",
    },
    summarize: (value) =>
      value === "off" ? "Off" : `Acrylic · ${String(value)}% opacity`,
  },
  {
    id: "background",
    group: "Appearance",
    label: "Background color",
    hint: "Palette preset or custom hex",
    prompt: {
      kind: "select",
      message: "Pick a background color",
      options: backgroundOptions,
      initialValue: "keep",
    },
    summarize: (value) => {
      if (value === "keep") return "Keep current";
      const preset = backgroundOptions.find(
        (option) => option.value === value && option.value !== "keep" && option.value !== BACKGROUND_CUSTOM,
      );
      return preset ? `${preset.label} (${preset.value})` : `Custom (${String(value)})`;
    },
  },
  {
    id: "backgroundImage",
    group: "Appearance",
    label: "Background image",
    hint: "Path to a local image",
    prompt: {
      kind: "text",
      message: "Path to a background image (leave empty to skip)",
      placeholder: "C:\\Users\\you\\wallpaper.png",
      initialValue: "",
    },
    summarize: (value) => (String(value).trim() ? String(value) : "Not set"),
  },
  {
    id: "fontFace",
    group: "Appearance",
    label: "Font",
    hint: "Typeface used in the terminal",
    prompt: {
      kind: "select",
      message: "Choose a font",
      options: fontOptions,
      initialValue: "keep",
    },
    summarize: (value) => labelOf(fontOptions, String(value)),
  },
  {
    id: "fontSize",
    group: "Appearance",
    label: "Font size",
    hint: "Text size in points",
    prompt: {
      kind: "select",
      message: "Choose a font size",
      options: fontSizeOptions,
      initialValue: "12",
    },
    summarize: (value) => `${String(value)} pt`,
  },
  {
    id: "cursorShape",
    group: "Appearance",
    label: "Cursor",
    hint: "Shape of the text cursor",
    prompt: {
      kind: "select",
      message: "Choose a cursor shape",
      options: cursorOptions,
      initialValue: "keep",
    },
    summarize: (value) => labelOf(cursorOptions, String(value)),
  },
  {
    id: "colorScheme",
    group: "Colors",
    label: "Color scheme",
    hint: "ANSI palette for text and accents",
    prompt: {
      kind: "select",
      message: "Choose a color scheme",
      options: schemeOptions,
      initialValue: "keep",
    },
    summarize: (value) => labelOf(schemeOptions, String(value)),
  },
  {
    id: "launchMode",
    group: "Window & tabs",
    label: "Launch mode",
    hint: "How the window opens",
    prompt: {
      kind: "select",
      message: "How should Windows Terminal open?",
      options: launchModeOptions,
      initialValue: "default",
    },
    summarize: (value) => labelOf(launchModeOptions, String(value)),
  },
  {
    id: "appTheme",
    group: "Window & tabs",
    label: "Application theme",
    hint: "Light, dark, or follow Windows",
    prompt: {
      kind: "select",
      message: "Choose the application theme",
      options: appThemeOptions,
      initialValue: "system",
    },
    summarize: (value) => labelOf(appThemeOptions, String(value)),
  },
  {
    id: "tabLayout",
    group: "Window & tabs",
    label: "Tab bar",
    hint: "Where the tab row is displayed",
    prompt: {
      kind: "select",
      message: "Where should the tab bar live?",
      options: tabLayoutOptions,
      initialValue: "titlebar",
    },
    summarize: (value) => labelOf(tabLayoutOptions, String(value)),
  },
  {
    id: "tabWidthMode",
    group: "Window & tabs",
    label: "Tab width",
    hint: "How tab widths are calculated",
    prompt: {
      kind: "select",
      message: "How should tabs be sized?",
      options: tabWidthOptions,
      initialValue: "equal",
    },
    summarize: (value) => labelOf(tabWidthOptions, String(value)),
  },
  {
    id: "icon",
    group: "Profile",
    label: "Profile icon",
    hint: "Icon style for your profile",
    prompt: {
      kind: "select",
      message: "Pick a profile icon style",
      options: iconOptions,
      initialValue: "classic",
    },
    summarize: (value) => labelOf(iconOptions, String(value)),
  },
  {
    id: "tabTitle",
    group: "Profile",
    label: "Tab title",
    hint: "Custom title shown on the tab",
    prompt: {
      kind: "text",
      message: "Custom tab title (leave empty for automatic)",
      placeholder: "pimpt",
      initialValue: "",
    },
    summarize: (value) => (String(value).trim() ? String(value) : "Automatic"),
  },
  {
    id: "startingDirectory",
    group: "Profile",
    label: "Starting directory",
    hint: "Folder the shell opens in",
    prompt: {
      kind: "text",
      message: "Starting directory (leave empty for the default)",
      placeholder: "%USERPROFILE%",
      initialValue: "",
    },
    summarize: (value) => (String(value).trim() ? String(value) : "Default"),
  },
  {
    id: "copyOnSelect",
    group: "Behavior",
    label: "Copy on select",
    hint: "Copy text as soon as it is selected",
    prompt: {
      kind: "confirm",
      message: "Copy text automatically when selected?",
      initialValue: false,
    },
    summarize: onOff,
  },
  {
    id: "confirmClose",
    group: "Behavior",
    label: "Confirm close",
    hint: "Ask before closing multiple tabs",
    prompt: {
      kind: "confirm",
      message: "Confirm before closing a window with many tabs?",
      initialValue: true,
    },
    summarize: onOff,
  },
  {
    id: "focusFollowMouse",
    group: "Behavior",
    label: "Focus follows mouse",
    hint: "Focus panes on hover",
    prompt: {
      kind: "confirm",
      message: "Focus panes when hovering with the mouse?",
      initialValue: false,
    },
    summarize: onOff,
  },
  {
    id: "trimPaste",
    group: "Behavior",
    label: "Trim paste",
    hint: "Remove trailing whitespace when pasting",
    prompt: {
      kind: "confirm",
      message: "Trim trailing whitespace when pasting?",
      initialValue: true,
    },
    summarize: onOff,
  },
];

export const groupOrder: SettingGroup[] = [
  "Appearance",
  "Colors",
  "Window & tabs",
  "Profile",
  "Behavior",
];

export function buildGroupedOptions(): Record<string, Choice[]> {
  const grouped: Record<string, Choice[]> = {};

  for (const group of groupOrder) {
    grouped[group] = settings
      .filter((setting) => setting.group === group)
      .map((setting) => ({
        value: setting.id,
        label: setting.label,
        hint: setting.hint,
      }));
  }

  return grouped;
}
