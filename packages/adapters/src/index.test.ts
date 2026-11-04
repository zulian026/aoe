import { describe, it, expect } from 'vitest';
import { SUPPORTED_AGENTS } from './index.js';

describe('@zyanx04/adapters', () => {
  it('defines targets for all specified agents', () => {
    expect(SUPPORTED_AGENTS).toContain('codex');
    expect(SUPPORTED_AGENTS).toContain('claude-code');
    expect(SUPPORTED_AGENTS).toContain('gemini-cli');
    expect(SUPPORTED_AGENTS).toContain('opencode');
    expect(SUPPORTED_AGENTS).toContain('generic');
  });
});
