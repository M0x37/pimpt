#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import pc from 'picocolors';
import * as Sentry from '@sentry/node';
import { runInstaller, exportConfig, importConfig, applyAnswers } from './installer.js';
import { findSettingsPath } from './wtsettings.js';

function readVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  return pkg.version;
}

function initSentry(): void {
  const dsn = process.env.PIMPT_SENTRY_DSN;
  const options: Sentry.NodeOptions = {
    enabled: !!dsn,
    release: `pimpt@${readVersion()}`,
    environment: process.env.PIMPT_SENTRY_ENVIRONMENT ?? 'production',
    tracesSampleRate: 0.0,
    sendDefaultPii: false,
    beforeSend(event) {
      // Never send Windows Terminal settings content or personal paths to Sentry.
      if (event.request?.url && /settings\.json/i.test(event.request.url)) {
        return null;
      }
      if (event.extra && typeof event.extra === 'object') {
        for (const key of Object.keys(event.extra)) {
          if (/path|settings|profile/i.test(key)) {
            delete event.extra[key];
          }
        }
      }
      return event;
    },
  };
  if (dsn) {
    options.dsn = dsn;
  }
  Sentry.init(options);
}

function printHelp(): void {
  console.log(`
${pc.bold(pc.cyan('pimpt'))} ${pc.dim('— interactive Windows Terminal setup assistant')}

${pc.bold('Usage')}
  pimpt                   Start the interactive installer
  pimpt --apply <path>    Apply settings non-interactively from a JSON config file
  pimpt --dry-run <path>  Preview changes from a JSON config file without writing
  pimpt config export <path>  Export the current pimpt configuration to a JSON file
  pimpt config import <path>  Import a pimpt configuration from a JSON file
  pimpt --help            Show this help
  pimpt --version         Show the installed version

${pc.bold('Status')}
  Preview: preferences are collected, but settings.json is not modified yet.
  With --apply, preferences are read from the config file and written to
  settings.json without any interactive prompts.
  With --dry-run, the planned changes are shown but nothing is written.
`);
}

export async function main(): Promise<void> {
  initSentry();
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(`pimpt ${readVersion()}`);
    return;
  }

  const applyIndex = args.indexOf('--apply');
  if (applyIndex !== -1) {
    const configPath = args[applyIndex + 1];
    if (!configPath) {
      console.error('Missing value for --apply. Usage: pimpt --apply <path>');
      printHelp();
      process.exitCode = 1;
      return;
    }
    await runInstaller(configPath);
    return;
  }

  const dryRunIndex = args.indexOf('--dry-run');
  if (dryRunIndex !== -1) {
    const configPath = args[dryRunIndex + 1];
    if (!configPath) {
      console.error('Missing value for --dry-run. Usage: pimpt --dry-run <path>');
      printHelp();
      process.exitCode = 1;
      return;
    }
    await runInstaller(configPath, { dryRun: true, profileIndex: undefined });
    return;
  }

  const configIndex = args.indexOf('config');
  if (configIndex !== -1) {
    const subcommand = args[configIndex + 1];
    const configPath = args[configIndex + 2];
    if (subcommand === 'export') {
      if (!configPath) {
        console.error('Missing value for export. Usage: pimpt config export <path>');
        printHelp();
        process.exitCode = 1;
        return;
      }
      await exportConfig(configPath);
      return;
    }
    if (subcommand === 'import') {
      if (!configPath) {
        console.error('Missing value for import. Usage: pimpt config import <path>');
        printHelp();
        process.exitCode = 1;
        return;
      }
      const answers = importConfig(configPath);
      const settingsPath = findSettingsPath();
      if (!settingsPath) {
        console.error('Windows Terminal settings.json could not be found.');
        process.exitCode = 1;
        return;
      }
      await applyAnswers(answers, settingsPath);
      return;
    }
    console.error(`Unknown subcommand: ${subcommand}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  if (args.length > 0) {
    console.error(`Unknown option: ${args[0]}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  console.log(pc.dim(`v${readVersion()}`));
  await runInstaller();
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    Sentry.captureException(
      error instanceof Error ? error : new Error(String(error)),
      { tags: { cli: 'pimpt' } }
    );
    console.error(pc.red('pimpt failed:'));
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  }
}

process.on('unhandledRejection', (reason) => {
  Sentry.captureException(
    reason instanceof Error ? reason : new Error(String(reason)),
    { tags: { cli: 'pimpt', type: 'unhandledRejection' } }
  );
});

process.on('uncaughtException', (error) => {
  Sentry.captureException(error, { tags: { cli: 'pimpt', type: 'uncaughtException' } });
  console.error(pc.red('pimpt crashed:'));
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
  process.exit(1);
});
