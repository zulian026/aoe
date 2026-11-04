import { describe, it, expect } from 'vitest';
import { OBSIDIAN_THEME, ThemeDefinitionSchema } from './index.js';

describe('@zyanx04/themes', () => {
  it('validates default obsidian theme schema', () => {
    const parsed = ThemeDefinitionSchema.safeParse(OBSIDIAN_THEME);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe('obsidian');
      expect(parsed.data.dark).toBe(true);
    }
  });
});
