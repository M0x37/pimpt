# pimpt

An interactive setup assistant for Windows Terminal. Choose terminal settings and PowerShell features from a guided menu, review the summary, and confirm before changes are applied.

## Features

### Terminal settings (Windows Terminal `settings.json`)

**Appearance**
- Transparency / acrylic effect (off, 90%, 80%, 70%, 50%, fully transparent)
- Background color (Midnight, Nord, Dracula, Solarized Dark, custom hex, or keep current)
- Background image (custom local path)
- Font (Cascadia Mono, Cascadia Code, Consolas, JetBrains Mono, Fira Code, Hack, Source Code Pro, IBM Plex Mono — missing fonts can be installed automatically)
- Font size (10, 11, 12, 14, 16, 18 pt)
- Cursor shape (bar, block, underline, vintage, or keep current)

**Colors**
- Color scheme (Campbell, One Half Dark, Solarized Dark, Tango Dark, Vintage, or keep current)

**Window & tabs**
- Launch mode (windowed, maximized, fullscreen, focus mode, maximized focus)
- Application theme (system, dark, light)
- Tab bar position (tabs in titlebar, separate tab row)
- Tab width (equal, title length, compact)

**Profile**
- Profile icon style (classic, rocket, bolt, code)
- Custom tab title (or automatic)

**Features**
- Starting directory (relative paths such as `~/Projects` resolve from your user folder; environment variables like `%USERPROFILE%` are supported)

**Behavior**
- Copy on select
- Confirm close (ask before closing windows with many tabs)
- Focus follows mouse
- Trim paste (remove trailing whitespace when pasting)

### PowerShell features

Added to the current user's PowerShell profile inside clearly marked blocks (`# >>> pimpt <feature> >>>`):

- **PowerShell file icons** — installs the Terminal-Icons module and switches Windows Terminal to Hack Nerd Font Mono (installed automatically if missing)
- **Command history preview** — installs PSReadLine 2.4.5 and lets the Up/Down arrows browse recent commands in a scrollable list view
- **Lazy Git (`lg`)** — interactive Git UI for status, staging, commit, push/pull, branches, log, and stash, plus Tab completion for Git commands, branches, and files
- **Smart `cd` (zoxide-style)** — remembers folders you visit and jumps by keyword (`cd pimpt`), supports drive switches (`cd D`, `cd D:`), and interactive picks with `cdi`. `Set-Location` remains available as the built-in behavior.
- **Tree-style `ls`** — shows directory contents as a colored tree (`-Depth`, `-Limit`, `-All`, `-Force`). The original `Get-ChildItem` remains available as `gci`.
- **PowerShell aliases** — `ll`, `la` (listings), `..`, `...` (navigation), `grep`, `wget`, `curl`
- **Hide PowerShell startup banner** — adds `-NoLogo` to Windows PowerShell profile command lines

### Installer (via winget)

Install common development tools directly from pimpt:

- Git — version control
- Python — programming language
- Node.js — JavaScript runtime
- Visual Studio Code — code editor
- Docker Desktop — container platform

Select **Installer** from the main menu, pick a program, and confirm. winget is required.

## Requirements

- Windows 10 or later
- Windows Terminal (Stable, Preview, or Canary)
- Node.js 22 or later
- PowerShell (for PowerShell profile features)

Some optional features install modules from the PowerShell Gallery or download fonts, so an internet connection may be required.

## Install

```powershell
npm install --global @m0x373/pimpt
```

Then start the installer:

```powershell
pimpt
```

The npm package is scoped because npm does not allow this project to publish under the unscoped name `pimpt`.

## Usage

```text
pimpt              Start the interactive installer
pimpt --help       Show help
pimpt --version    Show the installed version
```

When you start `pimpt`, the current version number is shown below the banner.

1. **Choose an area** — `Appearance`, `Features`, `Installer`, or `Other`
2. **Pick settings** — each item shows whether it is already configured
3. **Review the summary** — all selected values are listed before anything is written
4. **Confirm** — changes are applied only after you say yes

Existing Windows Terminal settings are detected and pre-filled so you can see what is already configured.

## Settings safety

- Windows Terminal settings are edited as JSONC, preserving comments and formatting where possible.
- A backup of `settings.json` is created before any change.
- Backups are listed under **Other → Restore settings backup** and can be restored at any time.
- The installer asks for confirmation before applying the selected configuration.
- PowerShell features are added to the current user's PowerShell profile in marked blocks, so they can be identified and removed later.

## Development

```powershell
npm install          Install dependencies
npm test             Run the test suite
npm run typecheck    Type-check with TypeScript
npm run lint         Lint source and tests
npm run format       Format with Prettier
npm run build        Build the ESM bundle to dist/
```

Requires Node.js 22+.

## License

ISC, as declared in the package metadata.

## Links

- [Source repository](https://github.com/M0x37/pimpt)
- [npm package](https://www.npmjs.com/package/@m0x373/pimpt)
