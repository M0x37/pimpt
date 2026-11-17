import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mocks = vi.hoisted(() => {
  return {
    logInfo: vi.fn(),
    logWarn: vi.fn(),
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
  };
});

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  note: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  select: mocks.select,
  text: mocks.text,
  confirm: mocks.confirm,
  spinner: mocks.spinner,
  log: {
    step: vi.fn(),
    info: mocks.logInfo,
    success: vi.fn(),
    warn: mocks.logWarn,
    error: vi.fn(),
    message: vi.fn(),
  },
  isCancel: vi.fn(),
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

import { exportConfig, importConfig, applyAnswers } from '../src/installer';
import {
  findSettingsPath,
  readSettingsFile,
  setSetting,
  writeSettingsFile,
  createSettingsBackup,
} from '../src/wtsettings';

const settingsPath =
  'C:/Users/test/AppData/Local/Packages/Microsoft.WindowsTerminal_8wekyb3d8bbwe/LocalState/settings.json';

let configDir: string;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('WT_SESSION', '');
  configDir = mkdtempSync(join(tmpdir(), 'pimpt-config-test-'));

  findSettingsPath.mockReturnValue(settingsPath);
  readSettingsFile.mockReturnValue(`{
    "$schema": "https://aka.ms/terminal-profiles-schema",
    "profiles": {
      "defaults": {
        "opacity": 80,
        "useAcrylic": true,
        "background": "#2E3440",
        "fontSize": 12,
        "cursorShape": "filledBox",
        "colorScheme": "Campbell",
        "theme": "dark",
        "tabLayout": "titlebar",
        "tabWidthMode": "equal",
        "icon": "classic",
        "tabTitle": "pimpt",
        "copyOnSelect": true,
        "focusFollowMouse": false,
        "trimPaste": true,
        "startingDirectory": "C:\\Users\\you\\Projects"
      },
      "list": []
    },
    "confirmClose": true
  }`);
  setSetting.mockImplementation(() => '{"modified": true}');
  writeSettingsFile.mockImplementation(() => undefined);
  createSettingsBackup.mockReturnValue('C:/Users/test/settings.json.backup-123-0');
  mocks.listSettingsBackups.mockReturnValue([]);
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

describe('exportConfig', () => {
  it('exports the current settings as a JSON config file', async () => {
    const configPath = join(configDir, 'config.json');
    await exportConfig(configPath);

    const content = readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty('answers');
    expect(typeof parsed.answers).toBe('object');
    expect(mocks.logInfo).toHaveBeenCalledWith(expect.stringContaining(configPath));
  });
});

describe('importConfig', () => {
  it('imports a valid config file and returns the answers', () => {
    const configPath = join(configDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({ answers: { background: '#2E3440' } }));

    const answers = importConfig(configPath);
    expect(answers.background).toBe('#2E3440');
  });

  it('throws on invalid JSON', () => {
    const configPath = join(configDir, 'config.json');
    writeFileSync(configPath, '{ not valid json');
    expect(() => importConfig(configPath)).toThrow(/JSON/);
  });

  it('throws when there is no answers object', () => {
    const configPath = join(configDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({ notAnswers: {} }));
    expect(() => importConfig(configPath)).toThrow(/answers/);
  });

  it('warns about unknown keys and ignores them', () => {
    const configPath = join(configDir, 'config.json');
    writeFileSync(
      configPath,
      JSON.stringify({ answers: { background: '#2E3440', nope: 'whatever' } })
    );
    const answers = importConfig(configPath);
    expect(answers.background).toBe('#2E3440');
    expect(answers.nope).toBe('whatever');
    expect(mocks.logWarn).toHaveBeenCalledWith(expect.stringContaining('nope'));
  });
});

describe('applyAnswers', () => {
  it('applies answers to settings.json', async () => {
    const answers = { background: '#2E3440', transparency: '80' };
    await applyAnswers(answers, settingsPath);

    expect(setSetting).toHaveBeenCalledWith(
      expect.any(String),
      ['profiles', 'defaults', 'background'],
      '#2E3440'
    );
    expect(setSetting).toHaveBeenCalledWith(
      expect.any(String),
      ['profiles', 'defaults', 'opacity'],
      80
    );
    expect(createSettingsBackup).toHaveBeenCalledOnce();
    expect(writeSettingsFile).toHaveBeenCalledOnce();
  });

  it('does not write in dry-run mode', async () => {
    const answers = { background: '#2E3440' };
    await applyAnswers(answers, settingsPath, { dryRun: true });

    expect(createSettingsBackup).not.toHaveBeenCalled();
    expect(writeSettingsFile).not.toHaveBeenCalled();
  });
});
