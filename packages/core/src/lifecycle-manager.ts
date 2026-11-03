import type { CoreSessionStatus, CoreTaskStatus } from './types.js';
import { InvalidLifecycleTransitionError, TerminalSessionError } from './errors.js';

const TERMINAL_SESSION_STATUSES: ReadonlySet<CoreSessionStatus> = new Set([
  'completed',
  'failed',
  'cancelled',
]);

const VALID_TASK_TRANSITIONS: Record<CoreTaskStatus, ReadonlySet<CoreTaskStatus>> = {
  idle: new Set(['running', 'blocked', 'failed']),
  running: new Set(['blocked', 'warning', 'completed', 'failed', 'running']),
  blocked: new Set(['running', 'warning', 'failed']),
  warning: new Set(['running', 'completed', 'failed', 'warning']),
  completed: new Set([]), // Terminal
  failed: new Set([]), // Terminal
};

export class LifecycleManager {
  /**
   * Checks if a session status is terminal.
   */
  public static isTerminalSession(status: CoreSessionStatus): boolean {
    return TERMINAL_SESSION_STATUSES.has(status);
  }

  /**
   * Checks if a task status is terminal.
   */
  public static isTerminalTask(status: CoreTaskStatus): boolean {
    return status === 'completed' || status === 'failed';
  }

  /**
   * Validates that a session can receive an event given its current status.
   */
  public static assertSessionCanAcceptEvent(
    sessionId: string,
    currentStatus: CoreSessionStatus,
    eventId?: string,
  ): void {
    if (LifecycleManager.isTerminalSession(currentStatus)) {
      throw new TerminalSessionError(sessionId, currentStatus, eventId);
    }
  }

  /**
   * Validates a session lifecycle transition.
   */
  public static validateSessionTransition(
    sessionId: string,
    from: CoreSessionStatus,
    to: CoreSessionStatus,
    eventId?: string,
  ): void {
    if (from === to) {
      return;
    }
    if (LifecycleManager.isTerminalSession(from)) {
      throw new InvalidLifecycleTransitionError(
        `Session '${sessionId}'`,
        from,
        to,
        sessionId,
        eventId,
      );
    }
  }

  /**
   * Validates a task lifecycle transition.
   */
  public static validateTaskTransition(
    taskId: string,
    from: CoreTaskStatus,
    to: CoreTaskStatus,
    sessionId?: string,
    eventId?: string,
  ): void {
    if (from === to) {
      return;
    }
    const allowed = VALID_TASK_TRANSITIONS[from];
    if (!allowed || !allowed.has(to)) {
      throw new InvalidLifecycleTransitionError(`Task '${taskId}'`, from, to, sessionId, eventId);
    }
  }
}
