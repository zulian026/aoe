import { describe, it, expect, vi } from 'vitest';
import { executeSkillShow, executeSkillPath } from '../commands/skill.js';
import { ExitCode } from '../runtime/exit-codes.js';
import { CliError } from '../utils/errors.js';

describe('aoe skill command', () => {
  it('outputs the raw content of SKILL.md to stdout', () => {
    let captured = '';
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      captured += chunk.toString();
      return true;
    });

    executeSkillShow();
    expect(captured).toContain('name: aoe');
    expect(captured).toContain('Zero Hallucination');
    expect(captured).toContain('Never Fabricate Progress');

    writeSpy.mockRestore();
  });

  it('prints the resolved absolute filesystem path to SKILL.md', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    executeSkillPath();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('skills/aoe/SKILL.md'));

    logSpy.mockRestore();
  });

  it('fails with ENVIRONMENT_ERROR (6) when skill path is non-existent', () => {
    try {
      executeSkillShow('/tmp/non-existent-skill/SKILL.md');
      expect.fail('Expected error');
    } catch (err) {
      expect(err).toBeInstanceOf(CliError);
      expect((err as CliError).exitCode).toBe(ExitCode.ENVIRONMENT_ERROR);
      expect((err as CliError).message).toContain('Unable to locate "skills/aoe/SKILL.md"');
    }
  });
});
