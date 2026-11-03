import { describe, it, expect } from 'vitest';
import { createProgram, CLI_VERSION } from './index.js';

describe('@aoe/cli', () => {
  it('creates commander program with proper configuration', () => {
    const program = createProgram();
    expect(program.name()).toBe('aoe');
    expect(program.version()).toContain(CLI_VERSION);
    expect(program.commands.map((cmd) => cmd.name())).toContain('version');
  });
});
