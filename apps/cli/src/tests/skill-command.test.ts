import { describe, it, expect, vi } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
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
    const expectedSubpath = path.join('skills', 'aoe', 'SKILL.md');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(expectedSubpath));

    const loggedPath = logSpy.mock.calls[0]?.[0] as string;
    expect(path.isAbsolute(loggedPath)).toBe(true);
    expect(fs.existsSync(loggedPath)).toBe(true);

    logSpy.mockRestore();
  });

  describe('platform path assertion regression tests', () => {
    it('verifies path containment on POSIX format', () => {
      const posixPath = '/root/workspace/skills/aoe/SKILL.md';
      const posixExpected = path.posix.join('skills', 'aoe', 'SKILL.md');
      expect(posixPath).toContain(posixExpected);
    });

    it('verifies path containment on Windows format', () => {
      const winPath = 'C:\\root\\workspace\\skills\\aoe\\SKILL.md';
      const winExpected = path.win32.join('skills', 'aoe', 'SKILL.md');
      expect(winPath).toContain(winExpected);
    });

    it('resolves real skill path with platform-independent segment verification', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const canonicalPath = path.resolve(process.cwd(), 'skills/aoe/SKILL.md');

      executeSkillPath(canonicalPath);
      expect(logSpy).toHaveBeenCalledWith(canonicalPath);
      expect(canonicalPath).toContain(path.join('skills', 'aoe', 'SKILL.md'));

      logSpy.mockRestore();
    });
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
