/**
 * Minimal CLI logger that sends diagnostics to stderr,
 * preserving stdout strictly for structured output and pipes.
 */
export class Logger {
  private readonly verbose: boolean;

  constructor(options: { verbose?: boolean } = {}) {
    this.verbose = options.verbose ?? false;
  }

  public info(message: string): void {
    process.stderr.write(`${message}\n`);
  }

  public warn(message: string): void {
    process.stderr.write(`Warning: ${message}\n`);
  }

  public error(message: string): void {
    process.stderr.write(`${message}\n`);
  }

  public debug(message: string): void {
    if (this.verbose) {
      process.stderr.write(`[DEBUG] ${message}\n`);
    }
  }
}

export const defaultLogger = new Logger();
