import { execFileSync } from "node:child_process";

const terminalIconsVersion = "0.11.0";
const psReadLineVersion = "2.4.5";

function runPowerShell(script: string, operation: string): void {
  if (process.platform !== "win32") {
    throw new Error(`${operation} is only supported on Windows.`);
  }

  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        script,
      ],
      { encoding: "utf8", windowsHide: true, stdio: "pipe" },
    );
  } catch (error) {
    throw new Error(`${operation} failed: ${String(error)}`, { cause: error });
  }
}

function installPowerShellGalleryModule(
  moduleName: "Terminal-Icons" | "PSReadLine",
  version: string,
  allowClobber: boolean,
): void {
  const clobberOption = allowClobber ? "-AllowClobber " : "";
  const script = String.raw`$ErrorActionPreference = 'Stop'
$protocols = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
[Net.ServicePointManager]::SecurityProtocol = $protocols
$nugetProvider = Get-PackageProvider -Name NuGet -ListAvailable -ErrorAction SilentlyContinue
if (-not $nugetProvider) {
  Install-PackageProvider -Name NuGet -MinimumVersion '2.8.5.201' -Scope CurrentUser -Force -Confirm:$false -ErrorAction Stop | Out-Null
}

$requiredVersion = [version]'${version}'
$module = Get-Module -ListAvailable -Name '${moduleName}' | Where-Object { $_.Version -eq $requiredVersion }
if (-not $module) {
  Install-Module -Name '${moduleName}' -RequiredVersion '${version}' -Scope CurrentUser -Repository PSGallery ${clobberOption}-Force -Confirm:$false -ErrorAction Stop
}

$module = Get-Module -ListAvailable -Name '${moduleName}' | Where-Object { $_.Version -eq $requiredVersion }
if (-not $module) {
  throw '${moduleName} ${version} is not available after installation.'
}`;
  runPowerShell(script, `Installing the ${moduleName} PowerShell module`);
}

function addPowerShellProfileBlock(
  feature:
    | "terminal icons"
    | "command history preview"
    | "tree-style ls"
    | "tree-style ls alias"
    | "tree-style ls v2",
  commands: string[],
  operation: string,
): void {
  const beginMarker = `# >>> pimpt ${feature} >>>`;
  const endMarker = `# <<< pimpt ${feature} <<<`;
  const block = [beginMarker, ...commands, endMarker].join("\r\n");
  const encodedMarker = Buffer.from(beginMarker, "utf16le").toString("base64");
  const encodedBlock = Buffer.from(block, "utf16le").toString("base64");
  const script = String.raw`$ErrorActionPreference = 'Stop'
$profilePath = $PROFILE.CurrentUserCurrentHost
$profileDirectory = Split-Path -Parent $profilePath
if (-not (Test-Path -LiteralPath $profileDirectory)) {
  New-Item -ItemType Directory -Path $profileDirectory -Force | Out-Null
}

$profileContent = ''
if (Test-Path -LiteralPath $profilePath) {
  $profileContent = Get-Content -LiteralPath $profilePath -Raw
}

$beginMarker = [System.Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encodedMarker}'))
if ($profileContent -notmatch [regex]::Escape($beginMarker)) {
  if (-not (Test-Path -LiteralPath $profilePath)) {
    New-Item -ItemType File -Path $profilePath -Force | Out-Null
  }

  $encoding = 'Default'
  $bytes = [System.IO.File]::ReadAllBytes($profilePath)
  if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
    $encoding = 'Unicode'
  } elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
    $encoding = 'BigEndianUnicode'
  } elseif ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    $encoding = 'UTF8'
  }

  $profileBlock = [System.Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encodedBlock}'))
  $newline = [Environment]::NewLine
  $separator = if ($profileContent.Length -gt 0 -and -not $profileContent.EndsWith([string][char]10)) { $newline } else { '' }
  Add-Content -LiteralPath $profilePath -Encoding $encoding -Value "$separator$profileBlock"
}`;
  runPowerShell(script, operation);
}

export function installTerminalIconsModule(): void {
  installPowerShellGalleryModule(
    "Terminal-Icons",
    terminalIconsVersion,
    false,
  );
}

export function installPSReadLineModule(): void {
  installPowerShellGalleryModule("PSReadLine", psReadLineVersion, true);
}

export function addTerminalIconsToPowerShellProfile(): void {
  addPowerShellProfileBlock(
    "terminal icons",
    ["Import-Module Terminal-Icons -ErrorAction Stop"],
    "Adding Terminal-Icons to the Windows PowerShell profile",
  );
}

export function addHistoryPreviewToPowerShellProfile(): void {
  addPowerShellProfileBlock(
    "command history preview",
    [
      `Import-Module PSReadLine -RequiredVersion '${psReadLineVersion}' -Force -ErrorAction Stop`,
      "Set-PSReadLineOption -PredictionSource History -PredictionViewStyle ListView",
    ],
    "Adding command history preview to the Windows PowerShell profile",
  );
}

export interface PowerShellProfileFeatures {
  terminalIcons: boolean;
  historyPreview: boolean;
  treeListing: boolean;
}

export function readPowerShellProfileFeatures(): PowerShellProfileFeatures {
  const features: PowerShellProfileFeatures = {
    terminalIcons: false,
    historyPreview: false,
    treeListing: false,
  };
  if (process.platform !== "win32") return features;

  let encodedProfile: string;
  try {
    encodedProfile = execFileSync(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        String.raw`$profilePath = $PROFILE.CurrentUserCurrentHost
if (Test-Path -LiteralPath $profilePath) {
  $content = [System.IO.File]::ReadAllText($profilePath)
  [Console]::Out.Write([Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($content)))
}`,
      ],
      { encoding: "utf8", windowsHide: true, stdio: "pipe" },
    ).trim();
  } catch (error) {
    throw new Error("Could not inspect the Windows PowerShell profile.", {
      cause: error,
    });
  }

  const profile = Buffer.from(encodedProfile, "base64").toString("utf16le");
  const hasBlock = (name: string) =>
    profile.includes(`# >>> pimpt ${name} >>>`) &&
    profile.includes(`# <<< pimpt ${name} <<<`);

  features.terminalIcons = hasBlock("terminal icons");
  features.historyPreview = hasBlock("command history preview");
  features.treeListing =
    hasBlock("tree-style ls v2") || hasBlock("tree-style ls");
  return features;
}

export function addTreeListingToPowerShellProfile(): void {
  addPowerShellProfileBlock(
    "tree-style ls alias",
    ["Remove-Item Alias:ls -Force -ErrorAction SilentlyContinue"],
    "Enabling the tree-style ls command in the Windows PowerShell profile",
  );
  addPowerShellProfileBlock(
    "tree-style ls v2",
    [
      "function ls {",
      "  [CmdletBinding()]",
      "  param(",
      "    [Parameter(Position = 0)] [string]$Path = '.',",
      "    [ValidateRange(1, 32)] [int]$Depth = 4,",
      "    [ValidateRange(1, 10000)] [int]$Limit = 50,",
      "    [switch]$All,",
      "    [switch]$Force",
      "  )",
      "  try {",
      "    $root = Get-Item -LiteralPath $Path -ErrorAction Stop",
      "  } catch {",
      "    Write-Host (\"ls: cannot access '{0}': {1}\" -f $Path, $_.Exception.Message) -ForegroundColor Red",
      "    return",
      "  }",
      "  if (-not $root.PSIsContainer) {",
      "    Write-Host $root.Name -ForegroundColor Gray",
      "    return",
      "  }",
      "  Write-Host $root.FullName -ForegroundColor Cyan",
      "  $state = [pscustomobject]@{ Shown = 0; Limit = $Limit; All = [bool]$All; Truncated = $false }",
      "  $walk = {",
      "    param($Directory, [string]$Prefix, [int]$CurrentDepth, $State)",
      "    if ($CurrentDepth -ge $Depth) { return }",
      "    try {",
      "      $children = @(Get-ChildItem -LiteralPath $Directory.FullName -Force:$Force -ErrorAction Stop | Sort-Object @{ Expression = { if ($_.PSIsContainer) { 0 } else { 1 } } }, Name)",
      "    } catch {",
      "      Write-Host (\"{0}└── [cannot read: {1}]\" -f $Prefix, $_.Exception.Message) -ForegroundColor Red",
      "      return",
      "    }",
      "    for ($index = 0; $index -lt $children.Count; $index++) {",
      "      if (-not $State.All -and $State.Shown -ge $State.Limit) {",
      "        $State.Truncated = $true",
      "        break",
      "      }",
      "      $entry = $children[$index]",
      "      $isLast = $index -eq ($children.Count - 1)",
      "      $connector = if ($isLast) { '└── ' } else { '├── ' }",
      "      $color = if ($entry.PSIsContainer) { 'Cyan' } else { 'Gray' }",
      "      Write-Host ($Prefix + $connector + $entry.Name) -ForegroundColor $color",
      "      $State.Shown++",
      "      if ($entry.PSIsContainer -and ($CurrentDepth + 1 -lt $Depth)) {",
      "        $childPrefix = $Prefix + $(if ($isLast) { '    ' } else { '│   ' })",
      "        & $walk $entry $childPrefix ($CurrentDepth + 1) $State",
      "        if ($State.Truncated) { break }",
      "      }",
      "    }",
      "  }",
      "  & $walk $root '' 0 $state",
      "  if ($state.Truncated) {",
      "    Write-Host (\"… output capped at {0} entries (use -Limit <number> or -All)\" -f $state.Limit) -ForegroundColor DarkGray",
      "  }",
      "}",
    ],
    "Adding the tree-style ls command to the Windows PowerShell profile",
  );
}
