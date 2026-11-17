<div align="center">
  <img src="https://cdn.iconscout.com/icon/free/png-512/free-terminal-icon-svg-download-png-7523117.png" width="96" height="96" alt="Terminal icon">
  <h1>pimpt</h1>
  <p>Interactive setup assistant for Windows Terminal and PowerShell.</p>
  <p>
    <a href="https://github.com/M0x37/pimpt/actions/workflows/ci.yml"><img src="https://github.com/M0x37/pimpt/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
    <a href="https://www.npmjs.com/package/@m0x373/pimpt"><img src="https://img.shields.io/npm/v/%40m0x373%2Fpimpt?logo=npm" alt="npm version"></a>
    <a href="https://www.npmjs.com/package/@m0x373/pimpt"><img src="https://img.shields.io/npm/dm/%40m0x373%2Fpimpt?logo=npm" alt="npm downloads"></a>
    <a href="https://www.npmjs.com/package/@m0x373/pimpt"><img src="https://img.shields.io/npm/l/%40m0x373%2Fpimpt" alt="license"></a>
    <a href="https://github.com/M0x37/pimpt"><img src="https://img.shields.io/github/stars/M0x37/pimpt?style=flat&logo=github" alt="GitHub stars"></a>
  </p>
</div>

## Overview

`pimpt` guides you through configuring Windows Terminal. Settings are collected, shown in
a summary, and only written after you confirm them. You can also enable useful PowerShell
features and install common programs through `winget`.

## Features

### Windows Terminal settings

- Transparency and acrylic effect
- Background color: Midnight, Nord, Dracula, Solarized Dark, or a custom hex value
- Local background image
- Font and font size, including automatic installation of missing fonts
- Cursor shape
- Color scheme
- Starting directory with support for `~`, environment variables, and drive switches
- Launch mode: windowed, maximized, fullscreen, focus, or maximized focus
- Application theme and tab bar position
- Tab width
- Profile icon and custom tab title
- Copy on select, close confirmation, focus follows mouse, and trimmed paste

### PowerShell features

Features are added to the current user's profile in marked blocks. This keeps them
traceable and makes them easy to remove later.

- File icons with Terminal-Icons and Hack Nerd Font Mono
- History preview with PSReadLine
- Lazy Git through the `lg` command
- Smart `cd` with directory history, drive switches, and interactive selection
- Tree view for `ls`
- Useful aliases such as `ll`, `la`, `..`, `grep`, `wget`, and `curl`
- Hide the PowerShell startup banner

### Program installer

The following programs can be installed through `winget`:

- Git
- Python
- Node.js
- Visual Studio Code
- Docker Desktop

## Requirements

- Windows 10 or later
- Windows Terminal: Stable, Preview, or Canary
- Node.js 22 or later
- PowerShell for PowerShell features
- `winget` for program installation

Optional features and missing fonts may require an internet connection.

## Install

```powershell
npm install --global @m0x373/pimpt
```

Then start the assistant:

```powershell
pimpt
```

The package uses the `@m0x373` scope because the unscoped name `pimpt` is not available
on npm.

## Usage

```text
pimpt                         Start the interactive assistant
pimpt --apply <path>          Apply settings non-interactively from a JSON config file
pimpt --dry-run <path>        Preview changes without writing
pimpt config export <path>    Export the current configuration to a JSON file
pimpt config import <path>    Import a configuration from a JSON file
pimpt --help                  Show help
pimpt --version               Show the installed version
```

The workflow:

1. Select an area: `Appearance`, `Features`, `Installer`, `Remove`, or `Other`
2. Select settings; already active options are detected and can be reset
3. Review the change summary
4. Confirm the changes

The assistant reads existing Windows Terminal settings and uses them as the initial values.

## Non-interactive mode

`pimpt --apply <config.json>` reads a JSON configuration file and applies settings without
interactive prompts. The file contains an `answers` object mapping setting IDs to values:

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

Unknown keys are ignored with a warning. This is useful for scripting and applying the same
configuration to multiple machines.

## Dry run

`pimpt --dry-run <config.json>` shows the planned `settings.json` changes without writing
anything or creating a backup. Use it to review an `--apply` configuration first.

## Configuration export and import

`pimpt config export <path>` writes the current configuration, detected from
`settings.json` and the PowerShell profile, to a JSON file.
`pimpt config import <path>` reads that file and applies it directly.

## Remove and reset

The `Remove` area lets you uninstall individual PowerShell features by removing their
marked profile blocks. In any settings area, already configured items also offer a reset
option that removes the setting from `settings.json` and from the current selection.

## Safety and recovery

- `settings.json` is processed as JSONC; comments and formatting are preserved where possible.
- A backup is created before every change.
- Backups are available through `Other` and `Restore settings backup`.
- No changes are applied without confirmation.
- PowerShell extensions are stored in marked profile blocks.

## Development

```powershell
npm install            Install dependencies
npm test               Run the test suite
npm run typecheck      Type-check with TypeScript
npm run lint           Lint source and tests
npm run format         Format with Prettier
npm run format:check   Check formatting
npm run build          Build the ESM bundle to dist/
```

The build runs automatically through `prepublishOnly` before publishing.

## Project structure

```text
src/
  index.ts             CLI entry point
  installer.ts         Interactive setup assistant
  settings.ts          Setting definitions
  wtsettings.ts        Read, write, and back up settings.json
  powershell.ts        PowerShell profile features
  fonts.ts             Font detection and installation
  summary.ts           Selection summary
test/                  Vitest tests
```

## License

This project is released under the [ISC License](LICENSE), as declared in the package
metadata.

The header icon is a free asset from [IconScout](https://iconscout.com), published by
[Widyatmoko P.Y](https://iconscout.com/contributors/widyatmoko):
[Terminal icon](https://iconscout.com/free-icon/terminal-9243450).

## Links

- [Source repository](https://github.com/M0x37/pimpt)
- [npm package](https://www.npmjs.com/package/@m0x373/pimpt)
- [Issues and bug reports](https://github.com/M0x37/pimpt/issues)
