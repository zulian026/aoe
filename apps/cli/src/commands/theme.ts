import { Command } from 'commander';
import { defaultRegistry } from '@zyanx04/themes';
import { loadConfig, saveConfig } from '../config/index.js';
import { CliError } from '../utils/errors.js';
import { ExitCode } from '../runtime/exit-codes.js';

export function registerThemeCommand(program: Command): void {
  const themeCmd = program.command('theme').description('Manage AOE visual presentation themes');

  themeCmd
    .command('list')
    .description('List all available themes')
    .action(() => {
      executeThemeList();
    });

  themeCmd
    .command('current')
    .description('Display the currently active theme')
    .action(() => {
      executeThemeCurrent();
    });

  themeCmd
    .command('show <name>')
    .description('Display detailed token and color information for a theme')
    .action((name: string) => {
      executeThemeShow(name);
    });

  themeCmd
    .command('set <name>')
    .description('Set and persist the default theme in user configuration')
    .action(async (name: string) => {
      await executeThemeSet(name);
    });
}

export function executeThemeList(): void {
  const { config } = loadConfig();
  const currentTheme = config.theme ?? 'obsidian';
  const themes = defaultRegistry.list();

  console.log('Available AOE Themes:');
  console.log('');

  for (const theme of themes) {
    const isCurrent = theme.id === currentTheme;
    const marker = isCurrent ? '* (active)' : ' ';
    console.log(
      `  ${marker.padEnd(10)} ${theme.id.padEnd(16)} ${theme.name} — ${theme.description}`,
    );
  }

  console.log('');
  console.log('Use "aoe theme set <name>" to change the active theme.');
}

export function executeThemeCurrent(): void {
  const { config, path: configPath } = loadConfig();
  const currentTheme = config.theme ?? 'obsidian';
  console.log(`Active theme: ${currentTheme} (configured in ${configPath})`);
}

export function executeThemeShow(name: string): void {
  const available = defaultRegistry.list().map((t) => t.id);
  let theme;

  try {
    theme = defaultRegistry.get(name);
  } catch {
    throw new CliError(`Theme "${name}" not found.`, {
      exitCode: ExitCode.INVALID_ARGUMENTS,
      hint: `Available themes: ${available.join(', ')}`,
    });
  }

  console.log(`Theme: ${theme.name} (${theme.id})`);
  console.log(`Description: ${theme.description}`);
  console.log('');
  console.log('Colors:');
  console.log(`  Primary:     ${theme.tokens.colors.primary}`);
  console.log(`  Secondary:   ${theme.tokens.colors.secondary}`);
  console.log(`  Background:  ${theme.tokens.colors.background}`);
  console.log(`  Foreground:  ${theme.tokens.colors.foreground}`);
  console.log(`  Muted:       ${theme.tokens.colors.foregroundMuted}`);
  console.log(`  Border:      ${theme.tokens.colors.border}`);
  console.log('');
  console.log('Status Colors:');
  console.log(`  Running:     ${theme.tokens.status.running}`);
  console.log(`  Completed:   ${theme.tokens.status.completed}`);
  console.log(`  Failed:      ${theme.tokens.status.failed}`);
  console.log(`  Blocked:     ${theme.tokens.status.blocked}`);
  console.log(`  Warning:     ${theme.tokens.status.warning}`);
  console.log('');
  console.log('Symbols:');
  console.log(`  Running:     ${theme.tokens.symbols.running.unicode}`);
  console.log(`  Completed:   ${theme.tokens.symbols.completed.unicode}`);
  console.log(`  Failure:     ${theme.tokens.symbols.failure.unicode}`);
  console.log(`  Blocked:     ${theme.tokens.symbols.blocked.unicode}`);
}

export async function executeThemeSet(name: string, customConfigPath?: string): Promise<void> {
  const available = defaultRegistry.list().map((t) => t.id);

  try {
    defaultRegistry.get(name);
  } catch {
    throw new CliError(`Theme "${name}" does not exist.`, {
      exitCode: ExitCode.INVALID_ARGUMENTS,
      hint: `Available themes: ${available.join(', ')}`,
    });
  }

  const { config } = loadConfig(customConfigPath);
  config.theme = name;

  const savedPath = await saveConfig(config, customConfigPath);
  console.log(`Theme set to "${name}". Configuration saved to ${savedPath}.`);
}
