import { execFileSync } from "node:child_process";

const terminalIconsVersion = "0.11.0";
const powerShellProfileScript = String.raw`$ErrorActionPreference = 'Stop'
$profilePath = $PROFILE.CurrentUserCurrentHost
$profileDirectory = Split-Path -Parent $profilePath
if (-not (Test-Path -LiteralPath $profileDirectory)) {
  New-Item -ItemType Directory -Path $profileDirectory -Force | Out-Null
}

$profileContent = ''
if (Test-Path -LiteralPath $profilePath) {
  $profileContent = Get-Content -LiteralPath $profilePath -Raw
}

$beginMarker = '# >>> pimpt terminal icons >>>'
if ($profileContent -notmatch [regex]::Escape($beginMarker)) {
  if (-not (Test-Path -LiteralPath $profilePath)) {
    New-Item -ItemType File -Path $profilePath -Force | Out-Null
  }

  $encoding = 'Default'
  if (Test-Path -LiteralPath $profilePath) {
    $bytes = [System.IO.File]::ReadAllBytes($profilePath)
    if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
      $encoding = 'Unicode'
    } elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
      $encoding = 'BigEndianUnicode'
    } elseif ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
      $encoding = 'UTF8'
    }
  }

  $newline = [Environment]::NewLine
  $separator = if ($profileContent.Length -gt 0 -and -not $profileContent.EndsWith([string][char]10)) { $newline } else { '' }
  $block = @(
    $beginMarker
    'Import-Module Terminal-Icons -ErrorAction Stop'
    '# <<< pimpt terminal icons <<<'
  ) -join $newline
  Add-Content -LiteralPath $profilePath -Encoding $encoding -Value "$separator$block"
}`;

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

export function installTerminalIconsModule(): void {
  const script = String.raw`$ErrorActionPreference = 'Stop'
$protocols = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
[Net.ServicePointManager]::SecurityProtocol = $protocols
$nugetProvider = Get-PackageProvider -Name NuGet -ListAvailable -ErrorAction SilentlyContinue
if (-not $nugetProvider) {
  Install-PackageProvider -Name NuGet -MinimumVersion '2.8.5.201' -Scope CurrentUser -Force -Confirm:$false -ErrorAction Stop | Out-Null
}

$requiredVersion = [version]'${terminalIconsVersion}'
$module = Get-Module -ListAvailable -Name Terminal-Icons | Where-Object { $_.Version -eq $requiredVersion }
if (-not $module) {
  Install-Module -Name Terminal-Icons -RequiredVersion '${terminalIconsVersion}' -Scope CurrentUser -Repository PSGallery -Force -Confirm:$false -ErrorAction Stop
}

$module = Get-Module -ListAvailable -Name Terminal-Icons | Where-Object { $_.Version -eq $requiredVersion }
if (-not $module) {
  throw 'Terminal-Icons ${terminalIconsVersion} is not available after installation.'
}`;
  runPowerShell(script, "Installing the Terminal-Icons PowerShell module");
}

export function addTerminalIconsToPowerShellProfile(): void {
  runPowerShell(
    powerShellProfileScript,
    "Adding Terminal-Icons to the Windows PowerShell profile",
  );
}
