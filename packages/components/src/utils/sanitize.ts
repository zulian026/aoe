/* eslint-disable no-control-regex */
/**
 * Secret masking and text sanitization utilities for AOE components.
 */

/**
 * Replaces credentials, tokens, and secrets with masked asterisks.
 */
export function maskSecrets(input: string): string {
  if (!input) return input;
  let masked = input;

  // Bearer tokens
  masked = masked.replace(/Bearer\s+[A-Za-z0-9_.~+/=-]{12,}/gi, 'Bearer ******');

  // Key / Token / Secret assignments in URLs or configs
  masked = masked.replace(
    /(password|passwd|pwd|api[_-]?key|apikey|auth[_-]?token|access[_-]?token|token|secret|private[_-]?key)\s*([=:])\s*["']?([^\s"';&]+)["']?/gi,
    '$1$2******',
  );

  // API keys
  masked = masked.replace(/sk-[A-Za-z0-9_-]{20,}/g, '******');
  masked = masked.replace(/AIza[0-9A-Za-z_-]{30,}/g, '******');
  masked = masked.replace(/AKIA[0-9A-Z]{16}/g, '******');
  masked = masked.replace(/ghp_[A-Za-z0-9]{36}/g, '******');
  masked = masked.replace(/github_pat_[A-Za-z0-9_]{40,}/g, '******');
  masked = masked.replace(/gho_[A-Za-z0-9]{36}/g, '******');
  masked = masked.replace(/xox[baprs]-[A-Za-z0-9-]+/g, '******');

  // Private keys
  masked = masked.replace(
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    '-----BEGIN PRIVATE KEY-----\n******\n-----END PRIVATE KEY-----',
  );

  return masked;
}

// Regex to match OSC (Operating System Command) sequences, e.g. window title or clipboard manipulation
const OSC_PATTERN = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;

// Regex to match DCS, APC, PM sequences
const DCS_APC_PM_PATTERN = /\x1b[P^_][^\x1b]*(?:\x1b\\|\x07)/g;

// Regex to match dangerous CSI sequences (cursor control, erase, scroll, screen mode)
// Note: SGR color styling (\x1b[...m) is NOT matched here and thus preserved when safe
const DANGEROUS_CSI_PATTERN = /\x1b\[\??[0-9;]*[A-HJKSTfnsuhlirABCD]/g;

// Full ANSI escape sequence pattern for complete stripping
const ALL_ANSI_PATTERN =
  /\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[P^_][^\x1b]*(?:\x1b\\|\x07))/g;

// Trojan Source unicode bidirectional override and isolate characters
const BIDI_OVERRIDE_PATTERN = /[\u202A-\u202E\u2066-\u2069]/g;

/**
 * Strips all ANSI escape sequences from text.
 */
export function stripAnsi(text: string): string {
  if (!text) return text;
  return text.replace(ALL_ANSI_PATTERN, '');
}

/**
 * Strips dangerous terminal control sequences while preserving safe text and SGR colors.
 * Also neutralizes Unicode bidirectional override attacks and unprintable control chars.
 */
export function sanitizeTerminalText(text: string): string {
  if (!text) return text;

  return text
    .replace(OSC_PATTERN, '') // OSC title / clipboard escapes
    .replace(DCS_APC_PM_PATTERN, '') // DCS / APC / PM escapes
    .replace(DANGEROUS_CSI_PATTERN, '') // Dangerous CSI cursor / mode switches
    .replace(BIDI_OVERRIDE_PATTERN, '') // Trojan Source bidi overrides
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1A\x1C-\x1F\x7F]/g, ''); // Unprintable ASCII controls (preserves \t, \n)
}

/**
 * Safely clamps a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/**
 * Formats duration in milliseconds into a concise, human-readable string.
 */
export function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null || Number.isNaN(ms) || ms < 0) {
    return '0ms';
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  const sec = ms / 1000;
  if (sec < 60) {
    return `${sec.toFixed(1)}s`;
  }
  const min = Math.floor(sec / 60);
  const remainingSec = Math.round(sec % 60);
  return `${min}m ${remainingSec}s`;
}

/**
 * Truncates long file paths while keeping the leading directory and filename intact.
 * e.g., "packages/renderer/src/components/TaskSummary.tsx" -> "packages/.../TaskSummary.tsx"
 */
export function truncatePath(filePath: string, maxLength = 36): string {
  if (!filePath || filePath.length <= maxLength) {
    return filePath;
  }

  const parts = filePath.split('/');
  if (parts.length <= 2) {
    return filePath.slice(0, maxLength - 3) + '...';
  }

  const fileName = parts[parts.length - 1];
  const firstDir = parts[0];
  const middle = '...';

  const prefix = `${firstDir}/${middle}/`;
  if (prefix.length + fileName.length <= maxLength) {
    return `${prefix}${fileName}`;
  }

  return `${prefix}${fileName.slice(0, maxLength - prefix.length - 3)}...`;
}
