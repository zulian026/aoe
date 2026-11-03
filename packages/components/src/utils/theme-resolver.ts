import { OBSIDIAN_THEME, type ThemeDefinition, type ThemeTokens } from '@aoe/themes';

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
 * Resolves a color token to a hex string or undefined if noColor is true.
 */
export function resolveThemeColor(
  token: keyof ThemeTokens,
  theme: ThemeDefinition = OBSIDIAN_THEME,
  noColor = false,
): string | undefined {
  if (noColor || isNoColor()) {
    return undefined;
  }
  return theme.tokens[token];
}

/**
 * Canonical visual symbols with Unicode and ASCII variants.
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

export function getSymbol(name: keyof typeof SYMBOLS, unicode = true): string {
  const sym = SYMBOLS[name];
  return unicode ? sym.unicode : sym.ascii;
}
