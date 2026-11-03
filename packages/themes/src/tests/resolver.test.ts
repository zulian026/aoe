import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  resolveTheme,
  resolveThemeColor,
  resolveStatusColor,
  resolveSymbol,
  isNoColor,
  isForceColor,
  shouldSuppressColor,
  OBSIDIAN_THEME,
  LIGHT_THEME,
} from '../index.js';

describe('Theme Resolution & Terminal Capabilities', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NO_COLOR;
    delete process.env.FORCE_COLOR;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('respects NO_COLOR environment variable', () => {
    process.env.NO_COLOR = '1';
    expect(isNoColor()).toBe(true);
    expect(shouldSuppressColor()).toBe(true);

    const resolved = resolveTheme(OBSIDIAN_THEME);
    expect(resolved.colors.primary).toBeUndefined();
    expect(resolved.status.completed).toBeUndefined();
    expect(resolved.colorSuppressed).toBe(true);
  });

  it('respects FORCE_COLOR over NO_COLOR', () => {
    process.env.NO_COLOR = '1';
    process.env.FORCE_COLOR = '1';
    expect(isForceColor()).toBe(true);
    expect(shouldSuppressColor()).toBe(false);

    const resolved = resolveTheme(OBSIDIAN_THEME);
    expect(resolved.colors.primary).toBe('#8A2BE2');
    expect(resolved.colorSuppressed).toBe(false);
  });

  it('resolves semantic theme colors when color is enabled', () => {
    expect(resolveThemeColor('success', OBSIDIAN_THEME)).toBe('#00F090');
    expect(resolveThemeColor('success', LIGHT_THEME)).toBe('#1A7F37');
    expect(resolveStatusColor('completed', OBSIDIAN_THEME)).toBe('#00F090');
    expect(resolveStatusColor('failed', OBSIDIAN_THEME)).toBe('#FF3366');
  });

  it('resolves symbols in Unicode and ASCII modes', () => {
    expect(resolveSymbol('success', OBSIDIAN_THEME, true)).toBe('✔');
    expect(resolveSymbol('success', OBSIDIAN_THEME, false)).toBe('[OK]');

    expect(resolveSymbol('failure', OBSIDIAN_THEME, true)).toBe('✖');
    expect(resolveSymbol('failure', OBSIDIAN_THEME, false)).toBe('[FAIL]');

    expect(resolveSymbol('treeBranch', OBSIDIAN_THEME, true)).toBe('├─ ');
    expect(resolveSymbol('treeBranch', OBSIDIAN_THEME, false)).toBe('|-- ');
  });

  it('resolves complete theme structure accurately', () => {
    const resolved = resolveTheme(OBSIDIAN_THEME, { unicode: true });
    expect(resolved.colors.background).toBe('#0D1117');
    expect(resolved.status.running).toBe('#FFB800');
    expect(resolved.symbols.running).toBe('●');
    expect(resolved.spacing.md).toBe(3);
  });
});
