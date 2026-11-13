export type Feature = "acrylic" | "background" | "icon";

export interface AcrylicChoice {
  opacity: number;
}

export interface BackgroundChoice {
  name: string;
  hex: string;
}

export interface IconChoice {
  label: string;
  value: string;
}

export interface InstallerChoices {
  features: Feature[];
  acrylic: AcrylicChoice | null;
  background: BackgroundChoice | null;
  icon: IconChoice | null;
}
