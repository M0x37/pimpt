#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import pc from 'picocolors';
import { runInstaller } from './installer.js';

function readVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  return pkg.version;
}

function printHelp(): void {
  console.log(`
${pc.bold(pc.cyan('pimpt'))} ${pc.dim('— interactive Windows Terminal setup assistant')}

${pc.bold('Usage')}
  pimpt                   Start the interactive installer
  pimpt --apply <path>    Apply settings non-interactively from a JSON config file
  pimpt --help            Show this help
  pimpt --version         Show the installed version

${pc.bold('Status')}
  Preview: preferences are collected, but settings.json is not modified yet.
  With --apply, preferences are read from the config file and written to
  settings.json without any interactive prompts.
`);
}

export async function main(): Promise<void> {
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
    console.error(pc.red('pimpt failed:'));
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  }
}
