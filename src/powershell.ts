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
    | "lazy git"
    | "git completion"
    | "cross-drive cd"
    | "cross-drive cd alias"
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

const lazyGitFunctionLines = [
  "function lg {",
  "  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {",
  "    Write-Host 'lg: git was not found on PATH.' -ForegroundColor Red",
  "    return",
  "  }",
  "  $repoRoot = git rev-parse --show-toplevel 2>$null",
  "  if (-not $repoRoot) {",
  "    Write-Host 'lg: not inside a Git repository.' -ForegroundColor Red",
  "    return",
  "  }",
  "  $message = $null",
  "  while ($true) {",
  "    Clear-Host",
  "    $branch = (git rev-parse --abbrev-ref HEAD 2>$null)",
  "    if (-not $branch) { $branch = 'DETACHED' }",
  "    $upstream = git rev-parse --abbrev-ref '@{upstream}' 2>$null",
  "    $aheadBehind = ''",
  "    if ($upstream) {",
  "      $counts = (git rev-list --left-right --count 'HEAD...@{upstream}' 2>$null) -split '\\s+'",
  "      if ($counts.Count -ge 2) {",
  "        $aheadBehind = \"  ↑$($counts[0]) ↓$($counts[1])\"",
  "      }",
  "    }",
  "    Write-Host '╭─ lazy git ─────────────────────────────────────────╮' -ForegroundColor Cyan",
  "    Write-Host (\"│ {0}{1}\" -f $branch, $aheadBehind) -ForegroundColor Yellow",
  "    Write-Host (\"│ {0}\" -f $repoRoot) -ForegroundColor DarkGray",
  "    Write-Host '╰────────────────────────────────────────────────────╯' -ForegroundColor Cyan",
  "    if ($message) {",
  "      Write-Host $message -ForegroundColor DarkGray",
  "      Write-Host ''",
  "      $message = $null",
  "    }",
  "    $status = @(git status --porcelain -uall 2>$null)",
  "    $entries = @()",
  "    Write-Host 'Staged' -ForegroundColor Green",
  "    $staged = @($status | Where-Object { $_[0] -match '[MADRCU]' })",
  "    if ($staged.Count -eq 0) { Write-Host '  (none)' -ForegroundColor DarkGray }",
  "    foreach ($line in $staged) {",
  "      $path = $line.Substring(3)",
  "      $entries += [pscustomobject]@{ Path = $path; Area = 'staged' }",
  "      Write-Host (\"  [{0,2}] {1}  {2}\" -f $entries.Count, $line.Substring(0, 2).Trim(), $path) -ForegroundColor Green",
  "    }",
  "    Write-Host ''",
  "    Write-Host 'Unstaged / Untracked' -ForegroundColor Magenta",
  "    $worktree = @($status | Where-Object { $_[1] -match '[MADRCU?]' -or $_.StartsWith('??') -or $_.StartsWith('!!') })",
  "    if ($worktree.Count -eq 0) { Write-Host '  (clean)' -ForegroundColor DarkGray }",
  "    foreach ($line in $worktree) {",
  "      $path = $line.Substring(3)",
  "      $entries += [pscustomobject]@{ Path = $path; Area = 'worktree' }",
  "      $color = if ($line.StartsWith('??')) { 'DarkYellow' } else { 'Magenta' }",
  "      Write-Host (\"  [{0,2}] {1}  {2}\" -f $entries.Count, $line.Substring(0, 2).TrimEnd(), $path) -ForegroundColor $color",
  "    }",
  "    Write-Host ''",
  "    Write-Host ' a stage all   u unstage all   # toggle file   c commit' -ForegroundColor DarkGray",
  "    Write-Host ' p push        P pull          b branches      l log' -ForegroundColor DarkGray",
  "    Write-Host ' d diff        z stash         r refresh       q quit' -ForegroundColor DarkGray",
  "    Write-Host ''",
  "    Write-Host -NoNewline 'lg> ' -ForegroundColor Cyan",
  "    $key = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')",
  "    $char = [string]$key.Character",
  "    if ($key.VirtualKeyCode -eq 27 -or $char -eq 'q') { Clear-Host; return }",
  "    if ($char -eq 'r' -or $key.VirtualKeyCode -eq 13) { continue }",
  "    if ($char -eq 'a') {",
  "      git add -A | Out-Null",
  "      $message = 'Staged all changes.'",
  "      continue",
  "    }",
  "    if ($char -eq 'u') {",
  "      git restore --staged :/ 2>$null | Out-Null",
  "      if ($LASTEXITCODE -ne 0) { git reset HEAD -- . 2>$null | Out-Null }",
  "      $message = 'Unstaged all changes.'",
  "      continue",
  "    }",
  "    if ($char -match '^[0-9]$' -or $char -eq '#') {",
  "      $pick = if ($char -match '^[1-9]$' -and $entries.Count -le 9) { $char } else { Read-Host 'File number' }",
  "      $index = 0",
  "      if (-not [int]::TryParse($pick, [ref]$index) -or $index -lt 1 -or $index -gt $entries.Count) {",
  "        $message = 'Invalid file number.'",
  "        continue",
  "      }",
  "      $entry = $entries[$index - 1]",
  "      if ($entry.Area -eq 'staged') {",
  "        git restore --staged -- $entry.Path 2>$null | Out-Null",
  "        if ($LASTEXITCODE -ne 0) { git reset HEAD -- $entry.Path 2>$null | Out-Null }",
  "        $message = \"Unstaged $($entry.Path)\"",
  "      } else {",
  "        git add -- $entry.Path | Out-Null",
  "        $message = \"Staged $($entry.Path)\"",
  "      }",
  "      continue",
  "    }",
  "    if ($char -eq 'c') {",
  "      if (@(git diff --cached --name-only).Count -eq 0) {",
  "        $message = 'Nothing staged to commit.'",
  "        continue",
  "      }",
  "      $commitMessage = Read-Host 'Commit message'",
  "      if (-not $commitMessage) { $message = 'Commit cancelled.'; continue }",
  "      git commit -m $commitMessage",
  "      $message = if ($LASTEXITCODE -eq 0) { 'Commit created.' } else { 'Commit failed.' }",
  "      continue",
  "    }",
  "    if ($char -eq 'p') {",
  "      git push",
  "      Write-Host 'Press any key…' -ForegroundColor DarkGray",
  "      [void]$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')",
  "      continue",
  "    }",
  "    if ($char -eq 'P') {",
  "      git pull --ff-only",
  "      Write-Host 'Press any key…' -ForegroundColor DarkGray",
  "      [void]$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')",
  "      continue",
  "    }",
  "    if ($char -eq 'b') {",
  "      $branches = @(git for-each-ref --format='%(refname:short)' refs/heads)",
  "      for ($i = 0; $i -lt $branches.Count; $i++) {",
  "        $mark = if ($branches[$i] -eq $branch) { '*' } else { ' ' }",
  "        Write-Host (\"  {0} [{1,2}] {2}\" -f $mark, ($i + 1), $branches[$i])",
  "      }",
  "      $pick = Read-Host 'Branch number (empty cancels)'",
  "      $index = 0",
  "      if ([int]::TryParse($pick, [ref]$index) -and $index -ge 1 -and $index -le $branches.Count) {",
  "        git checkout $branches[$index - 1]",
  "        Write-Host 'Press any key…' -ForegroundColor DarkGray",
  "        [void]$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')",
  "      }",
  "      continue",
  "    }",
  "    if ($char -eq 'l') {",
  "      git --no-pager log --oneline --decorate -n 20",
  "      Write-Host 'Press any key…' -ForegroundColor DarkGray",
  "      [void]$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')",
  "      continue",
  "    }",
  "    if ($char -eq 'd') {",
  "      git --no-pager diff",
  "      Write-Host 'Press any key…' -ForegroundColor DarkGray",
  "      [void]$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')",
  "      continue",
  "    }",
  "    if ($char -eq 'z') {",
  "      $stashAction = Read-Host 'Stash action: [s]ave / [p]op / [l]ist'",
  "      if ($stashAction -eq 's') {",
  "        $stashMessage = Read-Host 'Stash message (optional)'",
  "        if ($stashMessage) { git stash push -m $stashMessage } else { git stash push }",
  "      } elseif ($stashAction -eq 'p') {",
  "        git stash pop",
  "      } else {",
  "        git stash list",
  "        Write-Host 'Press any key…' -ForegroundColor DarkGray",
  "        [void]$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')",
  "      }",
  "      continue",
  "    }",
  "  }",
  "}",
];

const gitCompletionLines = [
  "Register-ArgumentCompleter -Native -CommandName git -ScriptBlock {",
  "  param($wordToComplete, $commandAst, $cursorPosition)",
  "  $tokens = @($commandAst.CommandElements | ForEach-Object { $_.Extent.Text })",
  "  if ($tokens.Count -le 1) {",
  "    $commands = @('add','branch','checkout','cherry-pick','clone','commit','diff','fetch','init','log','merge','pull','push','rebase','remote','reset','restore','stash','status','switch','tag')",
  "    $commands | Where-Object { $_ -like \"$wordToComplete*\" } | ForEach-Object {",
  "      [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)",
  "    }",
  "    return",
  "  }",
  "  $sub = $tokens[1]",
  "  if ($sub -in @('checkout','switch','branch','merge','rebase','log')) {",
  "    git for-each-ref --format='%(refname:short)' refs/heads refs/remotes 2>$null |",
  "      Where-Object { $_ -like \"$wordToComplete*\" } |",
  "      ForEach-Object {",
  "        [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)",
  "      }",
  "    return",
  "  }",
  "  if ($sub -in @('add','restore','reset','diff','rm')) {",
  "    git status --porcelain -uall 2>$null | ForEach-Object {",
  "      if ($_.Length -ge 4) { $_.Substring(3) }",
  "    } | Where-Object { $_ -like \"$wordToComplete*\" } | ForEach-Object {",
  "      [System.Management.Automation.CompletionResult]::new($_, $_, 'ProviderItem', $_)",
  "    }",
  "  }",
  "}",
];

export function addLazyGitToPowerShellProfile(): void {
  addPowerShellProfileBlock(
    "lazy git",
    lazyGitFunctionLines,
    "Adding the lazygit-style lg command to the Windows PowerShell profile",
  );
  addPowerShellProfileBlock(
    "git completion",
    gitCompletionLines,
    "Adding Git tab completion to the Windows PowerShell profile",
  );
}

const crossDriveCdLines = [
  "function cd {",
  "  [CmdletBinding()]",
  "  param(",
  "    [Parameter(Position = 0, ValueFromRemainingArguments = $true)]",
  "    [string[]]$Path",
  "  )",
  "  if (-not $Path -or $Path.Count -eq 0) {",
  "    Set-Location -LiteralPath $HOME",
  "    return",
  "  }",
  "  $parts = @($Path)",
  "  if ($parts[0] -match '^[/_-]d$' -and $parts.Count -ge 2) {",
  "    $parts = $parts[1..($parts.Count - 1)]",
  "  }",
  "  $target = ($parts -join ' ').Trim()",
  "  if (-not $target) {",
  "    Set-Location -LiteralPath $HOME",
  "    return",
  "  }",
  "  if ($target -match '^[A-Za-z]:?$') {",
  "    $letter = $target.Substring(0, 1).ToUpperInvariant()",
  "    $root = $letter + ':\\'",
  "    if (-not (Test-Path -LiteralPath $root)) {",
  "      Write-Host (\"cd: drive {0}: is not available.\" -f $letter) -ForegroundColor Red",
  "      return",
  "    }",
  "    try {",
  "      Set-Location -LiteralPath ($letter + ':')",
  "    } catch {",
  "      Set-Location -LiteralPath $root",
  "    }",
  "    return",
  "  }",
  "  try {",
  "    Set-Location -Path $target",
  "  } catch {",
  "    Write-Host (\"cd: {0}\" -f $_.Exception.Message) -ForegroundColor Red",
  "  }",
  "}",
];

export function addCrossDriveCdToPowerShellProfile(): void {
  addPowerShellProfileBlock(
    "cross-drive cd alias",
    ["Remove-Item Alias:cd -Force -ErrorAction SilentlyContinue"],
    "Enabling cross-drive cd in the Windows PowerShell profile",
  );
  addPowerShellProfileBlock(
    "cross-drive cd",
    crossDriveCdLines,
    "Adding cross-drive cd to the Windows PowerShell profile",
  );
}

export interface PowerShellProfileFeatures {
  terminalIcons: boolean;
  historyPreview: boolean;
  lazyGit: boolean;
  crossDriveCd: boolean;
  treeListing: boolean;
}

export function readPowerShellProfileFeatures(): PowerShellProfileFeatures {
  const features: PowerShellProfileFeatures = {
    terminalIcons: false,
    historyPreview: false,
    lazyGit: false,
    crossDriveCd: false,
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
  features.lazyGit = hasBlock("lazy git");
  features.crossDriveCd = hasBlock("cross-drive cd");
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
