import {
  validateEvent,
  type AoeEvent,
  type FileChangedPayload,
  type DiagnosticEmittedPayload,
  type ProgressUpdatedPayload,
  type LogEmittedPayload,
} from '@aoe/protocol';
import type { EventProcessingResult } from './types.js';
import { SessionManager, SessionStateContainer } from './session-manager.js';
import { EventStore } from './event-store.js';
import { StateDispatcher } from './state-dispatcher.js';
import { LifecycleManager } from './lifecycle-manager.js';
import { EngineError, UnknownSessionError } from './errors.js';

export interface EventProcessorOptions {
  sessionManager: SessionManager;
  eventStore: EventStore;
  dispatcher: StateDispatcher;
}

export class EventProcessor {
  private readonly sessionManager: SessionManager;
  private readonly eventStore: EventStore;
  private readonly dispatcher: StateDispatcher;

  constructor(options: EventProcessorOptions) {
    this.sessionManager = options.sessionManager;
    this.eventStore = options.eventStore;
    this.dispatcher = options.dispatcher;
  }

  /**
   * Processes an incoming event through the complete atomic verification pipeline.
   */
  public process(rawEvent: unknown): EventProcessingResult {
    let event: AoeEvent;
    try {
      event = validateEvent(rawEvent);
    } catch (err) {
      const error =
        err instanceof EngineError
          ? err
          : new EngineError('INVALID_STATE_MUTATION', (err as Error).message, { cause: err });
      return { status: 'rejected', reason: error.message, error };
    }

    try {
      return this.processValidated(event);
    } catch (err) {
      const error =
        err instanceof EngineError
          ? err
          : new EngineError('INVALID_STATE_MUTATION', (err as Error).message, {
              sessionId: event.sessionId,
              eventId: event.eventId,
              cause: err,
            });
      return { status: 'rejected', reason: error.message, error };
    }
  }

  private processValidated(event: AoeEvent): EventProcessingResult {
    // 1. Session Resolution
    let session = this.sessionManager.getSession(event.sessionId);
    if (!session) {
      if (event.eventType === 'session.started') {
        session = this.sessionManager.createSession({
          sessionId: event.sessionId,
          agent: event.payload.agent,
          workingDirectory: event.payload.workingDirectory,
          parentSessionId: event.payload.parentSessionId,
          startedAt: event.timestamp,
        });
      } else {
        throw new UnknownSessionError(event.sessionId, event.eventId);
      }
    }

    // 2. Lifecycle Check: Verify session is not already terminal
    LifecycleManager.assertSessionCanAcceptEvent(session.sessionId, session.status, event.eventId);

    // 3. Deduplication Check
    const dedup = session.deduplicationStore.check(event);
    if (dedup.isDuplicate) {
      return {
        status: 'duplicate',
        eventId: event.eventId,
        sequence: event.sequence,
        reason: 'Event ID has already been accepted',
      };
    }

    // 4. Sequence Evaluation
    const seqEval = session.sequenceTracker.evaluate(event.sequence);
    if (seqEval.kind === 'duplicate') {
      return {
        status: 'duplicate',
        eventId: event.eventId,
        sequence: event.sequence,
        reason: `Sequence ${event.sequence} is already accepted (expected ${seqEval.expected})`,
      };
    }

    if (seqEval.kind === 'out_of_order') {
      session.sequenceTracker.bufferEvent(event);
      return {
        status: 'buffered',
        eventId: event.eventId,
        sequence: event.sequence,
        expectedSequence: seqEval.expected,
      };
    }

    // 5. Sequence is valid ('next'): Apply Domain State Mutations Atomically
    this.applyDomainMutation(session, event);

    // 6. Advance Sequence & Commit Deduplication Record
    session.sequenceTracker.advance();
    session.deduplicationStore.record(event);

    // 7. Commit to Event Store
    this.eventStore.commit(event);

    // 8. Generate Snapshot & Dispatch
    const snapshot = session.toSnapshot(this.eventStore.getSessionEventCount(event.sessionId));
    this.dispatcher.dispatch(event.sessionId, snapshot, event);

    // 9. Buffer Drain: If contiguous events were waiting, drain and process them
    this.drainBufferedContiguous(session);

    return { status: 'accepted', event, snapshot };
  }

  /**
   * Applies domain-specific state mutations for an accepted event.
   */
  private applyDomainMutation(session: SessionStateContainer, event: AoeEvent): void {
    switch (event.eventType) {
      case 'session.started':
        // Session container already initialized
        break;

      case 'session.ended':
        session.status = event.payload.status;
        session.endedAt = event.timestamp;
        session.durationMs = event.payload.durationMs;
        break;

      case 'task.started':
        session.taskManager.registerTask(event.payload, event.timestamp, event.eventId);
        break;

      case 'task.updated':
        session.taskManager.updateTask(event.payload, event.timestamp, event.eventId);
        break;

      case 'task.completed':
        session.taskManager.completeTask(event.payload, event.timestamp, event.eventId);
        break;

      case 'task.failed':
        session.taskManager.failTask(event.payload, event.timestamp, event.eventId);
        session.errorsCount += 1;
        break;

      case 'progress.updated': {
        const progress = session.progressTracker.recordProgress(
          event.payload as ProgressUpdatedPayload,
        );
        if (event.payload.taskId) {
          session.taskManager.updateTaskProgress(event.payload.taskId, progress, event.timestamp);
        }
        break;
      }

      case 'file.changed': {
        const payload = event.payload as FileChangedPayload;
        session.fileChanges.push({
          action: payload.action,
          path: payload.path,
          oldPath: payload.oldPath,
          lineDelta: payload.lineDelta,
          evidence: payload.evidence,
          description: payload.description,
          taskId: payload.taskId,
          timestamp: event.timestamp,
        });
        break;
      }

      case 'diagnostic.emitted': {
        const payload = event.payload as DiagnosticEmittedPayload;
        if (payload.severity === 'error') {
          session.errorsCount += 1;
        } else if (payload.severity === 'warning') {
          session.warningsCount += 1;
        }
        session.diagnostics.push({
          severity: payload.severity,
          message: payload.message,
          code: payload.code,
          location: payload.location,
          isHypothesis: payload.isHypothesis,
          rootCause: payload.rootCause,
          suggestedRemediation: payload.suggestedRemediation,
          taskId: payload.taskId,
          timestamp: event.timestamp,
        });
        break;
      }

      case 'log.emitted': {
        const payload = event.payload as LogEmittedPayload;
        if (payload.level === 'error') {
          session.errorsCount += 1;
        } else if (payload.level === 'warn') {
          session.warningsCount += 1;
        }
        break;
      }

      case 'result.produced':
      case 'error.occurred':
        if (event.eventType === 'error.occurred') {
          session.errorsCount += 1;
        }
        break;
    }
  }

  /**
   * Recursively drains contiguous buffered events.
   */
  private drainBufferedContiguous(session: SessionStateContainer): void {
    const contiguous = session.sequenceTracker.drainContiguous();
    for (const bufferedEvent of contiguous) {
      // Validate lifecycle on drain
      LifecycleManager.assertSessionCanAcceptEvent(
        session.sessionId,
        session.status,
        bufferedEvent.eventId,
      );

      this.applyDomainMutation(session, bufferedEvent);
      session.deduplicationStore.record(bufferedEvent);
      this.eventStore.commit(bufferedEvent);

      const snapshot = session.toSnapshot(
        this.eventStore.getSessionEventCount(bufferedEvent.sessionId),
      );
      this.dispatcher.dispatch(bufferedEvent.sessionId, snapshot, bufferedEvent);
    }
  }
}
