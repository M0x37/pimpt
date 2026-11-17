# pimpt

An interactive setup assistant for Windows Terminal. Choose terminal settings and PowerShell features from a guided menu, review the summary, and confirm before changes are applied.

## What pimpt actually does

**Terminal settings (written to Windows Terminal `settings.json`)**

- **Transparency / acrylic** — window opacity (off, 90%, 80%, 70%, 50%, fully transparent)
- **Background color** — Midnight, Nord, Dracula, Solarized Dark, custom hex, or keep current
- **Background image** — path to a local image (leave empty to skip)
- **Font** — Cascadia Mono, Cascadia Code, Consolas, JetBrains Mono, Fira Code, Hack, Source Code Pro, IBM Plex Mono (missing fonts can be installed automatically), or keep current
- **Font size** — 10, 11, 12, 14, 16, 18 pt
- **Cursor shape** — bar, block, underline, vintage, or keep current
- **Color scheme** — Campbell, One Half Dark, Solarized Dark, Tango Dark, Vintage, or keep current
- **Starting directory** — default shell folder; relative paths such as `~/Projects` resolve from your user folder, environment variables such as `%USERPROFILE%` are supported

**Window & tabs**
- Launch mode (windowed, maximized, fullscreen, focus mode, maximized focus)
- Application theme (system, dark, light)
- Tab bar position (tabs in titlebar, separate tab row)
- Tab width (equal, title length, compact)

**Profile**
- Profile icon style (classic, rocket, bolt, code)
- Custom tab title (leave empty for automatic)

**Behavior**
- Copy on select
- Confirm close (ask before closing windows with many tabs)
- Focus follows mouse
- Trim paste (remove trailing whitespace when pasting)

**PowerShell features (added to your current user's PowerShell profile in marked blocks)**

- **PowerShell file icons** — installs Terminal-Icons and switches Windows Terminal to Hack Nerd Font Mono (installed automatically if missing)
- **Command history preview** — installs PSReadLine 2.4.5; Up/Down arrows browse recent commands in a scrollable list view
- **Lazy Git (`lg`)** — interactive Git UI for status, staging, commit, push/pull, branches, log, stash; Tab completion for Git commands, branches, and files
- **Smart `cd` (zoxide-style)** — remembers folders you visit and jumps by keyword (`cd pimpt`); supports drive switches (`cd D`, `cd D:`); interactive picks with `cdi`. `Set-Location` remains available.
- **Tree-style `ls`** — colored directory tree (`-Depth`, `-Limit`, `-All`, `-Force`). Original `Get-ChildItem` stays available as `gci`.
- **PowerShell aliases** — `ll`, `la`, `..`, `...`, `grep`, `wget`, `curl`
- **Hide PowerShell startup banner** — adds `-NoLogo` to Windows PowerShell profile command lines

**Installer (via winget)**

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
pimpt                   Start the interactive installer
pimpt --apply <path>    Apply settings non-interactively from a JSON config file
pimpt --dry-run <path>  Preview changes from a JSON config file without writing
pimpt config export <path>  Export the current pimpt configuration to a JSON file
pimpt config import <path>  Import a pimpt configuration from a JSON file
pimpt --help            Show help
pimpt --version         Show the installed version
```

When you start `pimpt`, the current version number is shown below the banner.

1. **Choose an area** — `Appearance`, `Features`, `Installer`, `Remove`, or `Other`
2. **Pick settings** — already-configured items are marked; set items offer a "Reset" option
3. **Review the summary** — all selected values are listed before anything is written
4. **Confirm** — changes are applied only after you say yes

Existing Windows Terminal settings are detected and pre-filled so you can see what is already configured.

## Non-interactive mode (`--apply`)

`pimpt --apply <config.json>` reads a JSON configuration file and applies the settings without any interactive prompts. The config file contains an `answers` object mapping setting IDs to values:

```json
{
  "answers": {
    "background": "#2E3440",
    "transparency": "80",
    "fontFace": "Cascadia Code",
    "historyPreview": true,
    "lazyGit": true
  }
}
```

Unknown keys are ignored with a warning. This is useful for scripting and rolling out the same configuration to multiple machines.

## Dry-run (`--dry-run`)

`pimpt --dry-run <config.json>` shows the planned changes (the resulting `settings.json` content) without writing anything or creating a backup. Use it to review what `--apply` would do before executing.

## Config export / import

`pimpt config export <path>` writes the current pimpt configuration (detected from `settings.json` and the PowerShell profile) to a JSON file. `pimpt config import <path>` reads such a file and applies it directly to `settings.json` and the PowerShell profile.

## Remove area

The **Remove** menu area lets you uninstall individual PowerShell features (Terminal-Icons, history preview, Lazy Git, smart cd, tree-style ls, aliases) by removing their marked blocks from your PowerShell profile.

## Undo / Reset

In any settings area, already-configured items offer a "Reset <label>" option that removes the setting from `settings.json` and from your selection.

## Error reporting (Sentry)

pimpt can send unexpected errors to [Sentry](https://sentry.io) for debugging. Set the `PIMPT_SENTRY_DSN` environment variable to enable it:

```powershell
$env:PIMPT_SENTRY_DSN = "https://<key>@sentry.io/<project>"
pimpt
```

Without a DSN, Sentry is disabled and no data is sent. Windows Terminal settings content and personal file paths are stripped before any event is sent.

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
