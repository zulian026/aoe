import type { AoeTheme } from '../contracts.js';
import { validateTheme } from '../validator.js';

const rawObsidian: AoeTheme = {
  id: 'obsidian',
  name: 'obsidian',
  displayName: 'Obsidian Dark',
  version: '1.0.0',
  description:
    'Default AOE dark theme with Obsidian charcoal foundation and warm semantic accents.',
  colorScheme: 'dark',
  tokens: {
    colors: {
      background: '#0D1117',
      surface: '#161B22',
      surfaceMuted: '#21262D',

      foreground: '#E6EDF3',
      foregroundMuted: '#8B949E',
      foregroundSubtle: '#6E7681',

      primary: '#8A2BE2',
      secondary: '#00D2FF',

      success: '#00F090',
      warning: '#FFB800',
      error: '#FF3366',
      info: '#00B4D8',

      border: '#30363D',
      borderMuted: '#21262D',

      accent: '#BD00FF',
      selection: '#1F6FEB',
    },
    status: {
      idle: '#8B949E',
      running: '#FFB800',
      blocked: '#FFB800',
      warning: '#FFB800',
      completed: '#00F090',
      failed: '#FF3366',
      cancelled: '#6E7681',
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

export const OBSIDIAN_THEME: AoeTheme = validateTheme(rawObsidian);
