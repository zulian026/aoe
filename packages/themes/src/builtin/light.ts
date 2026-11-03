import type { AoeTheme } from '../contracts.js';
import { validateTheme } from '../validator.js';

const rawLight: AoeTheme = {
  id: 'light',
  name: 'light',
  displayName: 'Warm Light',
  version: '1.0.0',
  description:
    'Warm off-white light theme with dark charcoal foreground and accessible status contrast.',
  colorScheme: 'light',
  tokens: {
    colors: {
      background: '#F6F8FA',
      surface: '#FFFFFF',
      surfaceMuted: '#EAEEF2',

      foreground: '#1F2328',
      foregroundMuted: '#57606A',
      foregroundSubtle: '#6E7781',

      primary: '#6639BA',
      secondary: '#0969DA',

      success: '#1A7F37',
      warning: '#9A6700',
      error: '#CF222E',
      info: '#0969DA',

      border: '#D0D7DE',
      borderMuted: '#E1E4E8',

      accent: '#8250DF',
      selection: '#B6E3FF',
    },
    status: {
      idle: '#57606A',
      running: '#9A6700',
      blocked: '#9A6700',
      warning: '#9A6700',
      completed: '#1A7F37',
      failed: '#CF222E',
      cancelled: '#6E7781',
    },
    typography: {
      heading: { bold: true },
      body: {},
      muted: { dim: true },
      emphasis: { italic: true },
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

export const LIGHT_THEME: AoeTheme = validateTheme(rawLight);
