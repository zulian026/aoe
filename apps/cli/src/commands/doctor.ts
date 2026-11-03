import { Command } from 'commander';
import fs from 'node:fs';
import { PROTOCOL_VERSION } from '@aoe/protocol';
import { defaultRegistry } from '@aoe/themes';
import { createDefaultAdapterManager } from '@aoe/adapters';
import { isInteractiveSuitable, isNoColor, supportsColor } from '@aoe/renderer';
import { loadConfig, getConfigFilePath } from '../config/index.js';
import { resolveSkillPath } from '../utils/skill-path.js';
import { ExitCode } from '../runtime/exit-codes.js';
import { CliError } from '../utils/errors.js';

export interface DoctorCheckItem {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  details?: string;
}

export interface DoctorCategory {
  title: string;
  checks: DoctorCheckItem[];
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Verify system environment, dependencies, themes, and configuration')
    .action(async () => {
      await executeDoctor();
    });
}

export async function executeDoctor(customSkillPath?: string): Promise<{
  passed: boolean;
  categories: DoctorCategory[];
}> {
  const categories: DoctorCategory[] = [];

  // 1. Runtime Checks
  const runtimeChecks: DoctorCheckItem[] = [];
  const nodeVersion = process.versions.node;
  const majorNode = parseInt(nodeVersion.split('.')[0], 10);
  if (majorNode >= 18) {
    runtimeChecks.push({
      name: `Node.js (v${nodeVersion})`,
      status: 'pass',
    });
  } else {
    runtimeChecks.push({
      name: `Node.js (v${nodeVersion})`,
      status: 'fail',
      details: 'Node.js version 18.0.0 or higher is required.',
    });
  }

  runtimeChecks.push({
    name: `CLI Version (v0.1.0, Protocol v${PROTOCOL_VERSION})`,
    status: 'pass',
  });
  categories.push({ title: 'Runtime', checks: runtimeChecks });

  // 2. Configuration Checks
  const configChecks: DoctorCheckItem[] = [];
  const configPath = getConfigFilePath();
  const configResult = loadConfig();

  if (configResult.exists) {
    configChecks.push({
      name: `Config file (${configPath})`,
      status: 'pass',
    });
  } else {
    configChecks.push({
      name: `Config file (${configPath})`,
      status: 'warn',
      details: 'No custom config found; running with default configuration.',
    });
  }

  if (configResult.error) {
    configChecks.push({
      name: 'Config validation',
      status: 'fail',
      details: configResult.error.message,
    });
  } else {
    configChecks.push({
      name: 'Config validation',
      status: 'pass',
    });
  }
  categories.push({ title: 'Configuration', checks: configChecks });

  // 3. Theme Checks
  const themeChecks: DoctorCheckItem[] = [];
  const themes = defaultRegistry.list();
  if (themes.length >= 3) {
    themeChecks.push({
      name: `Theme registry (${themes.length} themes registered)`,
      status: 'pass',
    });
  } else {
    themeChecks.push({
      name: 'Theme registry',
      status: 'fail',
      details: 'Expected at least 3 default themes registered.',
    });
  }

  const themeIds = new Set(themes.map((t) => t.id));
  for (const requiredTheme of ['obsidian', 'light', 'high-contrast']) {
    if (themeIds.has(requiredTheme)) {
      themeChecks.push({
        name: `Built-in theme: ${requiredTheme}`,
        status: 'pass',
      });
    } else {
      themeChecks.push({
        name: `Built-in theme: ${requiredTheme}`,
        status: 'fail',
        details: `Theme "${requiredTheme}" is missing from default registry.`,
      });
    }
  }
  categories.push({ title: 'Themes', checks: themeChecks });

  // 4. Adapters Checks
  const adapterChecks: DoctorCheckItem[] = [];
  const manager = createDefaultAdapterManager();
  const adapters = manager.list();
  const adapterIds = new Set(adapters.map((a) => a.id));

  for (const reqAdapter of ['claude-code', 'gemini-cli', 'generic-jsonl']) {
    if (adapterIds.has(reqAdapter)) {
      adapterChecks.push({
        name: `Adapter: ${reqAdapter}`,
        status: 'pass',
      });
    } else {
      adapterChecks.push({
        name: `Adapter: ${reqAdapter}`,
        status: 'fail',
        details: `Adapter "${reqAdapter}" is not registered in AdapterManager.`,
      });
    }
  }
  categories.push({ title: 'Adapters', checks: adapterChecks });

  // 5. Terminal Checks
  const terminalChecks: DoctorCheckItem[] = [];
  const isTty = Boolean(process.stdout.isTTY);
  terminalChecks.push({
    name: `TTY detection (${isTty ? 'Interactive TTY' : 'Non-TTY / Pipe'})`,
    status: 'pass',
  });

  const noColor = isNoColor();
  const colorSupport = supportsColor(process.stdout);
  terminalChecks.push({
    name: `Color environment (NO_COLOR: ${noColor ? 'active' : 'disabled'}, Color: ${colorSupport ? 'supported' : 'unsupported'})`,
    status: 'pass',
  });

  const interactiveSuitable = isInteractiveSuitable(process.stdout);
  terminalChecks.push({
    name: `Interactive render suitability (${interactiveSuitable ? 'suitable' : 'fallback to static'})`,
    status: 'pass',
  });
  categories.push({ title: 'Terminal', checks: terminalChecks });

  // 6. Skill Checks
  const skillChecks: DoctorCheckItem[] = [];
  const skillFile = customSkillPath ?? resolveSkillPath();
  if (skillFile && fs.existsSync(skillFile)) {
    skillChecks.push({
      name: `SKILL.md (${skillFile})`,
      status: 'pass',
    });
  } else {
    skillChecks.push({
      name: 'SKILL.md',
      status: 'fail',
      details: 'Unable to locate skills/aoe/SKILL.md file.',
    });
  }
  categories.push({ title: 'Skill', checks: skillChecks });

  // Print results
  console.log('AOE Doctor');
  console.log('');

  let hasFailures = false;
  let warnCount = 0;
  let passCount = 0;

  for (const category of categories) {
    console.log(category.title);
    for (const check of category.checks) {
      if (check.status === 'pass') {
        passCount++;
        console.log(`  ✓ ${check.name}`);
      } else if (check.status === 'warn') {
        warnCount++;
        console.log(`  ! ${check.name}`);
        if (check.details) {
          console.log(`    Note: ${check.details}`);
        }
      } else {
        hasFailures = true;
        console.log(`  ✗ ${check.name}`);
        if (check.details) {
          console.log(`    Error: ${check.details}`);
        }
      }
    }
    console.log('');
  }

  console.log('Summary');
  if (!hasFailures) {
    if (warnCount === 0) {
      console.log('  All checks passed.');
    } else {
      console.log(`  All checks passed with ${warnCount} warning(s).`);
    }
  } else {
    console.log(`  Doctor found issues (${passCount} passed, ${warnCount} warnings, failed).`);
  }

  if (hasFailures) {
    throw new CliError('AOE doctor detected environment or configuration failures.', {
      exitCode: ExitCode.ENVIRONMENT_ERROR,
    });
  }

  return { passed: !hasFailures, categories };
}
