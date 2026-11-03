import type { WriteStream } from 'node:tty';

export interface TerminalDimensions {
  columns: number;
  rows: number;
}

export interface EnvironmentCapabilities {
  isTTY: boolean;
  isCI: boolean;
  hasColor: boolean;
  colorDepth: number;
  dimensions: TerminalDimensions;
  supportsAlternateScreen: boolean;
}

/**
 * Checks whether NO_COLOR is set and non-empty.
 */
export function isNoColor(): boolean {
  if (typeof process === 'undefined' || !process.env) return false;
  return process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '';
}

/**
 * Checks whether FORCE_COLOR is set and not '0'.
 */
export function isForceColor(): boolean {
  if (typeof process === 'undefined' || !process.env) return false;
  const force = process.env.FORCE_COLOR;
  return force !== undefined && force !== '' && force !== '0';
}

/**
 * Checks if the environment is a CI runner.
 */
export function isCI(): boolean {
  if (typeof process === 'undefined' || !process.env) return false;
  return (
    process.env.CI !== undefined &&
    process.env.CI !== '' &&
    process.env.CI !== 'false' &&
    process.env.CI !== '0'
  );
}

/**
 * Checks if a stream is an interactive TTY.
 */
export function isTTY(stream: NodeJS.WriteStream = process.stdout): boolean {
  if (!stream) return false;
  return Boolean((stream as WriteStream).isTTY);
}

/**
 * Detects color depth for a stream (1 = monochrome, 4 = 16-color, 8 = 256-color, 24 = TrueColor).
 */
export function getColorDepth(stream: NodeJS.WriteStream = process.stdout): number {
  if (isNoColor()) return 1;
  if (isForceColor()) return 24;

  const ttyStream = stream as WriteStream;
  if (typeof ttyStream?.getColorDepth === 'function') {
    return ttyStream.getColorDepth();
  }

  return isTTY(stream) ? 8 : 1;
}

/**
 * Checks whether color output is supported.
 */
export function supportsColor(stream: NodeJS.WriteStream = process.stdout): boolean {
  if (isNoColor()) return false;
  if (isForceColor()) return true;
  return getColorDepth(stream) > 1;
}

/**
 * Safely calculates terminal dimensions, clamping to safe minimums (min 20 cols, min 5 rows).
 */
export function getTerminalDimensions(
  stream: NodeJS.WriteStream = process.stdout,
): TerminalDimensions {
  const ttyStream = stream as WriteStream;
  let cols = ttyStream?.columns;
  let rows = ttyStream?.rows;

  if (!cols || Number.isNaN(cols) || cols <= 0) {
    cols = 80;
  }
  if (!rows || Number.isNaN(rows) || rows <= 0) {
    rows = 24;
  }

  return {
    columns: Math.max(20, cols),
    rows: Math.max(5, rows),
  };
}

/**
 * Determines whether interactive Ink UI is suitable for this stream and environment.
 */
export function isInteractiveSuitable(stream: NodeJS.WriteStream = process.stdout): boolean {
  if (isCI()) return false;
  if (process.env.TERM === 'dumb') return false;
  return isTTY(stream);
}

/**
 * Collects complete environment capabilities snapshot.
 */
export function detectEnvironmentCapabilities(
  stream: NodeJS.WriteStream = process.stdout,
): EnvironmentCapabilities {
  const tty = isTTY(stream);
  const ci = isCI();
  const color = supportsColor(stream);
  const depth = getColorDepth(stream);
  const dims = getTerminalDimensions(stream);

  return {
    isTTY: tty,
    isCI: ci,
    hasColor: color,
    colorDepth: depth,
    dimensions: dims,
    supportsAlternateScreen: tty && !ci && process.env.TERM !== 'dumb',
  };
}
