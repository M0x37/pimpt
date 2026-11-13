import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface FontAsset {
  fileName: string;
  fontUrl: string;
  licenseFileName: string;
  licenseUrl: string;
}

const googleFontsRevision = "29b4ec6df2522a8aee279414b78a07910b065874";
const hackRevision = "a737c121cabb337fdfe655d8c7304729f351e30f";
const fontRegistryKeys = [
  "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts",
  "HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts",
];
const userFontsRegistryKey =
  "HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts";

const fontAssets: Record<string, FontAsset> = {
  "Cascadia Mono": {
    fileName: `pimpt-cascadia-mono-${googleFontsRevision.slice(0, 8)}.ttf`,
    fontUrl: `https://raw.githubusercontent.com/google/fonts/${googleFontsRevision}/ofl/cascadiamono/CascadiaMono%5Bwght%5D.ttf`,
    licenseFileName: "pimpt-cascadia-mono-OFL.txt",
    licenseUrl: `https://raw.githubusercontent.com/google/fonts/${googleFontsRevision}/ofl/cascadiamono/OFL.txt`,
  },
  "Cascadia Code": {
    fileName: `pimpt-cascadia-code-${googleFontsRevision.slice(0, 8)}.ttf`,
    fontUrl: `https://raw.githubusercontent.com/google/fonts/${googleFontsRevision}/ofl/cascadiacode/CascadiaCode%5Bwght%5D.ttf`,
    licenseFileName: "pimpt-cascadia-code-OFL.txt",
    licenseUrl: `https://raw.githubusercontent.com/google/fonts/${googleFontsRevision}/ofl/cascadiacode/OFL.txt`,
  },
  "JetBrains Mono": {
    fileName: `pimpt-jetbrains-mono-${googleFontsRevision.slice(0, 8)}.ttf`,
    fontUrl: `https://raw.githubusercontent.com/google/fonts/${googleFontsRevision}/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf`,
    licenseFileName: "pimpt-jetbrains-mono-OFL.txt",
    licenseUrl: `https://raw.githubusercontent.com/google/fonts/${googleFontsRevision}/ofl/jetbrainsmono/OFL.txt`,
  },
  "Fira Code": {
    fileName: `pimpt-fira-code-${googleFontsRevision.slice(0, 8)}.ttf`,
    fontUrl: `https://raw.githubusercontent.com/google/fonts/${googleFontsRevision}/ofl/firacode/FiraCode%5Bwght%5D.ttf`,
    licenseFileName: "pimpt-fira-code-OFL.txt",
    licenseUrl: `https://raw.githubusercontent.com/google/fonts/${googleFontsRevision}/ofl/firacode/OFL.txt`,
  },
  Hack: {
    fileName: `pimpt-hack-${hackRevision.slice(0, 8)}.ttf`,
    fontUrl: `https://raw.githubusercontent.com/source-foundry/Hack/${hackRevision}/build/ttf/Hack-Regular.ttf`,
    licenseFileName: "pimpt-hack-LICENSE.md",
    licenseUrl: `https://raw.githubusercontent.com/source-foundry/Hack/${hackRevision}/LICENSE.md`,
  },
  "Source Code Pro": {
    fileName: `pimpt-source-code-pro-${googleFontsRevision.slice(0, 8)}.ttf`,
    fontUrl: `https://raw.githubusercontent.com/google/fonts/${googleFontsRevision}/ofl/sourcecodepro/SourceCodePro%5Bwght%5D.ttf`,
    licenseFileName: "pimpt-source-code-pro-OFL.txt",
    licenseUrl: `https://raw.githubusercontent.com/google/fonts/${googleFontsRevision}/ofl/sourcecodepro/OFL.txt`,
  },
  "IBM Plex Mono": {
    fileName: `pimpt-ibm-plex-mono-${googleFontsRevision.slice(0, 8)}.ttf`,
    fontUrl: `https://raw.githubusercontent.com/google/fonts/${googleFontsRevision}/ofl/ibmplexmono/IBMPlexMono-Regular.ttf`,
    licenseFileName: "pimpt-ibm-plex-mono-OFL.txt",
    licenseUrl: `https://raw.githubusercontent.com/google/fonts/${googleFontsRevision}/ofl/ibmplexmono/OFL.txt`,
  },
};

function assertWindows(): void {
  if (process.platform !== "win32") {
    throw new Error("Automatic font installation is only available on Windows.");
  }
}

function queryFontRegistry(key: string): string {
  const result = spawnSync("reg.exe", ["query", key], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) {
    throw new Error(`Could not query the Windows font registry: ${result.error.message}`, {
      cause: result.error,
    });
  }
  if (result.status === 1) return "";
  if (result.status !== 0) {
    throw new Error(
      `Could not query the Windows font registry: ${result.stderr.trim() || `reg.exe exited with code ${String(result.status)}`}`,
    );
  }
  return result.stdout;
}

export function isFontInstalled(fontFamily: string): boolean {
  assertWindows();
  const family = fontFamily.toLocaleLowerCase("en-US");
  return fontRegistryKeys
    .map(queryFontRegistry)
    .join("\n")
    .split(/\r?\n/)
    .some((line) => line.trimStart().toLocaleLowerCase("en-US").startsWith(family));
}

export function canInstallFont(fontFamily: string): boolean {
  return fontAssets[fontFamily] !== undefined;
}

async function download(url: string, description: string): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  } catch (error) {
    throw new Error(`Could not download ${description}: ${String(error)}`, {
      cause: error,
    });
  }

  if (!response.ok) {
    throw new Error(`Could not download ${description}: HTTP ${response.status}.`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  if (data.length === 0 || data.length > 30_000_000) {
    throw new Error(`Downloaded ${description} has an invalid file size.`);
  }
  return data;
}

function isFontFile(data: Buffer): boolean {
  return (
    (data[0] === 0 && data[1] === 1 && data[2] === 0 && data[3] === 0) ||
    data.toString("ascii", 0, 4) === "OTTO"
  );
}

export async function installFont(fontFamily: string): Promise<void> {
  assertWindows();
  const asset = fontAssets[fontFamily];
  if (!asset) {
    throw new Error(`Automatic installation is not supported for ${fontFamily}.`);
  }

  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    throw new Error("LOCALAPPDATA is not set; the font cannot be installed.");
  }

  const [fontData, licenseData] = await Promise.all([
    download(asset.fontUrl, `${fontFamily} font`),
    download(asset.licenseUrl, `${fontFamily} license`),
  ]);
  if (!isFontFile(fontData)) {
    throw new Error(`The downloaded ${fontFamily} file is not a valid TrueType/OpenType font.`);
  }

  const licenseText = licenseData.toString("utf8").toLowerCase();
  if (!licenseText.includes("license")) {
    throw new Error(`The downloaded ${fontFamily} license file is invalid.`);
  }

  const fontDirectory = join(localAppData, "Microsoft", "Windows", "Fonts");
  await mkdir(fontDirectory, { recursive: true });

  const fontPath = join(fontDirectory, asset.fileName);
  const licensePath = join(fontDirectory, asset.licenseFileName);
  await writeFile(fontPath, fontData);
  await writeFile(licensePath, licenseData);

  execFileSync(
    "reg.exe",
    [
      "add",
      userFontsRegistryKey,
      "/v",
      `${fontFamily} (TrueType)`,
      "/t",
      "REG_SZ",
      "/d",
      fontPath,
      "/f",
    ],
    { encoding: "utf8", windowsHide: true, stdio: "pipe" },
  );
}
