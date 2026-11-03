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
  masked = masked.replace(/Bearer\s+[A-Za-z0-9_.-]{12,}/gi, 'Bearer ******');

  // Key / Token / Secret assignments in URLs or configs
  masked = masked.replace(
    /(token|api[_-]?key|secret|password|passwd|auth)([=:])\s*["']?([^\s"';&]+)["']?/gi,
    '$1$2******',
  );

  // API keys
  masked = masked.replace(/sk-[A-Za-z0-9]{20,}/g, '******');
  masked = masked.replace(/AKIA[0-9A-Z]{16}/g, '******');
  masked = masked.replace(/ghp_[A-Za-z0-9]{36}/g, '******');
  masked = masked.replace(/github_pat_[A-Za-z0-9_]{40,}/g, '******');

  // Private keys
  masked = masked.replace(
    /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g,
    '-----BEGIN PRIVATE KEY-----\n******\n-----END PRIVATE KEY-----',
  );

  return masked;
}

// Regex to strip dangerous terminal control escapes (cursor movement, OSC screen titles, etc.)
// Preserves standard SGR color codes (\x1b[...m) while stripping control sequences
const DANGEROUS_ESC_PATTERN = /\x1b(?:\][0-9];[^\x07\x1b]*\x07|\[[0-9;]*[A-HJKSTfmnsu])/g;
// Full ANSI stripper
const ALL_ANSI_PATTERN = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07\x1b]*\x07/g;

/**
 * Strips all ANSI escape sequences from text.
 */
export function stripAnsi(text: string): string {
  if (!text) return text;
  return text.replace(ALL_ANSI_PATTERN, '');
}

/**
 * Strips dangerous terminal control sequences while preserving safe text.
 */
export function sanitizeTerminalText(text: string): string {
  if (!text) return text;
  // Replace control characters except tab and newline
  return text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '').replace(DANGEROUS_ESC_PATTERN, '');
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
