import { runPowerShell } from './profile.js';

const terminalIconsVersion = '0.11.0';
const psReadLineVersion = '2.4.5';

function installPowerShellGalleryModule(
  moduleName: 'Terminal-Icons' | 'PSReadLine',
  version: string,
  allowClobber: boolean
): void {
  const clobberOption = allowClobber ? '-AllowClobber ' : '';
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

export function installTerminalIconsModule(): void {
  installPowerShellGalleryModule('Terminal-Icons', terminalIconsVersion, false);
}

export function installPSReadLineModule(): void {
  installPowerShellGalleryModule('PSReadLine', psReadLineVersion, true);
}
