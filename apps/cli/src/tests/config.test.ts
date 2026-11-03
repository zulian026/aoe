import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  AoeConfigSchema,
  DEFAULT_CONFIG,
  getConfigFilePath,
  loadConfig,
  saveConfig,
  type AoeConfig,
} from '../config/index.js';

describe('Configuration System', () => {
  let tempDir: string;
  let customConfigPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoe-config-test-'));
    customConfigPath = path.join(tempDir, 'custom-config.json');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Cleanup best effort
    }
  });

  it('validates default configuration schema', () => {
    const parsed = AoeConfigSchema.parse({});
    expect(parsed.version).toBe(1);
    expect(parsed.theme).toBe('obsidian');
    expect(parsed.output.mode).toBe('auto');
    expect(parsed.adapters.minimumConfidence).toBe('high');
  });

  it('resolves config file path with environment override', () => {
    const original = process.env.AOE_CONFIG_PATH;
    try {
      process.env.AOE_CONFIG_PATH = '/tmp/override-aoe/config.json';
      expect(getConfigFilePath()).toBe(path.resolve('/tmp/override-aoe/config.json'));
    } finally {
      process.env.AOE_CONFIG_PATH = original;
    }
  });

  it('loads default configuration when file does not exist', () => {
    const result = loadConfig(customConfigPath);
    expect(result.exists).toBe(false);
    expect(result.isDefault).toBe(true);
    expect(result.config.theme).toBe('obsidian');
    expect(result.error).toBeUndefined();
  });

  it('atomically saves and reloads configuration', async () => {
    const customConfig = {
      ...DEFAULT_CONFIG,
      theme: 'high-contrast',
      output: { mode: 'static' as const, showTimestamps: true },
    };

    const savedPath = await saveConfig(customConfig, customConfigPath);
    expect(savedPath).toBe(customConfigPath);
    expect(fs.existsSync(customConfigPath)).toBe(true);

    const reloaded = loadConfig(customConfigPath);
    expect(reloaded.exists).toBe(true);
    expect(reloaded.isDefault).toBe(false);
    expect(reloaded.config.theme).toBe('high-contrast');
    expect(reloaded.config.output.mode).toBe('static');
  });

  it('handles malformed JSON file gracefully', () => {
    fs.writeFileSync(customConfigPath, '{ invalid json: [ }', 'utf-8');
    const result = loadConfig(customConfigPath);
    expect(result.exists).toBe(true);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('Malformed JSON');
    expect(result.config.theme).toBe('obsidian');
  });

  it('handles invalid schema fields gracefully', () => {
    fs.writeFileSync(
      customConfigPath,
      JSON.stringify({ version: 999, theme: '', output: { mode: 'invalid-mode' } }),
      'utf-8',
    );
    const result = loadConfig(customConfigPath);
    expect(result.exists).toBe(true);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('Configuration validation failed');
  });

  it('rejects saving invalid config object', async () => {
    const invalidConfig = {
      version: 2,
      theme: '',
      output: { mode: 'invalid', showTimestamps: false },
      adapters: { autoDetect: true, minimumConfidence: 'high' },
    } as unknown as AoeConfig;

    await expect(saveConfig(invalidConfig, customConfigPath)).rejects.toThrow(
      'Invalid configuration',
    );
  });
});
