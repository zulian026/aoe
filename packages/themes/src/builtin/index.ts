export * from './obsidian.js';
export * from './light.js';
export * from './high-contrast.js';

import { OBSIDIAN_THEME } from './obsidian.js';
import { LIGHT_THEME } from './light.js';
import { HIGH_CONTRAST_THEME } from './high-contrast.js';
import type { AoeTheme } from '../contracts.js';

export const BUILTIN_THEMES: readonly AoeTheme[] = Object.freeze([
  OBSIDIAN_THEME,
  LIGHT_THEME,
  HIGH_CONTRAST_THEME,
]);
