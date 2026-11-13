# pimpt

An interactive setup assistant for Windows Terminal. Choose settings and PowerShell features from a guided menu, review the summary, and confirm before changes are applied.

## Requirements

- Windows 10 or later
- Windows Terminal
- Node.js 22 or later
- PowerShell for PowerShell profile features

Some optional features install modules from the PowerShell Gallery or download a font, so an internet connection may be required.

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
pimpt
pimpt --help
pimpt --version
```

The installer detects the Windows Terminal settings file for the Stable, Preview, or Canary release. Select an area, choose settings, review the summary, and confirm to apply the changes.

## Available options

### Appearance and terminal settings

- Set window opacity and acrylic effects.
- Set a background color.
- Choose a terminal font.
- Hide the Windows PowerShell startup banner.
- Enable PowerShell file icons with the Terminal-Icons module and Hack Nerd Font Mono.

### PowerShell features

- Set a default starting directory. Relative paths such as `Downloads` resolve from your user folder.
- Enable a scrollable command history preview with PSReadLine.
- Enable a colored tree view for `ls`.

When tree-style `ls` is enabled, the original `Get-ChildItem` command remains available as `gci`.

The tree view defaults to a maximum depth of 4 and 50 displayed entries:

```powershell
ls
ls .\src -Depth 2
ls .\src -Limit 200
ls .\src -All
ls .\src -Force
```

`-All` disables the entry limit and may produce a large amount of output.

## Settings safety

- Windows Terminal settings are edited as JSONC, preserving comments and formatting where possible.
- A backup is created before `settings.json` is changed.
- The installer asks for confirmation before applying the selected configuration.
- Existing backups can be restored from the `Other` area.
- PowerShell features are added to the current user's PowerShell profile in marked blocks.

## Development

```powershell
npm install
npm test
npm run typecheck
npm run build
```

## Publishing

Publishing is available manually from the GitHub Actions tab using the
`Publish to npm` workflow. It checks out the latest commit on `main`, runs the
typecheck and tests, then publishes the version in `package.json` with the
`latest` npm tag. The publish step builds the package automatically.

Before running it, add an npm access token with publish permission as the
repository Actions secret `NPM_TOKEN`. Update the package version in
`package.json` and `package-lock.json` and push the changes to `main` first.
Published versions cannot be overwritten, so each publish needs a new version.

## License

ISC, as declared in the package metadata.

## Links

- [Source repository](https://github.com/M0x37/pimpt)
- [npm package](https://www.npmjs.com/package/@m0x373/pimpt)
