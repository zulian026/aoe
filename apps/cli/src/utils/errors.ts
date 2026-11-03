import { ExitCode, type ExitCodeValue } from '../runtime/exit-codes.js';

export interface CliErrorOptions {
  exitCode?: ExitCodeValue;
  hint?: string;
  details?: unknown;
  cause?: unknown;
}

/**
 * Standard typed error representing expected CLI failure conditions.
 */
export class CliError extends Error {
  public readonly exitCode: ExitCodeValue;
  public readonly hint?: string;
  public readonly details?: unknown;

  constructor(message: string, options: CliErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'CliError';
    this.exitCode = options.exitCode ?? ExitCode.UNEXPECTED_ERROR;
    this.hint = options.hint;
    this.details = options.details;
  }
}

/**
 * Formats and outputs an error to stderr with optional verbose stack trace.
 */
export function formatErrorOutput(
  error: unknown,
  verbose = false,
): { message: string; exitCode: ExitCodeValue } {
  if (error instanceof CliError) {
    let out = `Error: ${error.message}`;
    if (error.hint) {
      out += `\nHint: ${error.hint}`;
    }
    if (verbose && error.stack) {
      out += `\n\nStack Trace:\n${error.stack}`;
    }
    if (verbose && error.details) {
      out += `\n\nDetails:\n${JSON.stringify(error.details, null, 2)}`;
    }
    return { message: out, exitCode: error.exitCode };
  }

  if (error instanceof Error) {
    let out = `Error: ${error.message}`;
    if (verbose && error.stack) {
      out += `\n\nStack Trace:\n${error.stack}`;
    }
    return { message: out, exitCode: ExitCode.UNEXPECTED_ERROR };
  }

  return {
    message: `Error: ${String(error)}`,
    exitCode: ExitCode.UNEXPECTED_ERROR,
  };
}
