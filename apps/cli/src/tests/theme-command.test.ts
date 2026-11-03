import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  executeThemeList,
  executeThemeCurrent,
  executeThemeShow,
  executeThemeSet,
} from '../commands/theme.js';
import { loadConfig } from '../config/index.js';
import { ExitCode } from '../runtime/exit-codes.js';
import { CliError } from '../utils/errors.js';

describe('aoe theme commands', () => {
  let tempDir: string;
  let customConfigPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoe-theme-test-'));
    customConfigPath = path.join(tempDir, 'config.json');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best effort
    }
  });

  it('lists all available themes and identifies active theme', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    executeThemeList();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Available AOE Themes:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('obsidian'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('light'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('high-contrast'));
    logSpy.mockRestore();
  });

  it('displays the current active theme', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    executeThemeCurrent();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Active theme: obsidian'));
    logSpy.mockRestore();
  });

  it('displays detailed information for a specific theme', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    executeThemeShow('obsidian');

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Theme: obsidian'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Colors:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Primary:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Status Colors:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Symbols:'));
    logSpy.mockRestore();
  });

  it('fails with INVALID_ARGUMENTS (2) when showing a non-existent theme', () => {
    try {
      executeThemeShow('theme-does-not-exist');
      expect.fail('Expected error');
    } catch (err) {
      expect(err).toBeInstanceOf(CliError);
      expect((err as CliError).exitCode).toBe(ExitCode.INVALID_ARGUMENTS);
      expect((err as CliError).message).toContain('Theme "theme-does-not-exist" not found');
    }
  });

  it('sets and persists valid theme in user configuration', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await executeThemeSet('light', customConfigPath);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Theme set to "light"'));
    const loaded = loadConfig(customConfigPath);
    expect(loaded.config.theme).toBe('light');
    logSpy.mockRestore();
  });

  it('fails with INVALID_ARGUMENTS (2) when setting an unknown theme', async () => {
    await expect(executeThemeSet('invalid-theme', customConfigPath)).rejects.toThrow(
      'Theme "invalid-theme" does not exist',
    );
  });
});
