import type {
  AoeTheme,
  ThemeColors,
  ThemeStatusColors,
  ThemeSymbols,
  SymbolPair,
} from './contracts.js';

export interface ThemeResolutionOptions {
  noColor?: boolean;
  forceColor?: boolean;
  colorDepth?: number;
  unicode?: boolean;
}

/**
 * Checks whether NO_COLOR is active in the environment.
 */
export function isNoColor(): boolean {
  if (typeof process === 'undefined' || !process.env) {
    return false;
  }
  return process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '';
}

/**
 * Checks whether FORCE_COLOR is active in the environment.
 */
export function isForceColor(): boolean {
  if (typeof process === 'undefined' || !process.env) {
    return false;
  }
  const force = process.env.FORCE_COLOR;
  return force !== undefined && force !== '' && force !== '0';
}

/**
 * Resolves whether color should be suppressed based on options and environment.
 */
export function shouldSuppressColor(options: ThemeResolutionOptions = {}): boolean {
  if (options.noColor === true) return true;
  if (options.forceColor === true) return false;
  if (isForceColor()) return false;
  if (isNoColor()) return true;
  if (options.colorDepth !== undefined && options.colorDepth <= 1) return true;
  return false;
}

/**
 * Resolves a raw color value to undefined if colors are suppressed.
 */
export function resolveColorValue(
  color: string,
  options: ThemeResolutionOptions = {},
): string | undefined {
  if (shouldSuppressColor(options)) {
    return undefined;
  }
  return color;
}

/**
 * Resolves a semantic theme color token to a color string or undefined.
 */
export function resolveThemeColor(
  token: keyof ThemeColors,
  theme: AoeTheme,
  options: ThemeResolutionOptions = {},
): string | undefined {
  if (shouldSuppressColor(options)) {
    return undefined;
  }
  return theme.tokens.colors[token];
}

/**
 * Resolves a semantic status color token to a color string or undefined.
 */
export function resolveStatusColor(
  status: keyof ThemeStatusColors,
  theme: AoeTheme,
  options: ThemeResolutionOptions = {},
): string | undefined {
  if (shouldSuppressColor(options)) {
    return undefined;
  }
  return theme.tokens.status[status];
}

/**
 * Resolves a semantic symbol to Unicode or ASCII string.
 */
export function resolveSymbol(
  symbolName: keyof ThemeSymbols,
  theme: AoeTheme,
  unicode = true,
): string {
  const pair: SymbolPair = theme.tokens.symbols[symbolName];
  if (!pair) {
    return unicode ? '?' : '[?]';
  }
  return unicode ? pair.unicode : pair.ascii;
}

export interface ResolvedTheme {
  theme: AoeTheme;
  colors: Record<keyof ThemeColors, string | undefined>;
  status: Record<keyof ThemeStatusColors, string | undefined>;
  symbols: Record<keyof ThemeSymbols, string>;
  spacing: AoeTheme['tokens']['spacing'];
  typography: AoeTheme['tokens']['typography'];
  colorSuppressed: boolean;
  unicode: boolean;
}

/**
 * Resolves all theme tokens according to runtime terminal capabilities.
 */
export function resolveTheme(theme: AoeTheme, options: ThemeResolutionOptions = {}): ResolvedTheme {
  const colorSuppressed = shouldSuppressColor(options);
  const unicode = options.unicode ?? true;

  const resolvedColors = {} as Record<keyof ThemeColors, string | undefined>;
  for (const key of Object.keys(theme.tokens.colors) as Array<keyof ThemeColors>) {
    resolvedColors[key] = colorSuppressed ? undefined : theme.tokens.colors[key];
  }

  const resolvedStatus = {} as Record<keyof ThemeStatusColors, string | undefined>;
  for (const key of Object.keys(theme.tokens.status) as Array<keyof ThemeStatusColors>) {
    resolvedStatus[key] = colorSuppressed ? undefined : theme.tokens.status[key];
  }

  const resolvedSymbols = {} as Record<keyof ThemeSymbols, string>;
  for (const key of Object.keys(theme.tokens.symbols) as Array<keyof ThemeSymbols>) {
    const pair = theme.tokens.symbols[key];
    resolvedSymbols[key] = unicode ? pair.unicode : pair.ascii;
  }

  return {
    theme,
    colors: resolvedColors,
    status: resolvedStatus,
    symbols: resolvedSymbols,
    spacing: theme.tokens.spacing,
    typography: theme.tokens.typography,
    colorSuppressed,
    unicode,
  };
}
