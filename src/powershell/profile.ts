import { execFileSync } from 'node:child_process';

const beginMarker = (feature: string) => `# >>> pimpt ${feature} >>>`;
const endMarker = (feature: string) => `# <<< pimpt ${feature} <<<`;

export function addPowerShellProfileBlock(
  feature:
    | 'terminal icons'
    | 'command history preview'
    | 'lazy git'
    | 'git completion'
    | 'cross-drive cd'
    | 'cross-drive cd v2'
    | 'cross-drive cd v3'
    | 'cross-drive cd alias'
    | 'tree-style ls'
    | 'tree-style ls alias'
    | 'tree-style ls v2'
    | 'powershell aliases',
  commands: string[],
  operation: string
): void {
  const block = [beginMarker(feature), ...commands, endMarker(feature)].join('\r\n');
  const encodedMarker = Buffer.from(beginMarker(feature), 'utf16le').toString('base64');
  const encodedBlock = Buffer.from(block, 'utf16le').toString('base64');
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

export function removePowerShellProfileBlock(feature: string): void {
  const beginMarkerStr = `# >>> pimpt ${feature} >>>`;
  const endMarkerStr = `# <<< pimpt ${feature} <<<`;
  const encodedBegin = Buffer.from(beginMarkerStr, 'utf16le').toString('base64');
  const encodedEnd = Buffer.from(endMarkerStr, 'utf16le').toString('base64');
  const script = String.raw`$ErrorActionPreference = 'Stop'
$profilePath = $PROFILE.CurrentUserCurrentHost
if (-not (Test-Path -LiteralPath $profilePath)) { exit 0 }
$content = Get-Content -LiteralPath $profilePath -Raw
$begin = [System.Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encodedBegin}'))
$end = [System.Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encodedEnd}'))
$beginIdx = $content.IndexOf($begin)
$endIdx = $content.IndexOf($end)
if ($beginIdx -ge 0 -and $endIdx -ge 0) {
  $endIdx = $endIdx + $end.Length
  $newContent = ($content.Substring(0, $beginIdx) + $content.Substring($endIdx)).TrimStart([char]10, [char]13)
  Set-Content -LiteralPath $profilePath -Value $newContent -Encoding UTF8
}`;
  runPowerShell(script, `Removing pimpt ${feature} from the Windows PowerShell profile`);
}

export function runPowerShell(script: string, operation: string): void {
  if (process.platform !== 'win32') {
    console.warn(
      `[pimpt] ${operation} is only supported on Windows. Skipping.`
    );
    return;
  }

  try {
    execFileSync(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
      { encoding: 'utf8', windowsHide: true, stdio: 'pipe' }
    );
  } catch (error) {
    throw new Error(`${operation} failed: ${String(error)}`, { cause: error });
  }
}

export function addTerminalIconsToPowerShellProfile(): void {
  addPowerShellProfileBlock(
    'terminal icons',
    ['Import-Module Terminal-Icons -ErrorAction Stop'],
    'Adding Terminal-Icons to the Windows PowerShell profile'
  );
}

export function addHistoryPreviewToPowerShellProfile(): void {
  addPowerShellProfileBlock(
    'command history preview',
    [
      "Import-Module PSReadLine -RequiredVersion '2.4.5' -Force -ErrorAction Stop",
      'Set-PSReadLineOption -PredictionSource History -PredictionViewStyle ListView',
    ],
    'Adding command history preview to the Windows PowerShell profile'
  );
}

export function addPowerShellAliasesToPowerShellProfile(): void {
  addPowerShellProfileBlock(
    'powershell aliases',
    [
      '# >>> pimpt powershell aliases >>>',
      'Set-Alias ll Get-ChildItem -Force -ErrorAction SilentlyContinue',
      'Set-Alias la Get-ChildItem -Force -ErrorAction SilentlyContinue',
      'function .. { Set-Location .. }',
      'function ... { Set-Location ../.. }',
      'Set-Alias grep Select-String -ErrorAction SilentlyContinue',
      'Set-Alias wget Invoke-WebRequest -ErrorAction SilentlyContinue',
      'Set-Alias curl Invoke-WebRequest -ErrorAction SilentlyContinue',
      '# <<< pimpt powershell aliases <<<',
    ],
    'Adding PowerShell aliases to the Windows PowerShell profile'
  );
}

/**
 * PowerShell-Profil-Features mit Caching für schnelle Ausführung auf langsamen Systemen.
 * Der Profil-Inhalt wird maximal einmal pro Prozess gelesen und wiederverwendet.
 */
let cachedProfile: string | null = null;
let cacheLoaded = false;

function loadProfileOnce(): string {
  if (cacheLoaded) return cachedProfile ?? '';

  try {
    const encoded = execFileSync(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        String.raw`$profilePath = $PROFILE.CurrentUserCurrentHost
if (Test-Path -LiteralPath $profilePath) {
  $content = [System.IO.File]::ReadAllText($profilePath)
  [Console]::Out.Write([Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($content)))
}`,
      ],
      { encoding: 'utf8', windowsHide: true, stdio: 'pipe' }
    ).trim();

    cachedProfile = Buffer.from(encoded, 'base64').toString('utf16le');
  } catch {
    cachedProfile = '';
  }

  cacheLoaded = true;
  return cachedProfile ?? '';
}

export interface PowerShellProfileFeatures {
  terminalIcons: boolean;
  historyPreview: boolean;
  lazyGit: boolean;
  crossDriveCd: boolean;
  treeListing: boolean;
  powershellAliases: boolean;
}

export function readPowerShellProfileFeatures(): PowerShellProfileFeatures {
  const features: PowerShellProfileFeatures = {
    terminalIcons: false,
    historyPreview: false,
    lazyGit: false,
    crossDriveCd: false,
    treeListing: false,
    powershellAliases: false,
  };
  if (process.platform !== 'win32') return features;

  const profile = loadProfileOnce();
  const hasBlock = (name: string) =>
    profile.includes(beginMarker(name)) && profile.includes(endMarker(name));

  features.terminalIcons = hasBlock('terminal icons');
  features.historyPreview = hasBlock('command history preview');
  features.lazyGit = hasBlock('lazy git');
  features.crossDriveCd =
    hasBlock('cross-drive cd v3') || hasBlock('cross-drive cd v2') || hasBlock('cross-drive cd');
  features.treeListing = hasBlock('tree-style ls v2') || hasBlock('tree-style ls');
  features.powershellAliases = hasBlock('powershell aliases');
  return features;
}

export function clearProfileCacheForTesting(): void {
  cachedProfile = null;
  cacheLoaded = false;
}
