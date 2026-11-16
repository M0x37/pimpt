import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const mocks = vi.hoisted(() => {
  const cancelSymbol = Symbol('cancel');

  return {
    cancelSymbol,
    intro: vi.fn(),
    note: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    logStep: vi.fn(),
    logWarn: vi.fn(),
    logInfo: vi.fn(),
    isFontInstalled: vi.fn(() => true),
    canInstallFont: vi.fn(() => true),
    installFont: vi.fn(),
    installNerdFont: vi.fn(),
    installTerminalIconsModule: vi.fn(),
    addTerminalIconsToPowerShellProfile: vi.fn(),
    installPSReadLineModule: vi.fn(),
    addHistoryPreviewToPowerShellProfile: vi.fn(),
    addLazyGitToPowerShellProfile: vi.fn(),
    addCrossDriveCdToPowerShellProfile: vi.fn(),
    addTreeListingToPowerShellProfile: vi.fn(),
    addPowerShellAliasesToPowerShellProfile: vi.fn(),
    readPowerShellProfileFeatures: vi.fn(() => ({
      terminalIcons: false,
      historyPreview: false,
      lazyGit: false,
      crossDriveCd: false,
      treeListing: false,
      powershellAliases: false,
    })),
    createSettingsBackup: vi.fn(),
    listSettingsBackups: vi.fn(() => []),
    restoreSettingsBackup: vi.fn(),
    spawn: vi.fn(() => ({ on: vi.fn(), unref: vi.fn() })),
    select: vi.fn(),
    text: vi.fn(),
    confirm: vi.fn(),
    spinner: vi.fn(),
    isCancel: vi.fn((value: unknown) => value === cancelSymbol),
  };
});

vi.mock('@clack/prompts', () => ({
  intro: mocks.intro,
  note: mocks.note,
  outro: mocks.outro,
  cancel: mocks.cancel,
  select: mocks.select,
  text: mocks.text,
  confirm: mocks.confirm,
  spinner: mocks.spinner,
  log: {
    step: mocks.logStep,
    info: mocks.logInfo,
    success: vi.fn(),
    warn: mocks.logWarn,
    error: vi.fn(),
    message: vi.fn(),
  },
  isCancel: mocks.isCancel,
}));

vi.mock('node:timers/promises', () => ({
  setTimeout: vi.fn(() => Promise.resolve()),
}));

vi.mock('node:child_process', () => ({
  spawn: mocks.spawn,
}));

vi.mock('../src/fonts', () => ({
  isFontInstalled: mocks.isFontInstalled,
  canInstallFont: mocks.canInstallFont,
  installFont: mocks.installFont,
  installNerdFont: mocks.installNerdFont,
  NERD_FONT_FAMILY: 'Hack Nerd Font Mono',
}));

vi.mock('../src/powershell', () => ({
  installTerminalIconsModule: mocks.installTerminalIconsModule,
  addTerminalIconsToPowerShellProfile: mocks.addTerminalIconsToPowerShellProfile,
  installPSReadLineModule: mocks.installPSReadLineModule,
  addHistoryPreviewToPowerShellProfile: mocks.addHistoryPreviewToPowerShellProfile,
  addLazyGitToPowerShellProfile: mocks.addLazyGitToPowerShellProfile,
  addCrossDriveCdToPowerShellProfile: mocks.addCrossDriveCdToPowerShellProfile,
  addTreeListingToPowerShellProfile: mocks.addTreeListingToPowerShellProfile,
  addPowerShellAliasesToPowerShellProfile: mocks.addPowerShellAliasesToPowerShellProfile,
  readPowerShellProfileFeatures: mocks.readPowerShellProfileFeatures,
}));

vi.mock('../src/wtsettings', () => ({
  createSettingsBackup: mocks.createSettingsBackup,
  findSettingsPath: vi.fn(),
  listSettingsBackups: mocks.listSettingsBackups,
  readSettingsFile: vi.fn(),
  restoreSettingsBackup: mocks.restoreSettingsBackup,
  setSetting: vi.fn(),
  writeSettingsFile: vi.fn(),
}));

import { runNonInteractiveInstaller } from '../src/installer';
import {
  findSettingsPath,
  readSettingsFile,
  setSetting,
  writeSettingsFile,
  createSettingsBackup,
} from '../src/wtsettings';

const settingsPath =
  'C:/Users/test/AppData/Local/Packages/Microsoft.WindowsTerminal_8wekyb3d8bbwe/LocalState/settings.json';

function writeConfig(dir: string, name: string, content: Record<string, unknown>): string {
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(content));
  return path;
}

let configDir: string;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('WT_SESSION', '');
  configDir = mkdtempSync(join(tmpdir(), 'pimpt-dryrun-test-'));

  findSettingsPath.mockReturnValue(settingsPath);
  readSettingsFile.mockReturnValue(`{
    "$schema": "https://aka.ms/terminal-profiles-schema",
    "profiles": {
      "defaults": {},
      "list": []
    }
  }`);
  setSetting.mockImplementation(() => '{"modified": true}');
  writeSettingsFile.mockImplementation(() => undefined);
  createSettingsBackup.mockReturnValue('C:/Users/test/settings.json.backup-123-0');
  mocks.listSettingsBackups.mockReturnValue([]);
  mocks.readPowerShellProfileFeatures.mockReturnValue({
    terminalIcons: false,
    historyPreview: false,
    lazyGit: false,
    crossDriveCd: false,
    treeListing: false,
    powershellAliases: false,
  });
  mocks.spinner.mockReturnValue({
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
    cancel: vi.fn(),
    error: vi.fn(),
    clear: vi.fn(),
    isCancelled: false,
  });
});

afterEach(() => {
  rmSync(configDir, { recursive: true, force: true });
});

describe('runNonInteractiveInstaller with dryRun', () => {
  it('does not write settings.json in dry-run mode', async () => {
    const configPath = writeConfig(configDir, 'config.json', {
      answers: { background: '#2E3440', transparency: '80' },
    });

    await runNonInteractiveInstaller(configPath, { dryRun: true });

    expect(findSettingsPath).toHaveBeenCalledOnce();
    expect(readSettingsFile).toHaveBeenCalledOnce();
    expect(setSetting).toHaveBeenCalledWith(
      expect.any(String),
      ['profiles', 'defaults', 'background'],
      '#2E3440'
    );

    expect(createSettingsBackup).not.toHaveBeenCalled();
    expect(writeSettingsFile).not.toHaveBeenCalled();
  });

  it('does not apply PowerShell features in dry-run mode', async () => {
    readSettingsFile.mockReturnValue(`{
      "profiles": {
        "defaults": {},
        "list": [
          { "name": "Windows PowerShell", "commandline": "powershell.exe" }
        ]
      }
    }`);
    const configPath = writeConfig(configDir, 'config.json', {
      answers: {
        terminalIcons: true,
        historyPreview: true,
        lazyGit: true,
        hidePowerShellBanner: true,
      },
    });

    await runNonInteractiveInstaller(configPath, { dryRun: true });

    expect(mocks.installNerdFont).not.toHaveBeenCalled();
    expect(mocks.installTerminalIconsModule).not.toHaveBeenCalled();
    expect(mocks.addTerminalIconsToPowerShellProfile).not.toHaveBeenCalled();
    expect(mocks.installPSReadLineModule).not.toHaveBeenCalled();
    expect(mocks.addHistoryPreviewToPowerShellProfile).not.toHaveBeenCalled();
    expect(mocks.addLazyGitToPowerShellProfile).not.toHaveBeenCalled();
    expect(writeSettingsFile).not.toHaveBeenCalled();
    expect(createSettingsBackup).not.toHaveBeenCalled();
  });

  it('still builds the settings content in dry-run mode', async () => {
    const configPath = writeConfig(configDir, 'config.json', {
      answers: { fontSize: '14', cursorShape: 'block' },
    });

    await runNonInteractiveInstaller(configPath, { dryRun: true });

    expect(setSetting).toHaveBeenCalled();
    expect(setSetting).toHaveBeenCalledWith(
      expect.any(String),
      ['profiles', 'defaults', 'fontSize'],
      expect.anything()
    );
    expect(setSetting).toHaveBeenCalledWith(
      expect.any(String),
      ['profiles', 'defaults', 'cursorShape'],
      expect.anything()
    );
    expect(writeSettingsFile).not.toHaveBeenCalled();
  });
});
