import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mocks = vi.hoisted(() => {
  const cancelSymbol = Symbol('cancel');

  return {
    cancelSymbol,
    InvalidSettingsFileError: class InvalidSettingsFileError extends Error {},
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
  InvalidSettingsFileError: mocks.InvalidSettingsFileError,
  createSettingsBackup: mocks.createSettingsBackup,
  findSettingsPath: vi.fn(),
  listSettingsBackups: mocks.listSettingsBackups,
  readSettingsFile: vi.fn(),
  restoreSettingsBackup: mocks.restoreSettingsBackup,
  setSetting: vi.fn(),
  writeSettingsFile: vi.fn(),
}));

import { runInstaller, runNonInteractiveInstaller } from '../src/installer';
import { main } from '../src/index';
import {
  findSettingsPath,
  readSettingsFile,
  setSetting,
  writeSettingsFile,
  createSettingsBackup,
} from '../src/wtsettings';
import { installNerdFont } from '../src/fonts';
import {
  installTerminalIconsModule,
  addTerminalIconsToPowerShellProfile,
  installPSReadLineModule,
  addHistoryPreviewToPowerShellProfile,
  addLazyGitToPowerShellProfile,
} from '../src/powershell';

const settingsPath =
  'C:/Users/test/AppData/Local/Packages/Microsoft.WindowsTerminal_8wekyb3d8bbwe/LocalState/settings.json';
const originalPlatform = process.platform;

function summaryText(): string {
  return (
    mocks.note.mock.calls
      .filter(([, title]) => title === 'Your configuration')
      .map(([message]) => String(message))[0] ?? ''
  );
}

let configDir: string;

function writeConfig(name: string, content: string | Record<string, unknown>): string {
  const path = join(configDir, name);
  writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content));
  return path;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  vi.stubEnv('WT_SESSION', '');
  process.exitCode = 0;
  configDir = mkdtempSync(join(tmpdir(), 'pimpt-noninteractive-test-'));

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
  Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  rmSync(configDir, { recursive: true, force: true });
});

describe('runNonInteractiveInstaller', () => {
  it('applies answers from a JSON config file without interactive prompts', async () => {
    const configPath = writeConfig('config.json', {
      answers: { background: '#2E3440', transparency: '80' },
    });

    await runNonInteractiveInstaller(configPath);

    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.text).not.toHaveBeenCalled();
    expect(mocks.confirm).not.toHaveBeenCalled();

    expect(findSettingsPath).toHaveBeenCalledOnce();
    expect(readSettingsFile).toHaveBeenCalledOnce();

    expect(setSetting).toHaveBeenCalledWith(
      expect.any(String),
      ['profiles', 'defaults', 'background'],
      '#2E3440'
    );
    expect(setSetting).toHaveBeenCalledWith(
      expect.any(String),
      ['profiles', 'defaults', 'tabColor'],
      '#2E3440'
    );
    expect(setSetting).toHaveBeenCalledWith(
      expect.any(String),
      ['profiles', 'defaults', 'opacity'],
      80
    );
    expect(setSetting).toHaveBeenCalledWith(
      expect.any(String),
      ['profiles', 'defaults', 'useAcrylic'],
      true
    );
    expect(setSetting).toHaveBeenCalledWith(expect.any(String), ['useAcrylicInTabRow'], true);

    expect(createSettingsBackup).toHaveBeenCalledOnce();
    expect(writeSettingsFile).toHaveBeenCalledOnce();
    expect(createSettingsBackup).toHaveBeenCalledBefore(writeSettingsFile);
    expect(summaryText()).toContain('Appearance');
    expect(summaryText()).toContain('Nord (#2E3440)');
  });

  it('does not write settings.json when the answers change nothing', async () => {
    const configPath = writeConfig('config.json', {
      answers: { background: 'keep', fontFace: 'keep' },
    });

    await runNonInteractiveInstaller(configPath);

    expect(setSetting).not.toHaveBeenCalled();
    expect(createSettingsBackup).not.toHaveBeenCalled();
    expect(writeSettingsFile).not.toHaveBeenCalled();
    expect(summaryText()).toContain('Keep current');
  });

  it('warns about unknown keys and ignores them', async () => {
    const configPath = writeConfig('config.json', {
      answers: { background: '#2E3440', nope: 'whatever', alsoFake: 7 },
    });

    await runNonInteractiveInstaller(configPath);

    expect(mocks.logWarn).toHaveBeenCalledWith(expect.stringContaining('nope'));
    expect(mocks.logWarn).toHaveBeenCalledWith(expect.stringContaining('alsoFake'));
    expect(setSetting).toHaveBeenCalledWith(
      expect.any(String),
      ['profiles', 'defaults', 'background'],
      '#2E3440'
    );
    expect(writeSettingsFile).toHaveBeenCalledOnce();
  });

  it('throws when the config file has no answers object', async () => {
    const configPath = writeConfig('config.json', { notAnswers: {} });
    await expect(runNonInteractiveInstaller(configPath)).rejects.toThrow(/answers/);
  });

  it('throws when the answers value is not an object', async () => {
    const configPath = writeConfig('config.json', { answers: 'nope' });
    await expect(runNonInteractiveInstaller(configPath)).rejects.toThrow(/answers/);
  });

  it('throws on invalid JSON', async () => {
    const configPath = writeConfig('config.json', '{ not valid json');
    await expect(runNonInteractiveInstaller(configPath)).rejects.toThrow(/JSON/);
  });

  it('applies PowerShell features conditionally based on the answers', async () => {
    readSettingsFile.mockReturnValue(`{
      "profiles": {
        "defaults": {},
        "list": [
          { "name": "Windows PowerShell", "commandline": "powershell.exe" }
        ]
      }
    }`);
    const configPath = writeConfig('config.json', {
      answers: {
        terminalIcons: true,
        historyPreview: true,
        lazyGit: false,
        hidePowerShellBanner: true,
      },
    });

    await runNonInteractiveInstaller(configPath);

    expect(installNerdFont).toHaveBeenCalledOnce();
    expect(installTerminalIconsModule).toHaveBeenCalledOnce();
    expect(addTerminalIconsToPowerShellProfile).toHaveBeenCalledOnce();
    expect(installPSReadLineModule).toHaveBeenCalledOnce();
    expect(addHistoryPreviewToPowerShellProfile).toHaveBeenCalledOnce();
    expect(addLazyGitToPowerShellProfile).not.toHaveBeenCalled();
  });

  it('does not crash when Windows Terminal settings.json cannot be found', async () => {
    vi.mocked(findSettingsPath).mockReturnValue(undefined);
    const configPath = writeConfig('config.json', { answers: { background: '#2E3440' } });

    await expect(runNonInteractiveInstaller(configPath)).resolves.toBeUndefined();
    expect(writeSettingsFile).not.toHaveBeenCalled();
    expect(createSettingsBackup).not.toHaveBeenCalled();
  });

  it('skips with a hint instead of aborting on non-Windows platforms', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    try {
      const configPath = writeConfig('config.json', { answers: { background: '#2E3440' } });
      await expect(runNonInteractiveInstaller(configPath)).resolves.toBeUndefined();
      expect(writeSettingsFile).not.toHaveBeenCalled();
      expect(mocks.logInfo).toHaveBeenCalledWith(expect.stringContaining('pimpt'));
    } finally {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    }
  });
});

describe('runInstaller with --apply', () => {
  it('runs the non-interactive path without clack prompts', async () => {
    const configPath = writeConfig('config.json', { answers: { background: '#2E3440' } });

    await runInstaller(configPath);

    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.text).not.toHaveBeenCalled();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(setSetting).toHaveBeenCalledWith(
      expect.any(String),
      ['profiles', 'defaults', 'background'],
      '#2E3440'
    );
    expect(writeSettingsFile).toHaveBeenCalledOnce();
  });

  it('still starts the interactive installer when no path is given', async () => {
    mocks.select.mockResolvedValueOnce('done');
    mocks.confirm.mockResolvedValue(true);

    await runInstaller();

    expect(mocks.select).toHaveBeenCalledOnce();
    expect(mocks.confirm).toHaveBeenCalledOnce();
    expect(writeSettingsFile).not.toHaveBeenCalled();
  });
});

describe('index.ts CLI', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('passes --apply <path> to runInstaller', async () => {
    const configPath = writeConfig('config.json', { answers: { background: '#2E3440' } });
    process.argv = ['node', 'pimpt', '--apply', configPath];

    await main();

    expect(mocks.select).not.toHaveBeenCalled();
    expect(setSetting).toHaveBeenCalledWith(
      expect.any(String),
      ['profiles', 'defaults', 'background'],
      '#2E3440'
    );
    expect(writeSettingsFile).toHaveBeenCalledOnce();
  });

  it('exits with code 1 when --apply is missing its path', async () => {
    process.argv = ['node', 'pimpt', '--apply'];

    await main();

    expect(process.exitCode).toBe(1);
    expect(writeSettingsFile).not.toHaveBeenCalled();
  });

  it('starts the interactive installer when no arguments are given', async () => {
    mocks.select.mockResolvedValueOnce('done');
    mocks.confirm.mockResolvedValue(true);
    process.argv = ['node', 'pimpt'];

    await main();

    expect(mocks.select).toHaveBeenCalledOnce();
    expect(writeSettingsFile).not.toHaveBeenCalled();
  });
});
