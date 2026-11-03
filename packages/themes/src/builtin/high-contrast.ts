import type { AoeTheme } from '../contracts.js';
import { validateTheme } from '../validator.js';

const rawHighContrast: AoeTheme = {
  id: 'high-contrast',
  name: 'high-contrast',
  displayName: 'High Contrast',
  version: '1.0.0',
  description: 'High-contrast theme for maximum readability in difficult terminal environments.',
  colorScheme: 'dark',
  tokens: {
    colors: {
      background: '#000000',
      surface: '#0A0A0A',
      surfaceMuted: '#141414',

      foreground: '#FFFFFF',
      foregroundMuted: '#CCCCCC',
      foregroundSubtle: '#AAAAAA',

      primary: '#FFFFFF',
      secondary: '#00FFFF',

      success: '#00FF00',
      warning: '#FFFF00',
      error: '#FF0000',
      info: '#00FFFF',

      border: '#FFFFFF',
      borderMuted: '#888888',

      accent: '#FF00FF',
      selection: '#FFFFFF',
    },
    status: {
      idle: '#CCCCCC',
      running: '#FFFF00',
      blocked: '#FFFF00',
      warning: '#FFFF00',
      completed: '#00FF00',
      failed: '#FF0000',
      cancelled: '#888888',
    },
    typography: {
      heading: { bold: true, underline: true },
      body: {},
      muted: { bold: false },
      emphasis: { bold: true },
      code: { bold: true },
      label: { bold: true },
    },
    spacing: {
      none: 0,
      xs: 1,
      sm: 2,
      md: 3,
      lg: 4,
      xl: 6,
    },
    symbols: {
      success: { unicode: '✔', ascii: '[OK]' },
      failure: { unicode: '✖', ascii: '[FAIL]' },
      warning: { unicode: '▲', ascii: '[WARN]' },
      information: { unicode: 'ℹ', ascii: '[INFO]' },
      running: { unicode: '●', ascii: '[RUN]' },
      pending: { unicode: '○', ascii: '[PEND]' },
      completed: { unicode: '✔', ascii: '[OK]' },
      blocked: { unicode: '■', ascii: '[BLOCKED]' },
      cancelled: { unicode: '—', ascii: '[CANCELLED]' },
      treeBranch: { unicode: '├─ ', ascii: '|-- ' },
      treeLastBranch: { unicode: '└─ ', ascii: '`-- ' },
      treeVertical: { unicode: '│  ', ascii: '|   ' },
      progressFilled: { unicode: '█', ascii: '=' },
      progressEmpty: { unicode: '░', ascii: '-' },
      disk: { unicode: '✓ disk', ascii: '[disk]' },
      hypothesis: { unicode: '?', ascii: '?' },
    },
  },
};

export const HIGH_CONTRAST_THEME: AoeTheme = validateTheme(rawHighContrast);
