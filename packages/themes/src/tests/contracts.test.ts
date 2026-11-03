import { describe, it, expect } from 'vitest';
import {
  AoeThemeSchema,
  ColorValueSchema,
  OBSIDIAN_THEME,
  LIGHT_THEME,
  HIGH_CONTRAST_THEME,
  validateTheme,
  isValidTheme,
  ThemeValidationError,
} from '../index.js';

describe('Theme Contracts and Validation', () => {
  it('validates color value formats', () => {
    expect(ColorValueSchema.safeParse('#fff').success).toBe(true);
    expect(ColorValueSchema.safeParse('#00F090').success).toBe(true);
    expect(ColorValueSchema.safeParse('rgba(255, 0, 0, 0.5)').success).toBe(true);
    expect(ColorValueSchema.safeParse('green').success).toBe(true);
    expect(ColorValueSchema.safeParse('yellowBright').success).toBe(true);

    expect(ColorValueSchema.safeParse('invalid-color-123').success).toBe(false);
    expect(ColorValueSchema.safeParse('').success).toBe(false);
  });

  it('validates built-in themes against AoeThemeSchema', () => {
    expect(AoeThemeSchema.safeParse(OBSIDIAN_THEME).success).toBe(true);
    expect(AoeThemeSchema.safeParse(LIGHT_THEME).success).toBe(true);
    expect(AoeThemeSchema.safeParse(HIGH_CONTRAST_THEME).success).toBe(true);

    expect(isValidTheme(OBSIDIAN_THEME)).toBe(true);
    expect(isValidTheme(LIGHT_THEME)).toBe(true);
    expect(isValidTheme(HIGH_CONTRAST_THEME)).toBe(true);
  });

  it('verifies built-in theme semantic tokens', () => {
    expect(OBSIDIAN_THEME.tokens.colors.background).toBe('#0D1117');
    expect(OBSIDIAN_THEME.tokens.status.completed).toBe('#00F090');
    expect(OBSIDIAN_THEME.tokens.symbols.success.unicode).toBe('✔');
    expect(OBSIDIAN_THEME.tokens.symbols.success.ascii).toBe('[OK]');

    expect(LIGHT_THEME.tokens.colors.background).toBe('#F6F8FA');
    expect(LIGHT_THEME.tokens.status.completed).toBe('#1A7F37');

    expect(HIGH_CONTRAST_THEME.tokens.colors.background).toBe('#000000');
    expect(HIGH_CONTRAST_THEME.tokens.colors.foreground).toBe('#FFFFFF');
  });

  it('rejects themes with missing required semantic tokens', () => {
    const invalidTheme = {
      id: 'incomplete-theme',
      name: 'Incomplete',
      version: '1.0.0',
      colorScheme: 'dark',
      tokens: {
        colors: {
          background: '#000000',
          // missing all other required colors
        },
      },
    };

    expect(() => validateTheme(invalidTheme)).toThrow(ThemeValidationError);
  });

  it('rejects themes with invalid ID characters', () => {
    const invalidIdTheme = {
      ...OBSIDIAN_THEME,
      id: 'Invalid_Theme_ID!',
    };

    expect(() => validateTheme(invalidIdTheme)).toThrow(ThemeValidationError);
  });

  it('protects validated themes against mutation via deepFreeze', () => {
    const theme = validateTheme(OBSIDIAN_THEME);
    expect(Object.isFrozen(theme)).toBe(true);
    expect(Object.isFrozen(theme.tokens)).toBe(true);
    expect(Object.isFrozen(theme.tokens.colors)).toBe(true);

    expect(() => {
      (theme.tokens.colors as unknown as Record<string, string>).primary = '#000000';
    }).toThrow();
  });
});
