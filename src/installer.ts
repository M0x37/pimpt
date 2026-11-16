import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  note,
  outro,
  select,
  spinner,
  text,
} from '@clack/prompts';
import { execFileSync, spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { parse, type ParseError } from 'jsonc-parser';
import { win32 as pathWin32 } from 'node:path';
import pc from 'picocolors';
import { setTimeout as delay } from 'node:timers/promises';
import {
  BACKGROUND_CUSTOM,
  settings,
  type SettingDefinition,
  type SettingValue,
} from './settings.js';
import {
  canInstallFont,
  installFont,
  installNerdFont,
  isFontInstalled,
  NERD_FONT_FAMILY,
} from './fonts.js';
import {
  addTerminalIconsToPowerShellProfile,
  addHistoryPreviewToPowerShellProfile,
  addCrossDriveCdToPowerShellProfile,
  addLazyGitToPowerShellProfile,
  addTreeListingToPowerShellProfile,
  addPowerShellAliasesToPowerShellProfile,
  installPSReadLineModule,
  installTerminalIconsModule,
  readPowerShellProfileFeatures,
} from './powershell.js';
import { buildSummarySections, normalizeHex } from './summary.js';
import {
  createSettingsBackup,
  findSettingsPath,
  InvalidSettingsFileError,
  listSettingsBackups,
  readSettingsFile,
  restoreSettingsBackup,
  setSetting,
  writeSettingsFile,
} from './wtsettings.js';

const BANNER = `
   ██████╗ ██╗███╗   ███╗██████╗ ████████╗
   ██╔══██╗██║████╗ ████║██╔══██╗╚══██╔══╝
   ██████╔╝██║██╔████╔██║██████╔╝   ██║
   ██╔═══╝ ██║██║╚██╔╝██║██╔═══╝    ██║
   ██║     ██║██║ ╚═╝ ██║██║        ██║
   ╚═╝     ╚═╝╚═╝     ╚═╝╚═╝        ╚═╝
`;

const installerPrograms: { id: string; label: string; hint: string; wingetId: string }[] = [
  { id: 'git', label: 'Git', hint: 'Version control', wingetId: 'Git.Git' },
  { id: 'python', label: 'Python', hint: 'Programming language', wingetId: 'Python.Python.3' },
  { id: 'nodejs', label: 'Node.js', hint: 'JavaScript runtime', wingetId: 'OpenJS.NodeJS' },
  {
    id: 'vscode',
    label: 'Visual Studio Code',
    hint: 'Code editor',
    wingetId: 'Microsoft.VisualStudioCode',
  },
  {
    id: 'docker',
    label: 'Docker Desktop',
    hint: 'Container platform',
    wingetId: 'Docker.DockerDesktop',
  },
];

function bail<T>(value: T): Exclude<T, symbol> {
  if (isCancel(value)) {
    cancel('Setup cancelled. Nothing was changed.');
    process.exit(0);
  }
  return value as Exclude<T, symbol>;
}

/**
 * Prüft, ob winget.exe auf dem System verfügbar ist.
 */
function isWingetAvailable(): boolean {
  try {
    execFileSync('winget.exe', ['--version'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

class StartingDirectoryInputError extends Error {}

function normalizeStartingDirectory(value: string): string {
  let directory = value.trim();
  if (!directory) return '';

  if (
    (directory.startsWith('"') && directory.endsWith('"')) ||
    (directory.startsWith("'") && directory.endsWith("'"))
  ) {
    directory = directory.slice(1, -1).trim();
  }
  if (!directory) return '';

  const userProfile = process.env.USERPROFILE ?? process.env.HOME;
  if (/^~(?=$|[\\/])/.test(directory)) {
    if (!userProfile) {
      throw new StartingDirectoryInputError(
        "Cannot resolve '~' because the user folder is unknown."
      );
    }
    directory = directory.replace(/^~/, userProfile);
  }

  directory = directory.replace(/%([^%]+)%/g, (variable, name: string) => {
    const key = Object.keys(process.env).find(
      (candidate) => candidate.toLowerCase() === name.toLowerCase()
    );
    const environmentValue = key ? process.env[key] : undefined;
    if (environmentValue === undefined) {
      throw new StartingDirectoryInputError(
        `Unknown environment variable in starting path: ${variable}`
      );
    }
    return environmentValue;
  });

  if (/^[a-zA-Z]:(?![\\/])/.test(directory)) {
    throw new StartingDirectoryInputError(
      'Use an absolute drive path, for example C:\\Users\\you\\Downloads.'
    );
  }

  if (/^[\\/](?![\\/])/.test(directory)) {
    if (!userProfile) {
      throw new StartingDirectoryInputError(
        'Cannot resolve a rooted path because the user folder is unknown.'
      );
    }
    directory = pathWin32.resolve(pathWin32.parse(userProfile).root, directory);
  }

  if (pathWin32.isAbsolute(directory)) return pathWin32.normalize(directory);
  if (!userProfile) {
    throw new StartingDirectoryInputError(
      'Cannot resolve a relative starting path because the user folder is unknown.'
    );
  }
  return pathWin32.resolve(userProfile, directory);
}

function validateStartingDirectory(value: string | undefined): string | undefined {
  let directory: string;
  try {
    directory = normalizeStartingDirectory(value ?? '');
  } catch (error) {
    if (error instanceof StartingDirectoryInputError) return error.message;
    throw error;
  }

  if (!directory || process.platform !== 'win32') return undefined;

  try {
    if (!statSync(directory).isDirectory()) {
      return 'The starting path must be an existing folder.';
    }
  } catch (error) {
    if (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    ) {
      return `Folder not found: ${directory}`;
    }
    if (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      (error.code === 'EACCES' || error.code === 'EPERM')
    ) {
      return `Cannot access folder: ${directory}`;
    }
    throw error;
  }
  return undefined;
}

async function askSetting(
  setting: SettingDefinition,
  currentValue?: SettingValue
): Promise<SettingValue> {
  const prompt = setting.prompt;

  if (prompt.kind === 'select') {
    const selectInitialValue =
      currentValue === undefined ? prompt.initialValue : String(currentValue);
    const selectValue = async () =>
      bail(
        await select<string>({
          message: prompt.message,
          options: prompt.options,
          initialValue: selectInitialValue,
        })
      );

    if (setting.id === 'fontFace') {
      while (true) {
        const fontFamily = await selectValue();
        if (fontFamily === 'keep' || isFontInstalled(fontFamily)) {
          return fontFamily;
        }

        if (!canInstallFont(fontFamily)) {
          log.warn(
            pc.yellow(
              `${fontFamily} is not installed and cannot be installed automatically. Choose another font.`
            )
          );
          continue;
        }

        const shouldInstall = bail(
          await confirm({
            message: `${fontFamily} is not installed. Install it now? Select No to choose another font.`,
            initialValue: true,
          })
        );
        if (!shouldInstall) continue;

        const fontSpinner = spinner();
        fontSpinner.start(`Installing ${fontFamily}…`);
        try {
          await installFont(fontFamily);
        } catch (error) {
          fontSpinner.error(`Could not install ${fontFamily}.`);
          throw error;
        }
        fontSpinner.stop(`${fontFamily} installed. Restart Windows Terminal to use it.`);
        return fontFamily;
      }
    }

    const value = await selectValue();

    // Hintergrundfarbe: bei "Custom" folgt eine Hex-Eingabe mit Validierung.
    if (setting.id === 'background' && value === BACKGROUND_CUSTOM) {
      const custom = bail(
        await text({
          message: 'Enter a background color',
          placeholder: '#1E1E2E',
          initialValue: '',
          validate: (input) => {
            const raw = input ?? '';
            return /^#?[0-9a-fA-F]{6}$/.test(raw.trim())
              ? undefined
              : 'Use a 6-digit hex color, e.g. #1E1E2E';
          },
        })
      );
      return normalizeHex(custom);
    }

    return value;
  }

  if (prompt.kind === 'text') {
    const value = bail(
      await text({
        message: prompt.message,
        placeholder: prompt.placeholder,
        initialValue: currentValue === undefined ? prompt.initialValue : String(currentValue),
        ...(setting.id === 'startingDirectory'
          ? { validate: validateStartingDirectory }
          : prompt.validate
            ? { validate: prompt.validate }
            : {}),
      })
    );
    return setting.id === 'startingDirectory' ? normalizeStartingDirectory(value) : value;
  }

  return bail(
    await confirm({
      message: prompt.message,
      initialValue: prompt.initialValue,
    })
  );
}

function renderSummary(answers: Record<string, SettingValue>): void {
  const sections = buildSummarySections(answers);

  if (sections.length === 0) {
    note('No settings selected.', 'Configuration summary');
    return;
  }

  const labelWidth = Math.max(
    ...sections.flatMap((section) => section.rows.map(([label]) => label.length))
  );

  const lines: string[] = [];

  sections.forEach((section, index) => {
    if (index > 0) lines.push('');
    lines.push(pc.bold(pc.cyan(section.group)));

    for (const [label, value] of section.rows) {
      lines.push(`  ${pc.dim(label.padEnd(labelWidth))}  ${value}`);
    }
  });

  note(lines.join('\n'), 'Your configuration');
}

function openNewTerminalTab(): boolean {
  if (!process.env.WT_SESSION) return false;

  try {
    const terminal = spawn('wt.exe', ['-w', '0', 'new-tab'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    terminal.on('error', (error) => {
      log.warn(pc.yellow(`Could not open a new Windows Terminal tab: ${error.message}`));
    });
    terminal.unref();
    return true;
  } catch (error) {
    log.warn(pc.yellow(`Could not open a new Windows Terminal tab: ${String(error)}`));
    return false;
  }
}

function getDefaultProfileIndex(content: string): number | undefined {
  const parseErrors: ParseError[] = [];
  const parsed = parse(content, parseErrors, { allowTrailingComma: true }) as {
    defaultProfile?: unknown;
    profiles?: { list?: unknown };
  };
  if (
    typeof parsed.defaultProfile !== 'string' ||
    !parsed.profiles ||
    typeof parsed.profiles !== 'object' ||
    !Array.isArray(parsed.profiles.list)
  ) {
    return undefined;
  }

  const index = parsed.profiles.list.findIndex(
    (profile: unknown) =>
      profile !== null &&
      typeof profile === 'object' &&
      'guid' in profile &&
      profile.guid === parsed.defaultProfile
  );
  return index < 0 ? undefined : index;
}

function getWindowsPowerShellProfiles(content: string): { index: number; commandline?: string }[] {
  const parseErrors: ParseError[] = [];
  const parsed: unknown = parse(content, parseErrors, {
    allowTrailingComma: true,
  });
  if (
    parseErrors.length > 0 ||
    parsed === null ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {
    throw new InvalidSettingsFileError();
  }

  const profiles = 'profiles' in parsed ? parsed.profiles : undefined;
  if (
    profiles === null ||
    typeof profiles !== 'object' ||
    Array.isArray(profiles) ||
    !('list' in profiles) ||
    !Array.isArray(profiles.list)
  ) {
    return [];
  }

  return profiles.list.flatMap((profile: unknown, index: number) => {
    if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) {
      return [];
    }

    const name = 'name' in profile && typeof profile.name === 'string' ? profile.name : '';
    const commandline =
      'commandline' in profile && typeof profile.commandline === 'string'
        ? profile.commandline
        : undefined;
    return name.toLowerCase() === 'windows powershell' ||
      /(?:^|[\\/"])powershell\.exe(?:["\s]|$)/i.test(commandline ?? '')
      ? [
          {
            index,
            ...(commandline !== undefined ? { commandline } : {}),
          },
        ]
      : [];
  });
}

function readConfiguredAnswers(settingsPath: string | undefined): Record<string, SettingValue> {
  const answers: Record<string, SettingValue> = {};
  try {
    const profileFeatures = readPowerShellProfileFeatures();
    if (profileFeatures.terminalIcons) answers.terminalIcons = true;
    if (profileFeatures.historyPreview) answers.historyPreview = true;
    if (profileFeatures.lazyGit) answers.lazyGit = true;
    if (profileFeatures.crossDriveCd) answers.crossDriveCd = true;
    if (profileFeatures.treeListing) answers.treeListing = true;
    if (profileFeatures.powershellAliases) answers.powershellAliases = true;
  } catch (error) {
    log.warn(
      pc.yellow(
        `Could not detect configured PowerShell features: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  }
  if (!settingsPath) return answers;

  const content = readSettingsFile(settingsPath);
  const parseErrors: ParseError[] = [];
  const parsed: unknown = parse(content, parseErrors, {
    allowTrailingComma: true,
  });
  if (
    parseErrors.length > 0 ||
    parsed === null ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {
    log.warn(
      pc.yellow(
        'Could not read existing settings.json values because the file contains invalid JSONC.'
      )
    );
    return answers;
  }

  const profiles = 'profiles' in parsed && parsed.profiles !== null ? parsed.profiles : undefined;
  const profileList =
    profiles !== null &&
    typeof profiles === 'object' &&
    !Array.isArray(profiles) &&
    'list' in profiles &&
    Array.isArray(profiles.list)
      ? profiles.list
      : [];
  const defaultProfileGuid = 'defaultProfile' in parsed ? parsed.defaultProfile : undefined;
  const defaultProfile =
    typeof defaultProfileGuid === 'string'
      ? profileList.find(
          (profile: unknown) =>
            profile !== null &&
            typeof profile === 'object' &&
            !Array.isArray(profile) &&
            'guid' in profile &&
            profile.guid === defaultProfileGuid
        )
      : undefined;
  const defaults =
    profiles !== null &&
    typeof profiles === 'object' &&
    !Array.isArray(profiles) &&
    'defaults' in profiles
      ? profiles.defaults
      : undefined;

  if (defaults !== null && typeof defaults === 'object' && !Array.isArray(defaults)) {
    if (
      'opacity' in defaults &&
      typeof defaults.opacity === 'number' &&
      Number.isInteger(defaults.opacity) &&
      defaults.opacity >= 0 &&
      defaults.opacity <= 100
    ) {
      answers.transparency =
        defaults.opacity === 100 && 'useAcrylic' in defaults && defaults.useAcrylic === false
          ? 'off'
          : String(defaults.opacity);
    }

    if ('background' in defaults && typeof defaults.background === 'string') {
      answers.background = defaults.background;
    }

    if ('backgroundImage' in defaults && typeof defaults.backgroundImage === 'string') {
      answers.backgroundImage = defaults.backgroundImage;
    }

    if ('fontSize' in defaults) {
      const fontSize = defaults.fontSize;
      if (typeof fontSize === 'string' || typeof fontSize === 'number') {
        answers.fontSize = String(fontSize);
      }
    }

    if ('cursorShape' in defaults && typeof defaults.cursorShape === 'string') {
      answers.cursorShape = defaults.cursorShape;
    }

    if ('colorScheme' in defaults && typeof defaults.colorScheme === 'string') {
      answers.colorScheme = defaults.colorScheme;
    }

    if ('launchMode' in defaults && typeof defaults.launchMode === 'string') {
      answers.launchMode = defaults.launchMode;
    }

    if ('theme' in defaults && typeof defaults.theme === 'string') {
      answers.appTheme = defaults.theme;
    }

    if ('tabLayout' in defaults && typeof defaults.tabLayout === 'string') {
      answers.tabLayout = defaults.tabLayout;
    }

    if ('tabWidthMode' in defaults && typeof defaults.tabWidthMode === 'string') {
      answers.tabWidthMode = defaults.tabWidthMode;
    }

    if ('icon' in defaults && typeof defaults.icon === 'string') {
      answers.icon = defaults.icon;
    }

    if ('tabTitle' in defaults && typeof defaults.tabTitle === 'string') {
      answers.tabTitle = defaults.tabTitle;
    }

    if ('copyOnSelect' in defaults && typeof defaults.copyOnSelect === 'boolean') {
      answers.copyOnSelect = defaults.copyOnSelect;
    }

    if ('focusFollowMouse' in defaults && typeof defaults.focusFollowMouse === 'boolean') {
      answers.focusFollowMouse = defaults.focusFollowMouse;
    }

    if ('trimPaste' in defaults && typeof defaults.trimPaste === 'boolean') {
      answers.trimPaste = defaults.trimPaste;
    }

    const defaultStartingDirectory =
      'startingDirectory' in defaults && typeof defaults.startingDirectory === 'string'
        ? defaults.startingDirectory
        : undefined;
    const font = 'font' in defaults && defaults.font !== null ? defaults.font : undefined;
    if (
      font !== null &&
      typeof font === 'object' &&
      !Array.isArray(font) &&
      'face' in font &&
      typeof font.face === 'string'
    ) {
      answers.fontFace = font.face;
    }

    const profileStartingDirectory =
      defaultProfile !== null &&
      typeof defaultProfile === 'object' &&
      !Array.isArray(defaultProfile) &&
      'startingDirectory' in defaultProfile &&
      typeof defaultProfile.startingDirectory === 'string'
        ? defaultProfile.startingDirectory
        : undefined;
    const startingDirectory = profileStartingDirectory ?? defaultStartingDirectory;
    if (startingDirectory !== undefined) {
      const error = validateStartingDirectory(startingDirectory);
      if (error) {
        log.warn(pc.yellow(`Ignoring the saved starting directory: ${error}`));
      } else {
        answers.startingDirectory = normalizeStartingDirectory(startingDirectory);
      }
    }
  }

  if ('confirmClose' in parsed && typeof parsed.confirmClose === 'boolean') {
    answers.confirmClose = parsed.confirmClose;
  }

  const powerShellProfiles = getWindowsPowerShellProfiles(content);
  if (
    powerShellProfiles.length > 0 &&
    powerShellProfiles.every((profile) =>
      /(?:^|\s)-NoLogo(?:\s|$)/i.test(profile.commandline ?? '')
    )
  ) {
    answers.hidePowerShellBanner = true;
  }

  return answers;
}

/**
 * Schreibt die Antworten in verfügbare Terminal-Einstellungen. Kommentare und
 * Formatierung der JSONC-Dateien werden erhalten.
 */
async function applySettings(
  answers: Record<string, SettingValue>,
  settingsPath: string | undefined = findSettingsPath()
): Promise<void> {
  const terminalIconsEnabled = answers.terminalIcons === true;
  const hidePowerShellBanner = answers.hidePowerShellBanner === true;

  // Ein Hintergrundbild soll nicht durch die Fenstertansparenz
  // durchscheinen. Wenn eins gesetzt ist, wird Transparenz ausgestellt.
  if (
    typeof answers.backgroundImage === 'string' &&
    answers.backgroundImage.trim() !== ''
  ) {
    answers.transparency = 'off';
  }

  if (!settingsPath) {
    if (terminalIconsEnabled) {
      throw new Error(
        'Cannot enable PowerShell file icons because Windows Terminal settings.json could not be found.'
      );
    }
    if (hidePowerShellBanner) {
      throw new Error(
        'Cannot hide the PowerShell startup banner because Windows Terminal settings.json could not be found.'
      );
    }
    log.warn(pc.dim('Could not find Windows Terminal settings.json. Skipping write.'));
    return;
  }

  log.info(pc.dim(`Writing to ${settingsPath}…`));

  const originalContent = readSettingsFile(settingsPath);
  let content = originalContent;
  for (const setting of settings) {
    const value = answers[setting.id];
    if (value === undefined) continue;
    if (!setting.jsonPath) continue;
    if (setting.skipIfKeep && value === 'keep') continue;
    if (terminalIconsEnabled && setting.id === 'fontFace') continue;

    if (setting.id === 'transparency') {
      const opacity = value === 'off' ? 100 : Number(value);
      if (!Number.isInteger(opacity) || opacity < 0 || opacity > 100) {
        throw new Error(`Invalid transparency value: ${String(value)}`);
      }

      content = setSetting(content, setting.jsonPath, opacity);
      content = setSetting(content, ['profiles', 'defaults', 'useAcrylic'], value !== 'off');
      content = setSetting(content, ['useAcrylicInTabRow'], value !== 'off');
    } else if (setting.id === 'background') {
      content = setSetting(content, setting.jsonPath, value);
      content = setSetting(content, ['profiles', 'defaults', 'tabColor'], value);
    } else if (setting.id === 'fontFace') {
      const defaultProfileIndex = getDefaultProfileIndex(content);
      content = setSetting(content, setting.jsonPath, value);
      if (defaultProfileIndex !== undefined) {
        content = setSetting(
          content,
          ['profiles', 'list', defaultProfileIndex, 'font', 'face'],
          value
        );
      }
    } else if (setting.id === 'startingDirectory') {
      const defaultProfileIndex = getDefaultProfileIndex(content);
      const startingDirectory = String(value).trim() || undefined;
      content = setSetting(content, setting.jsonPath, startingDirectory);
      if (defaultProfileIndex !== undefined) {
        content = setSetting(
          content,
          ['profiles', 'list', defaultProfileIndex, 'startingDirectory'],
          startingDirectory
        );
      }
    } else {
      if (setting.id === 'backgroundImage') {
        content = setSetting(content, setting.jsonPath, typeof value === 'string' ? value : '');
      } else if (typeof value === 'string' && value.trim() === '') {
        continue;
      } else {
        content = setSetting(content, setting.jsonPath, value);
      }
    }
  }

  if (hidePowerShellBanner) {
    const powerShellProfiles = getWindowsPowerShellProfiles(content);
    if (powerShellProfiles.length === 0) {
      throw new Error(
        'Cannot hide the PowerShell startup banner because no Windows PowerShell profile was found.'
      );
    }

    for (const profile of powerShellProfiles) {
      const commandline = profile.commandline?.trim() ? profile.commandline : 'powershell.exe';
      if (/(?:^|\s)-NoLogo(?:\s|$)/i.test(commandline)) continue;

      content = setSetting(
        content,
        ['profiles', 'list', profile.index, 'commandline'],
        `${commandline} -NoLogo`
      );
    }
  }

  if (terminalIconsEnabled) {
    const defaultProfileIndex = getDefaultProfileIndex(content);
    content = setSetting(content, ['profiles', 'defaults', 'font', 'face'], NERD_FONT_FAMILY);
    if (defaultProfileIndex !== undefined) {
      content = setSetting(
        content,
        ['profiles', 'list', defaultProfileIndex, 'font', 'face'],
        NERD_FONT_FAMILY
      );
    }
  }

  if (terminalIconsEnabled) {
    await installNerdFont();
    installTerminalIconsModule();
  }

  const dirty = content !== originalContent;
  if (dirty) {
    const backupPath = createSettingsBackup(settingsPath);
    log.info(pc.dim(`Backup created at ${backupPath}`));
    writeSettingsFile(settingsPath, content);
  }

  if (terminalIconsEnabled) {
    addTerminalIconsToPowerShellProfile();
  }
}

export async function runInstaller(): Promise<void> {
  console.log(pc.cyan(BANNER));
  intro(pc.bold('Pimp up your Terminal.'));

  const selectableSettings = settings.filter(
    (setting) =>
      (setting.group === 'Appearance' &&
        (setting.jsonPath !== undefined ||
          setting.id === 'terminalIcons' ||
          setting.id === 'hidePowerShellBanner')) ||
      (setting.group === 'Features' &&
        (setting.jsonPath !== undefined ||
          setting.id === 'historyPreview' ||
          setting.id === 'lazyGit' ||
          setting.id === 'crossDriveCd' ||
          setting.id === 'treeListing' ||
          setting.id === 'powershellAliases'))
  );
  const settingsPath = findSettingsPath();
  const backups = settingsPath ? listSettingsBackups(settingsPath) : [];
  const answers = readConfiguredAnswers(settingsPath);
  let initialPickerValue = selectableSettings[0]?.id;
  let initialArea = 'Appearance';

  while (true) {
    const areaOptions = [
      { value: 'Appearance', label: 'Appearance', hint: 'Colors and profile settings' },
      { value: 'Features', label: 'Features', hint: 'Optional extras' },
      { value: 'Installer', label: 'Installer', hint: 'Install programs' },
      { value: 'Other', label: 'Other', hint: 'Backups and recovery' },
    ];
    if (Object.keys(answers).length > 0) {
      areaOptions.push({
        value: 'done',
        label: 'Done',
        hint: 'Review and apply your settings',
      });
    }

    const selectedArea = bail(
      await select<string>({
        message: 'Choose an area',
        options: areaOptions,
        initialValue: initialArea,
      })
    );
    if (selectedArea === 'done') break;

    initialArea = selectedArea;
    if (selectedArea === 'Installer') {
      const installerOptions = installerPrograms.map((program) => ({
        value: program.id,
        label: program.label,
        hint: program.hint,
      }));
      installerOptions.push({ value: 'back', label: 'Back', hint: 'Choose another area' });

      const selectedProgram = bail(
        await select<string>({
          message: 'Installer',
          options: installerOptions,
          initialValue: installerPrograms[0]!.id,
        })
      );
      if (selectedProgram === 'back') continue;

      const program = installerPrograms.find((p) => p.id === selectedProgram);
      if (!program) {
        throw new Error(`Unknown installer program: ${selectedProgram}`);
      }

      if (!isWingetAvailable()) {
        note(
          'winget ist auf diesem System nicht verfügbar. Installiere den Windows App Installer, um Programme über pimpt zu installieren.',
          'Installer'
        );
        continue;
      }

      try {
        execFileSync(
          'winget.exe',
          [
            'install',
            program.wingetId,
            '--accept-package-agreements',
            '--accept-source-agreements',
            '--silent',
          ],
          { encoding: 'utf8', stdio: 'pipe' }
        );
        note(`✓ ${program.label} installed successfully.`, 'Installer');
      } catch (error) {
        const execError = error as { stdout?: string; stderr?: string };
        const output = `${execError.stdout ?? ''} ${execError.stderr ?? ''} ${String(error)}`;
        if (
          output.includes('already installed') ||
          output.includes('No newer package versions are available') ||
          output.includes('No available upgrade found')
        ) {
          note(`✓ ${program.label} is already installed.`, 'Installer');
        } else {
          note(`✗ Failed to install ${program.label}: ${String(error)}`, 'Installer');
        }
      }
      continue;
    }
    if (selectedArea === 'Other') {
      if (backups.length === 0) {
        note('No backups yet. pimpt creates one before changing settings.json.', 'Other');
        continue;
      }

      const selectedAction = bail(
        await select<string>({
          message: 'Other',
          options: [
            {
              value: 'restoreBackup',
              label: 'Restore settings backup',
              hint: 'Choose a saved version',
            },
            { value: 'back', label: 'Back', hint: 'Choose another area' },
          ],
          initialValue: 'restoreBackup',
        })
      );
      if (selectedAction === 'back') continue;
      if (!settingsPath) {
        throw new Error('Windows Terminal settings.json could not be found.');
      }

      const selectedBackup = bail(
        await select<string>({
          message: 'Which backup should be restored?',
          options: backups.map((backup) => ({
            value: backup.path,
            label: backup.createdAt.toLocaleString(),
            hint: backup.path,
          })),
          ...(backups[0] ? { initialValue: backups[0].path } : {}),
        })
      );
      const shouldRestore = bail(
        await confirm({
          message:
            'This replaces settings.json. The current file will be backed up first. Continue?',
          initialValue: false,
        })
      );
      if (!shouldRestore) continue;

      const restoreSpinner = spinner();
      restoreSpinner.start('Restoring settings.json backup…');
      try {
        const safetyBackupPath = restoreSettingsBackup(settingsPath, selectedBackup);
        restoreSpinner.stop('Settings restored successfully.');
        log.info(pc.dim(`The previous settings were backed up to ${safetyBackupPath}`));
        outro(pc.green('✓ Windows Terminal settings.json was restored.'));
      } catch (error) {
        restoreSpinner.error('Could not restore the settings backup.');
        throw error;
      }
      return;
    }

    while (true) {
      const visibleSettings = selectableSettings.filter(
        (setting) =>
          setting.group === selectedArea &&
          !(answers.terminalIcons === true && setting.id === 'fontFace')
      );
      const options = visibleSettings.map((setting) => ({
        value: setting.id,
        label:
          answers[setting.id] === undefined ? setting.label : `${pc.green('●')} ${setting.label}`,
        hint: setting.hint,
      }));
      options.push({
        value: 'back',
        label: 'Back',
        hint: 'Choose another area',
      });

      const firstOption = options[0];
      if (!firstOption) {
        throw new Error(`No settings are available in ${selectedArea}.`);
      }

      const selectedInitialValue =
        initialPickerValue && options.some((option) => option.value === initialPickerValue)
          ? initialPickerValue
          : firstOption.value;
      const selectedId = bail(
        await select<string>({
          message: selectedArea,
          options,
          initialValue: selectedInitialValue,
        })
      );
      if (selectedId === 'back') break;

      const setting = selectableSettings.find(
        (candidate) => candidate.id === selectedId && candidate.group === selectedArea
      );
      if (!setting) {
        throw new Error(`Unknown setting selected in ${selectedArea}: ${selectedId}`);
      }

      initialPickerValue = selectedId;
      log.step(pc.bold(pc.cyan(setting.group)));
      answers[setting.id] = await askSetting(setting, answers[setting.id]);
      if (setting.id === 'terminalIcons' && answers.terminalIcons === true) {
        answers.fontFace = NERD_FONT_FAMILY;
        initialPickerValue = 'terminalIcons';
      }
    }
  }

  renderSummary(answers);

  const proceed = bail(
    await confirm({
      message: 'Install these settings? (writes to settings.json)',
      initialValue: true,
    })
  );

  if (!proceed) {
    cancel('Setup cancelled. Nothing was changed.');
    return;
  }

  const s = spinner();
  s.start('Building your configuration…');
  await delay(300);
  s.message('Checking compatibility…');
  await delay(300);
  s.message(
    answers.terminalIcons === true ||
      answers.historyPreview === true ||
      answers.lazyGit === true ||
      answers.crossDriveCd === true ||
      answers.treeListing === true ||
      answers.hidePowerShellBanner === true
      ? 'Applying PowerShell options…'
      : 'Writing settings.json…'
  );
  await delay(400);

  try {
    await applySettings(answers, settingsPath);
    if (answers.historyPreview === true) {
      installPSReadLineModule();
      addHistoryPreviewToPowerShellProfile();
    }
    if (answers.lazyGit === true) {
      addLazyGitToPowerShellProfile();
    }
    if (answers.crossDriveCd === true) {
      addCrossDriveCdToPowerShellProfile();
    }
    if (answers.treeListing === true) {
      addTreeListingToPowerShellProfile();
    }
    if (answers.powershellAliases === true) {
      addPowerShellAliasesToPowerShellProfile();
    }
  } catch (error) {
    if (!(error instanceof InvalidSettingsFileError)) throw error;

    s.error(error.message);
    process.exitCode = 1;
    return;
  }

  s.stop('Configuration applied successfully.');

  const fontSelected = answers.fontFace !== undefined && answers.fontFace !== 'keep';
  const powerShellFeatureSelected =
    answers.terminalIcons === true ||
    answers.historyPreview === true ||
    answers.lazyGit === true ||
    answers.crossDriveCd === true ||
    answers.treeListing === true ||
    answers.powershellAliases === true ||
    answers.hidePowerShellBanner === true;
  if (fontSelected || powerShellFeatureSelected) openNewTerminalTab();
  outro(
    [
      `${pc.green('✓')} Your configuration is ready.`,
      pc.dim('Your selected settings and features are ready.'),
    ].join('\n')
  );
}
