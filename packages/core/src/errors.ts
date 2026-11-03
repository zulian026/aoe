export type EngineErrorCode =
  | 'UNKNOWN_SESSION'
  | 'DUPLICATE_EVENT'
  | 'CONFLICTING_EVENT_ID'
  | 'SEQUENCE_GAP'
  | 'OUT_OF_ORDER_EVENT'
  | 'INVALID_LIFECYCLE_TRANSITION'
  | 'UNKNOWN_TASK'
  | 'MISSING_PARENT_TASK'
  | 'CIRCULAR_TASK_HIERARCHY'
  | 'DUPLICATE_TASK'
  | 'TERMINAL_SESSION'
  | 'INVALID_STATE_MUTATION'
  | 'BUFFER_OVERFLOW';

export class EngineError extends Error {
  public readonly code: EngineErrorCode;
  public readonly sessionId?: string;
  public readonly eventId?: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: EngineErrorCode,
    message: string,
    options?: {
      sessionId?: string;
      eventId?: string;
      details?: Record<string, unknown>;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'EngineError';
    this.code = code;
    this.sessionId = options?.sessionId;
    this.eventId = options?.eventId;
    this.details = options?.details;
  }
}

export class UnknownSessionError extends EngineError {
  constructor(sessionId: string, eventId?: string) {
    super('UNKNOWN_SESSION', `Session '${sessionId}' is not registered or does not exist`, {
      sessionId,
      eventId,
    });
  }
}

export class DuplicateEventError extends EngineError {
  constructor(eventId: string, sessionId: string, sequence: number) {
    super(
      'DUPLICATE_EVENT',
      `Event '${eventId}' has already been processed for session '${sessionId}'`,
      {
        eventId,
        sessionId,
        details: { sequence },
      },
    );
  }
}

export class ConflictingEventIdError extends EngineError {
  constructor(eventId: string, sessionId: string) {
    super(
      'CONFLICTING_EVENT_ID',
      `Event ID '${eventId}' was reused with conflicting payload content in session '${sessionId}'`,
      { eventId, sessionId },
    );
  }
}

export class SequenceGapError extends EngineError {
  public readonly expectedSequence: number;
  public readonly receivedSequence: number;

  constructor(
    sessionId: string,
    expectedSequence: number,
    receivedSequence: number,
    eventId?: string,
  ) {
    super(
      'SEQUENCE_GAP',
      `Sequence gap detected in session '${sessionId}': expected ${expectedSequence}, received ${receivedSequence}`,
      {
        sessionId,
        eventId,
        details: {
          expectedSequence,
          receivedSequence,
          missingRange: [expectedSequence, receivedSequence - 1],
        },
      },
    );
    this.expectedSequence = expectedSequence;
    this.receivedSequence = receivedSequence;
  }
}

export class OutOfOrderEventError extends EngineError {
  constructor(
    sessionId: string,
    expectedSequence: number,
    receivedSequence: number,
    eventId?: string,
  ) {
    super(
      'OUT_OF_ORDER_EVENT',
      `Out-of-order event in session '${sessionId}': expected ${expectedSequence}, received ${receivedSequence}`,
      { sessionId, eventId, details: { expectedSequence, receivedSequence } },
    );
  }
}

export class InvalidLifecycleTransitionError extends EngineError {
  constructor(
    target: string,
    fromState: string,
    toState: string,
    sessionId?: string,
    eventId?: string,
  ) {
    super(
      'INVALID_LIFECYCLE_TRANSITION',
      `Cannot transition ${target} from '${fromState}' to '${toState}'`,
      { sessionId, eventId, details: { target, fromState, toState } },
    );
  }
}

export class UnknownTaskError extends EngineError {
  constructor(taskId: string, sessionId: string, eventId?: string) {
    super('UNKNOWN_TASK', `Task '${taskId}' does not exist in session '${sessionId}'`, {
      sessionId,
      eventId,
      details: { taskId },
    });
  }
}

export class MissingParentTaskError extends EngineError {
  constructor(taskId: string, parentTaskId: string, sessionId: string, eventId?: string) {
    super(
      'MISSING_PARENT_TASK',
      `Parent task '${parentTaskId}' does not exist for task '${taskId}' in session '${sessionId}'`,
      { sessionId, eventId, details: { taskId, parentTaskId } },
    );
  }
}

export class CircularTaskHierarchyError extends EngineError {
  constructor(taskId: string, parentTaskId: string, sessionId: string) {
    super(
      'CIRCULAR_TASK_HIERARCHY',
      `Circular hierarchy detected: assigning '${parentTaskId}' as parent of '${taskId}' forms a cycle`,
      { sessionId, details: { taskId, parentTaskId } },
    );
  }
}

export class DuplicateTaskError extends EngineError {
  constructor(taskId: string, sessionId: string, eventId?: string) {
    super(
      'DUPLICATE_TASK',
      `Task '${taskId}' has already been registered in session '${sessionId}'`,
      {
        sessionId,
        eventId,
        details: { taskId },
      },
    );
  }
}

export class TerminalSessionError extends EngineError {
  constructor(sessionId: string, terminalStatus: string, eventId?: string) {
    super(
      'TERMINAL_SESSION',
      `Cannot process events for session '${sessionId}' in terminal status '${terminalStatus}'`,
      { sessionId, eventId, details: { terminalStatus } },
    );
  }
}

export class InvalidStateMutationError extends EngineError {
  constructor(message: string, sessionId?: string, details?: Record<string, unknown>) {
    super('INVALID_STATE_MUTATION', message, { sessionId, details });
  }
}

export class BufferOverflowError extends EngineError {
  constructor(sessionId: string, limit: number) {
    super(
      'BUFFER_OVERFLOW',
      `Out-of-order event buffer exceeded maximum limit of ${limit} events for session '${sessionId}'`,
      { sessionId, details: { limit } },
    );
  }
}
