import { Command } from 'commander';
import fs from 'node:fs';
import { resolveSkillPath } from '../utils/skill-path.js';
import { CliError } from '../utils/errors.js';
import { ExitCode } from '../runtime/exit-codes.js';

export function registerSkillCommand(program: Command): void {
  const skillCmd = program
    .command('skill')
    .description('Access and inspect the standalone AOE Skill definition')
    .action(async () => {
      executeSkillShow();
    });

  skillCmd
    .command('show')
    .description('Display the raw contents of SKILL.md')
    .action(() => {
      executeSkillShow();
    });

  skillCmd
    .command('path')
    .description('Print the absolute filesystem path to SKILL.md')
    .action(() => {
      executeSkillPath();
    });
}

export function executeSkillShow(customSkillPath?: string): void {
  const skillPath = customSkillPath ?? resolveSkillPath();

  if (!skillPath || !fs.existsSync(skillPath)) {
    throw new CliError('Unable to locate "skills/aoe/SKILL.md".', {
      exitCode: ExitCode.ENVIRONMENT_ERROR,
      hint: 'Ensure skills/aoe/SKILL.md exists in the repository or set AOE_SKILL_PATH.',
    });
  }

  const content = fs.readFileSync(skillPath, 'utf-8');
  process.stdout.write(content);
}

export function executeSkillPath(customSkillPath?: string): void {
  const skillPath = customSkillPath ?? resolveSkillPath();

  if (!skillPath || !fs.existsSync(skillPath)) {
    throw new CliError('Unable to locate "skills/aoe/SKILL.md".', {
      exitCode: ExitCode.ENVIRONMENT_ERROR,
      hint: 'Ensure skills/aoe/SKILL.md exists in the repository or set AOE_SKILL_PATH.',
    });
  }

  console.log(skillPath);
}
