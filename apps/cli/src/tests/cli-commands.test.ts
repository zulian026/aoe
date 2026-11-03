import { describe, it, expect, vi } from 'vitest';
import { createProgram, runCli, CLI_VERSION } from '../program.js';
import { ExitCode } from '../runtime/exit-codes.js';

describe('CLI Commands & Options', () => {
  it('initializes root program with all registered commands', () => {
    const program = createProgram();
    expect(program.name()).toBe('aoe');
    expect(program.version()).toContain(CLI_VERSION);

    const commandNames = program.commands.map((cmd) => cmd.name());
    expect(commandNames).toContain('render');
    expect(commandNames).toContain('pipe');
    expect(commandNames).toContain('theme');
    expect(commandNames).toContain('doctor');
    expect(commandNames).toContain('skill');
    expect(commandNames).toContain('version');
  });

  it('handles --version flag gracefully with exit code 0', async () => {
    const exitCode = await runCli(['node', 'aoe', '--version']);
    expect(exitCode).toBe(ExitCode.SUCCESS);
  });

  it('handles "version" command gracefully with exit code 0', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitCode = await runCli(['node', 'aoe', 'version']);
    expect(exitCode).toBe(ExitCode.SUCCESS);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`AOE CLI v${CLI_VERSION}`));
    logSpy.mockRestore();
  });

  it('handles --help flag with exit code 0', async () => {
    const exitCode = await runCli(['node', 'aoe', '--help']);
    expect(exitCode).toBe(ExitCode.SUCCESS);
  });

  it('returns INVALID_ARGUMENTS (2) for unknown command', async () => {
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const exitCode = await runCli(['node', 'aoe', 'unknown-subcommand']);
    expect(exitCode).toBe(ExitCode.INVALID_ARGUMENTS);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('unknown command'));
    errSpy.mockRestore();
  });

  it('returns INVALID_ARGUMENTS (2) for unknown options', async () => {
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const exitCode = await runCli(['node', 'aoe', 'render', '--non-existent-option']);
    expect(exitCode).toBe(ExitCode.INVALID_ARGUMENTS);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('unknown option'));
    errSpy.mockRestore();
  });
});
