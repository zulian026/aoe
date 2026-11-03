import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isNoColor,
  isForceColor,
  isCI,
  isTTY,
  getColorDepth,
  supportsColor,
  getTerminalDimensions,
  isInteractiveSuitable,
  detectEnvironmentCapabilities,
} from '../environment.js';
import { MockTerminalStream } from './test-utils.js';

describe('Environment Detection & Capabilities', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NO_COLOR;
    delete process.env.FORCE_COLOR;
    delete process.env.CI;
    process.env.TERM = 'xterm-256color';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('respects NO_COLOR when set', () => {
    expect(isNoColor()).toBe(false);

    process.env.NO_COLOR = '1';
    expect(isNoColor()).toBe(true);

    process.env.NO_COLOR = '';
    expect(isNoColor()).toBe(false);
  });

  it('respects FORCE_COLOR when set', () => {
    expect(isForceColor()).toBe(false);

    process.env.FORCE_COLOR = '1';
    expect(isForceColor()).toBe(true);

    process.env.FORCE_COLOR = '0';
    expect(isForceColor()).toBe(false);
  });

  it('detects CI environment', () => {
    expect(isCI()).toBe(false);

    process.env.CI = 'true';
    expect(isCI()).toBe(true);
  });

  it('detects TTY vs non-TTY stream', () => {
    const ttyStream = new MockTerminalStream({ isTTY: true });
    const nonTtyStream = new MockTerminalStream({ isTTY: false });

    expect(isTTY(ttyStream as unknown as NodeJS.WriteStream)).toBe(true);
    expect(isTTY(nonTtyStream as unknown as NodeJS.WriteStream)).toBe(false);
  });

  it('resolves color depth and color support according to NO_COLOR and FORCE_COLOR', () => {
    const stream = new MockTerminalStream({ isTTY: true });

    process.env.NO_COLOR = '1';
    expect(getColorDepth(stream as unknown as NodeJS.WriteStream)).toBe(1);
    expect(supportsColor(stream as unknown as NodeJS.WriteStream)).toBe(false);

    delete process.env.NO_COLOR;
    process.env.FORCE_COLOR = '1';
    expect(getColorDepth(stream as unknown as NodeJS.WriteStream)).toBe(24);
    expect(supportsColor(stream as unknown as NodeJS.WriteStream)).toBe(true);
  });

  it('safely calculates terminal dimensions with fallbacks and clamping', () => {
    const normal = new MockTerminalStream({ columns: 120, rows: 40 });
    const dims = getTerminalDimensions(normal as unknown as NodeJS.WriteStream);
    expect(dims.columns).toBe(120);
    expect(dims.rows).toBe(40);

    const zero = new MockTerminalStream({ columns: 0, rows: 0 });
    const fallback = getTerminalDimensions(zero as unknown as NodeJS.WriteStream);
    expect(fallback.columns).toBe(80);
    expect(fallback.rows).toBe(24);

    const tiny = new MockTerminalStream({ columns: 5, rows: 2 });
    const clamped = getTerminalDimensions(tiny as unknown as NodeJS.WriteStream);
    expect(clamped.columns).toBe(20);
    expect(clamped.rows).toBe(5);
  });

  it('evaluates interactive suitability (non-TTY, CI, TERM=dumb)', () => {
    const ttyStream = new MockTerminalStream({ isTTY: true });
    const nonTtyStream = new MockTerminalStream({ isTTY: false });

    expect(isInteractiveSuitable(ttyStream as unknown as NodeJS.WriteStream)).toBe(true);
    expect(isInteractiveSuitable(nonTtyStream as unknown as NodeJS.WriteStream)).toBe(false);

    process.env.CI = 'true';
    expect(isInteractiveSuitable(ttyStream as unknown as NodeJS.WriteStream)).toBe(false);

    delete process.env.CI;
    process.env.TERM = 'dumb';
    expect(isInteractiveSuitable(ttyStream as unknown as NodeJS.WriteStream)).toBe(false);
  });

  it('detects comprehensive environment capabilities', () => {
    const ttyStream = new MockTerminalStream({ isTTY: true, columns: 100, rows: 30 });
    const caps = detectEnvironmentCapabilities(ttyStream as unknown as NodeJS.WriteStream);

    expect(caps.isTTY).toBe(true);
    expect(caps.dimensions.columns).toBe(100);
    expect(caps.dimensions.rows).toBe(30);
    expect(caps.supportsAlternateScreen).toBe(true);
  });
});
