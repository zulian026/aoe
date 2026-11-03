import { describe, it, expect, vi } from 'vitest';
import { executeDoctor } from '../commands/doctor.js';
import { ExitCode } from '../runtime/exit-codes.js';
import { CliError } from '../utils/errors.js';

describe('aoe doctor command', () => {
  it('executes doctor checks and returns structured categories', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await executeDoctor();
    expect(result.passed).toBe(true);
    expect(result.categories.length).toBe(6);

    const categoryTitles = result.categories.map((c) => c.title);
    expect(categoryTitles).toContain('Runtime');
    expect(categoryTitles).toContain('Configuration');
    expect(categoryTitles).toContain('Themes');
    expect(categoryTitles).toContain('Adapters');
    expect(categoryTitles).toContain('Terminal');
    expect(categoryTitles).toContain('Skill');

    logSpy.mockRestore();
  });

  it('outputs valid JSON to stdout when json: true', async () => {
    let capturedOutput = '';
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      capturedOutput += chunk.toString();
      return true;
    });

    const result = await executeDoctor({ json: true });
    expect(result.passed).toBe(true);

    stdoutSpy.mockRestore();

    // Verify stdout is pure valid JSON
    const parsed = JSON.parse(capturedOutput);
    expect(parsed.passed).toBe(true);
    expect(parsed.summary.failed).toBe(0);
    expect(parsed.categories.length).toBe(6);
  });

  it('fails with ENVIRONMENT_ERROR (6) when SKILL.md cannot be located', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await executeDoctor('/tmp/non-existent-skill-dir/SKILL.md');
      expect.fail('Expected doctor to fail');
    } catch (err) {
      expect(err).toBeInstanceOf(CliError);
      expect((err as CliError).exitCode).toBe(ExitCode.ENVIRONMENT_ERROR);
      expect((err as CliError).message).toContain(
        'AOE doctor detected environment or configuration failures',
      );
    } finally {
      logSpy.mockRestore();
    }
  });
});
