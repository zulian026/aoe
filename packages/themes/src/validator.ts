import { AoeThemeSchema, type AoeTheme } from './contracts.js';
import { ThemeValidationError } from './errors.js';

/**
 * Deep freezes an object to ensure immutability.
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Freeze properties first
  for (const prop of Object.getOwnPropertyNames(obj)) {
    const val = (obj as Record<string, unknown>)[prop];
    if (val !== null && (typeof val === 'object' || typeof val === 'function')) {
      deepFreeze(val);
    }
  }

  return Object.freeze(obj);
}

/**
 * Deep clones an object safely.
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Normalizes an AOE theme by populating legacy compatibility fields.
 */
function normalizeTheme(theme: AoeTheme): AoeTheme {
  const normalized: AoeTheme = {
    ...theme,
    displayName: theme.displayName ?? theme.name,
    dark: theme.dark ?? theme.colorScheme === 'dark',
    tokens: {
      ...theme.tokens,
      // Ensure legacy flat color getters map directly to semantic colors
      primary: theme.tokens.primary ?? theme.tokens.colors.primary,
      secondary: theme.tokens.secondary ?? theme.tokens.colors.secondary,
      accent: theme.tokens.accent ?? theme.tokens.colors.accent,
      success: theme.tokens.success ?? theme.tokens.colors.success,
      warning: theme.tokens.warning ?? theme.tokens.colors.warning,
      error: theme.tokens.error ?? theme.tokens.colors.error,
      info: theme.tokens.info ?? theme.tokens.colors.info,
      muted: theme.tokens.muted ?? theme.tokens.colors.foregroundMuted,
      background: theme.tokens.background ?? theme.tokens.colors.background,
      surface: theme.tokens.surface ?? theme.tokens.colors.surface,
      border: theme.tokens.border ?? theme.tokens.colors.border,
    },
  };
  return normalized;
}

/**
 * Validates a theme object against the AoeThemeSchema, throwing a structured ThemeValidationError on failure.
 * Returns a normalized, deep-frozen immutable theme instance.
 */
export function validateTheme(input: unknown): AoeTheme {
  if (!input || typeof input !== 'object') {
    throw new ThemeValidationError('Theme input must be a non-null object');
  }

  const result = AoeThemeSchema.safeParse(input);
  if (!result.success) {
    throw new ThemeValidationError('Theme validation failed', result.error);
  }

  const normalized = normalizeTheme(result.data);
  return deepFreeze(normalized) as AoeTheme;
}

/**
 * Type guard returning true if the input is a valid AoeTheme.
 */
export function isValidTheme(input: unknown): input is AoeTheme {
  return AoeThemeSchema.safeParse(input).success;
}
