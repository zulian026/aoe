import {
  OBSIDIAN_THEME,
  type AoeTheme,
  type ThemeColors,
  type ThemeStatusColors,
  type ThemeSymbols,
  isNoColor as envIsNoColor,
  resolveThemeColor as baseResolveThemeColor,
  resolveStatusColor as baseResolveStatusColor,
  resolveSymbol as baseResolveSymbol,
} from '@zyanx04/themes';

/**
 * Checks whether NO_COLOR is active in the environment.
 */
export function isNoColor(): boolean {
  return envIsNoColor();
}

/**
 * Resolves a semantic color token to a color string or undefined if noColor is active.
 */
export function resolveThemeColor(
  token:
    | keyof ThemeColors
    | 'primary'
    | 'secondary'
    | 'accent'
    | 'success'
    | 'warning'
    | 'error'
    | 'info'
    | 'muted'
    | 'border'
    | 'background'
    | 'surface',
  theme: AoeTheme = OBSIDIAN_THEME,
  noColor = false,
): string | undefined {
  if (noColor || isNoColor()) {
    return undefined;
  }

  // Check structured semantic colors first
  if (theme.tokens?.colors && (token as keyof ThemeColors) in theme.tokens.colors) {
    return baseResolveThemeColor(token as keyof ThemeColors, theme, { noColor });
  }

  // Fallback to legacy flat token access if present
  if (theme.tokens && token in theme.tokens) {
    const val = (theme.tokens as Record<string, unknown>)[token];
    if (typeof val === 'string') return val;
  }

  return undefined;
}

/**
 * Resolves a semantic status color token.
 */
export function resolveStatusColor(
  status: keyof ThemeStatusColors,
  theme: AoeTheme = OBSIDIAN_THEME,
  noColor = false,
): string | undefined {
  if (noColor || isNoColor()) {
    return undefined;
  }
  return baseResolveStatusColor(status, theme, { noColor });
}

/**
 * Canonical visual symbols dictionary (fallback).
 */
export const SYMBOLS = {
  check: { unicode: '✔', ascii: '[OK]' },
  cross: { unicode: '✖', ascii: '[FAIL]' },
  bullet: { unicode: '●', ascii: '*' },
  circle: { unicode: '○', ascii: 'o' },
  triangle: { unicode: '▲', ascii: '^' },
  square: { unicode: '■', ascii: '#' },
  dash: { unicode: '—', ascii: '-' },
  treeBranch: { unicode: '├─ ', ascii: '|-- ' },
  treeLastBranch: { unicode: '└─ ', ascii: '`-- ' },
  treeVertical: { unicode: '│  ', ascii: '|   ' },
  progressFilled: { unicode: '█', ascii: '=' },
  progressEmpty: { unicode: '░', ascii: '-' },
  hypothesis: { unicode: '?', ascii: '?' },
  disk: { unicode: '✓ disk', ascii: '[disk]' },
} as const;

/**
 * Resolves symbol from theme or fallback dictionary.
 */
export function getSymbol(name: string, unicode = true, theme: AoeTheme = OBSIDIAN_THEME): string {
  // If theme has the symbol token, use it
  if (theme.tokens?.symbols && name in theme.tokens.symbols) {
    return baseResolveSymbol(name as keyof ThemeSymbols, theme, unicode);
  }

  // Check symbol aliases in SYMBOLS
  const sym = (SYMBOLS as Record<string, { unicode: string; ascii: string }>)[name];
  if (sym) {
    return unicode ? sym.unicode : sym.ascii;
  }

  return unicode ? '?' : '[?]';
}
