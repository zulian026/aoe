import { ExitCode } from './exit-codes.js';

export type CleanupTask = () => Promise<void> | void;

export class SignalHandler {
  private static instance?: SignalHandler;
  private readonly cleanupTasks: CleanupTask[] = [];
  private isShuttingDown = false;
  private installed = false;

  private constructor() {}

  public static getInstance(): SignalHandler {
    if (!SignalHandler.instance) {
      SignalHandler.instance = new SignalHandler();
    }
    return SignalHandler.instance;
  }

  public register(task: CleanupTask): () => void {
    this.cleanupTasks.push(task);
    this.install();

    return () => {
      const idx = this.cleanupTasks.indexOf(task);
      if (idx !== -1) {
        this.cleanupTasks.splice(idx, 1);
      }
    };
  }

  public install(): void {
    if (this.installed || typeof process.on !== 'function') return;
    this.installed = true;

    process.once('SIGINT', () => {
      void this.shutdown(ExitCode.SIGINT);
    });

    process.once('SIGTERM', () => {
      void this.shutdown(ExitCode.SIGTERM);
    });
  }

  public async shutdown(exitCode: number): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    for (const task of [...this.cleanupTasks].reverse()) {
      try {
        await Promise.resolve(task());
      } catch (err) {
        if (process.env.NODE_ENV !== 'test') {
          console.error('[SignalHandler] Error in cleanup task:', err);
        }
      }
    }

    if (process.env.NODE_ENV !== 'test') {
      process.exit(exitCode);
    }
  }

  /**
   * Resets the signal handler state (for testing).
   */
  public reset(): void {
    this.cleanupTasks.length = 0;
    this.isShuttingDown = false;
  }
}

export const signalHandler = SignalHandler.getInstance();
