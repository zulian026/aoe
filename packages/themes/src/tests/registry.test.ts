import { describe, it, expect, beforeEach } from 'vitest';
import {
  ThemeRegistry,
  DuplicateThemeError,
  ThemeNotFoundError,
  OBSIDIAN_THEME,
  type AoeTheme,
} from '../index.js';

describe('ThemeRegistry', () => {
  let registry: ThemeRegistry;

  beforeEach(() => {
    registry = new ThemeRegistry();
  });

  it('initializes with built-in themes and default to obsidian', () => {
    expect(registry.has('obsidian')).toBe(true);
    expect(registry.has('light')).toBe(true);
    expect(registry.has('high-contrast')).toBe(true);

    const defaultTheme = registry.getDefault();
    expect(defaultTheme.id).toBe('obsidian');

    const list = registry.list();
    expect(list.length).toBeGreaterThanOrEqual(3);
    expect(list.some((t) => t.id === 'obsidian')).toBe(true);
    expect(list.some((t) => t.id === 'light')).toBe(true);
    expect(list.some((t) => t.id === 'high-contrast')).toBe(true);
  });

  it('registers and retrieves custom validated themes', () => {
    const custom: AoeTheme = {
      ...OBSIDIAN_THEME,
      id: 'custom-solar',
      name: 'Custom Solar',
      version: '1.0.0',
    };

    registry.register(custom);
    expect(registry.has('custom-solar')).toBe(true);

    const retrieved = registry.get('custom-solar');
    expect(retrieved.name).toBe('Custom Solar');
    expect(Object.isFrozen(retrieved)).toBe(true);
  });

  it('rejects duplicate theme registration unless replace is true', () => {
    const custom: AoeTheme = {
      ...OBSIDIAN_THEME,
      id: 'dup-test',
      name: 'Duplicate Test',
    };

    registry.register(custom);

    expect(() => registry.register(custom)).toThrow(DuplicateThemeError);

    // With replace: true
    expect(() => registry.register(custom, { replace: true })).not.toThrow();
  });

  it('throws ThemeNotFoundError when retrieving unknown theme', () => {
    expect(() => registry.get('nonexistent-theme')).toThrow(ThemeNotFoundError);
  });

  it('allows changing the default theme', () => {
    registry.setDefault('light');
    expect(registry.getDefault().id).toBe('light');

    expect(() => registry.setDefault('unknown')).toThrow(ThemeNotFoundError);
  });

  it('resets to clean initial state', () => {
    registry.register({ ...OBSIDIAN_THEME, id: 'temporary-theme' });
    registry.setDefault('light');

    registry.reset();

    expect(registry.has('temporary-theme')).toBe(false);
    expect(registry.getDefault().id).toBe('obsidian');
  });
});
