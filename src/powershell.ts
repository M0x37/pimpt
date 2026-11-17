// Re-export aller Module aus dem aufgesplitteten powershell-Verzeichnis.
// Diese Datei existiert aus Abwärtskompatibilität zu bestehenden Importen.
export { installTerminalIconsModule, installPSReadLineModule } from './powershell/modules.js';

export {
  addTerminalIconsToPowerShellProfile,
  addHistoryPreviewToPowerShellProfile,
  addPowerShellAliasesToPowerShellProfile,
  addPowerShellProfileBlock,
  removePowerShellProfileBlock,
  runPowerShell,
  readPowerShellProfileFeatures,
  clearProfileCacheForTesting,
  type PowerShellProfileFeatures,
} from './powershell/profile.js';

export { addLazyGitToPowerShellProfile } from './powershell/lazy-git.js';
export { addCrossDriveCdToPowerShellProfile } from './powershell/cross-drive-cd.js';
export { addTreeListingToPowerShellProfile } from './powershell/tree-listing.js';
