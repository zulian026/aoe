import {
  PROTOCOL_VERSION,
  createEventId,
  validateEvent,
  type AoeEvent,
  type SessionStartedEvent,
  type SessionEndedEvent,
  type TaskStartedEvent,
  type TaskUpdatedEvent,
  type TaskCompletedEvent,
  type TaskFailedEvent,
  type FileChangedEvent,
  type LogEmittedEvent,
  type DiagnosticEmittedEvent,
  type ProgressUpdatedEvent,
} from '@zyanx04/protocol';
import type { AdapterSession } from '../../contracts/session.js';
import { sanitizeAgentText, sanitizePayload } from '../../utils/sanitizer.js';
import { AdapterParsingError } from '../../errors/index.js';
import { evaluateVerificationEvidence, type VerificationEvidence } from './evidence.js';
import type { AntigravitySessionStore } from './state-store.js';

export const ALLOWED_HOOK_EVENTS = [
  'SessionStart',
  'PreInvocation',
  'PreToolUse',
  'PostToolUse',
  'Stop',
] as const;

export type AntigravityHookEventName = (typeof ALLOWED_HOOK_EVENTS)[number];

export class AntigravityMapper {
  /**
   * Translates an Antigravity hook payload into one or more canonical AOE protocol events.
   */
  public mapEvent(
    raw: unknown,
    session: AdapterSession,
    explicitEvent?: string,
    store?: AntigravitySessionStore,
  ): AoeEvent[] {
    if (!raw || typeof raw !== 'object') {
      return [];
    }

    const rec = raw as Record<string, unknown>;
    const effectiveStore =
      store ?? (session.metadata['sessionStore'] as AntigravitySessionStore | undefined);

    const eventName = this.resolveEventName(rec, explicitEvent);

    // Explicit deduplication check if state store is available
    const signature = this.computeEventSignature(eventName, rec);
    if (signature && effectiveStore?.checkAndRecordSignatureSync(signature)) {
      return []; // Duplicate event within the same session
    }

    switch (eventName) {
      case 'SessionStart':
        return this.mapSessionStart(rec, session, effectiveStore);
      case 'PreInvocation':
        return this.mapPreInvocation(rec, session, effectiveStore);
      case 'PreToolUse':
        return this.mapPreToolUse(rec, session, effectiveStore);
      case 'PostToolUse':
        return this.mapPostToolUse(rec, session, effectiveStore);
      case 'Stop':
        return this.mapStop(rec, session, effectiveStore);
      default:
        return [];
    }
  }

  /**
   * Resolves and strictly validates the hook event name.
   * Requires explicit declaration via parameter or hookEventName property.
   * Rejects ambiguous or unknown events with a controlled error.
   */
  public resolveEventName(rec: Record<string, unknown>, explicit?: string): AntigravityHookEventName {
    const candidate =
      explicit ??
      (typeof rec.hookEventName === 'string'
        ? rec.hookEventName
        : typeof rec.hook_event_name === 'string'
          ? rec.hook_event_name
          : undefined);

    if (candidate) {
      if (!ALLOWED_HOOK_EVENTS.includes(candidate as AntigravityHookEventName)) {
        throw new AdapterParsingError(
          `Unknown Antigravity hook event "${candidate}". Allowed events: ${ALLOWED_HOOK_EVENTS.join(', ')}`,
          { rawInput: JSON.stringify(rec) },
        );
      }
      return candidate as AntigravityHookEventName;
    }

    throw new AdapterParsingError(
      'Missing explicit hook event name. Please specify --event <SessionStart|PreInvocation|PreToolUse|PostToolUse|Stop>.',
      { rawInput: JSON.stringify(rec) },
    );
  }

  private allocateSequence(session: AdapterSession, store?: AntigravitySessionStore): number {
    if (store) {
      const [seq] = store.allocateSequencesSync(1);
      return seq;
    }
    return session.nextSequence();
  }

  private computeEventSignature(eventName: string, rec: Record<string, unknown>): string | null {
    switch (eventName) {
      case 'SessionStart':
        return `SessionStart:${String(rec.conversationId ?? rec.conversation_id ?? 'init')}`;
      case 'PreInvocation':
        return `PreInvocation:${Number(rec.invocationNum ?? rec.invocation_num ?? 1)}`;
      case 'PreToolUse': {
        const tool = (rec.toolCall ?? rec.tool_call ?? {}) as Record<string, unknown>;
        const step = rec.stepIdx ?? rec.step_idx ?? '';
        return `PreToolUse:${step}:${String(tool.name ?? '')}`;
      }
      case 'PostToolUse': {
        const tool = (rec.toolCall ?? rec.tool_call ?? {}) as Record<string, unknown>;
        const step = rec.stepIdx ?? rec.step_idx ?? '';
        return `PostToolUse:${step}:${String(tool.name ?? '')}`;
      }
      case 'Stop':
        return `Stop:${Number(rec.executionNum ?? rec.execution_num ?? 1)}`;
      default:
        return null;
    }
  }

  private mapSessionStart(
    rec: Record<string, unknown>,
    session: AdapterSession,
    store?: AntigravitySessionStore,
  ): AoeEvent[] {
    const conversationId = String(rec.conversationId ?? rec.conversation_id ?? session.id);
    const workspacePaths = (rec.workspacePaths ?? rec.workspace_paths ?? []) as string[];
    const workingDirectory = workspacePaths[0] ?? session.workingDirectory;
    const modelName = String(rec.modelName ?? rec.model_name ?? 'auto');

    session.metadata['conversationId'] = conversationId;
    if (rec.transcriptPath || rec.transcript_path) {
      session.metadata['transcriptPath'] = rec.transcriptPath ?? rec.transcript_path;
    }
    if (rec.artifactDirectoryPath || rec.artifact_directory_path) {
      session.metadata['artifactDirectoryPath'] =
        rec.artifactDirectoryPath ?? rec.artifact_directory_path;
    }

    if (rec.metadata && typeof rec.metadata === 'object') {
      session.metadata['custom'] = sanitizePayload(rec.metadata);
    }

    const event: SessionStartedEvent = {
      protocolVersion: PROTOCOL_VERSION,
      eventId: createEventId('evt'),
      sessionId: session.id,
      sequence: this.allocateSequence(session, store),
      timestamp: new Date().toISOString(),
      eventType: 'session.started',
      payload: {
        agent: {
          name: 'antigravity',
          version: modelName,
        },
        workingDirectory,
        metadata: {
          conversationId,
          transcriptPath: session.metadata['transcriptPath'],
          artifactDirectoryPath: session.metadata['artifactDirectoryPath'],
        },
      },
    };

    return [validateEvent(event)];
  }

  private mapPreInvocation(
    rec: Record<string, unknown>,
    session: AdapterSession,
    store?: AntigravitySessionStore,
  ): AoeEvent[] {
    const invocationNum = Number(rec.invocationNum ?? rec.invocation_num ?? 1);
    const rawUserInput = typeof rec.lastUserInput === 'string'
      ? rec.lastUserInput
      : typeof rec.last_user_input === 'string'
        ? rec.last_user_input
        : undefined;

    const taskId = store
      ? store.mapTaskIdSync(`turn_${invocationNum}`)
      : session.mapTaskId(`turn_${invocationNum}`);

    session.metadata['current_turn_task_id'] = taskId;
    if (store) {
      store.setActiveTaskIdSync(taskId);
    }

    const taskName = rawUserInput
      ? sanitizeAgentText(rawUserInput).slice(0, 80)
      : `Turn ${invocationNum}`;

    const event: TaskStartedEvent = {
      protocolVersion: PROTOCOL_VERSION,
      eventId: createEventId('evt'),
      sessionId: session.id,
      sequence: this.allocateSequence(session, store),
      timestamp: new Date().toISOString(),
      eventType: 'task.started',
      payload: {
        taskId,
        taskName,
        metadata: {
          invocationNum,
          source: 'PreInvocation',
        },
      },
    };

    return [validateEvent(event)];
  }

  private mapPreToolUse(
    rec: Record<string, unknown>,
    session: AdapterSession,
    store?: AntigravitySessionStore,
  ): AoeEvent[] {
    const rawTool = (rec.toolCall ?? rec.tool_call ?? {}) as Record<string, unknown>;
    const toolName = String(rawTool.name ?? 'UnknownTool');
    const toolArgs = (rawTool.args ?? {}) as Record<string, unknown>;
    const stepIdx = Number(rec.stepIdx ?? rec.step_idx ?? Date.now());

    session.metadata[`active_tool_${stepIdx}`] = {
      name: toolName,
      args: sanitizePayload(toolArgs),
    };

    const taskId =
      store?.getActiveTaskIdSync() ??
      (session.metadata['current_turn_task_id'] as string) ??
      session.mapTaskId('turn_1');

    const events: AoeEvent[] = [];

    // For run_command, emit log event for command line visibility
    if (toolName === 'run_command' && toolArgs.CommandLine) {
      const cmd = sanitizeAgentText(String(toolArgs.CommandLine));
      const logEvent: LogEmittedEvent = {
        protocolVersion: PROTOCOL_VERSION,
        eventId: createEventId('evt'),
        sessionId: session.id,
        sequence: this.allocateSequence(session, store),
        timestamp: new Date().toISOString(),
        eventType: 'log.emitted',
        payload: {
          level: 'info',
          message: `$ ${cmd}`,
          taskId,
          source: 'run_command',
        },
      };
      events.push(validateEvent(logEvent));
    }

    // Do NOT treat tool intent as execution success: emit estimate progress
    const progressEvent: ProgressUpdatedEvent = {
      protocolVersion: PROTOCOL_VERSION,
      eventId: createEventId('evt'),
      sessionId: session.id,
      sequence: this.allocateSequence(session, store),
      timestamp: new Date().toISOString(),
      eventType: 'progress.updated',
      payload: {
        taskId,
        completedWork: 0,
        isEstimate: true,
        currentWork: `Executing ${toolName}`,
        description: `Tool intent: ${toolName}`,
      },
    };
    events.push(validateEvent(progressEvent));

    return events;
  }

  private mapPostToolUse(
    rec: Record<string, unknown>,
    session: AdapterSession,
    store?: AntigravitySessionStore,
  ): AoeEvent[] {
    const rawTool = (rec.toolCall ?? rec.tool_call ?? {}) as Record<string, unknown>;
    const toolName = String(rawTool.name ?? 'UnknownTool');
    const toolArgs = (rawTool.args ?? {}) as Record<string, unknown>;
    const stepIdx = Number(rec.stepIdx ?? rec.step_idx ?? Date.now());
    delete session.metadata[`active_tool_${stepIdx}`];

    const taskId =
      store?.getActiveTaskIdSync() ??
      (session.metadata['current_turn_task_id'] as string) ??
      session.mapTaskId('turn_1');
    const events: AoeEvent[] = [];

    if (rec.error) {
      const errText = sanitizeAgentText(String(rec.error));
      const diagEvent: DiagnosticEmittedEvent = {
        protocolVersion: PROTOCOL_VERSION,
        eventId: createEventId('evt'),
        sessionId: session.id,
        sequence: this.allocateSequence(session, store),
        timestamp: new Date().toISOString(),
        eventType: 'diagnostic.emitted',
        payload: {
          severity: 'error',
          message: `Tool ${toolName} failed: ${errText}`,
          isHypothesis: false,
          taskId,
        },
      };
      events.push(validateEvent(diagEvent));

      const logEvent: LogEmittedEvent = {
        protocolVersion: PROTOCOL_VERSION,
        eventId: createEventId('evt'),
        sessionId: session.id,
        sequence: this.allocateSequence(session, store),
        timestamp: new Date().toISOString(),
        eventType: 'log.emitted',
        payload: {
          level: 'error',
          message: `Tool failure [${toolName}]: ${errText}`,
          taskId,
        },
      };
      events.push(validateEvent(logEvent));

      // Record failure evidence if tool was a test runner
      if (toolName === 'run_command' && toolArgs.CommandLine) {
        const cmd = String(toolArgs.CommandLine);
        const evidence = evaluateVerificationEvidence(cmd, rec.error, taskId, diagEvent.eventId);
        if (evidence) {
          if (store) {
            store.recordEvidenceSync(evidence);
          } else {
            const list = (session.metadata['verification_evidence'] as VerificationEvidence[]) || [];
            list.push(evidence);
            session.metadata['verification_evidence'] = list;
          }
        }
      }

      return events;
    }

    // Only emit file.changed when the payload provides sufficient evidence of an actual change
    if (toolName === 'write_file' && typeof toolArgs.Path === 'string' && toolArgs.Path.length > 0) {
      const action = toolArgs.Append === true ? 'MODIFIED' : 'CREATED';
      const fileEvent: FileChangedEvent = {
        protocolVersion: PROTOCOL_VERSION,
        eventId: createEventId('evt'),
        sessionId: session.id,
        sequence: this.allocateSequence(session, store),
        timestamp: new Date().toISOString(),
        eventType: 'file.changed',
        payload: {
          path: toolArgs.Path,
          action,
          evidence: {
            verifiedOnDisk: true,
          },
          taskId,
          description: `File ${action.toLowerCase()} via ${toolName}`,
        },
      };
      events.push(validateEvent(fileEvent));
      session.metadata['files_changed_count'] =
        ((session.metadata['files_changed_count'] as number) || 0) + 1;
    } else if (
      toolName === 'edit_file' &&
      typeof toolArgs.Path === 'string' &&
      toolArgs.Path.length > 0
    ) {
      const fileEvent: FileChangedEvent = {
        protocolVersion: PROTOCOL_VERSION,
        eventId: createEventId('evt'),
        sessionId: session.id,
        sequence: this.allocateSequence(session, store),
        timestamp: new Date().toISOString(),
        eventType: 'file.changed',
        payload: {
          path: toolArgs.Path,
          action: 'MODIFIED',
          evidence: {
            verifiedOnDisk: true,
          },
          taskId,
          description: 'File modified via edit_file',
        },
      };
      events.push(validateEvent(fileEvent));
      session.metadata['files_changed_count'] =
        ((session.metadata['files_changed_count'] as number) || 0) + 1;
    }

    // Phase 2: Record structured verification evidence if an actual test command completed successfully
    if (toolName === 'run_command' && toolArgs.CommandLine) {
      const cmd = String(toolArgs.CommandLine);
      const evidence = evaluateVerificationEvidence(cmd, undefined, taskId);
      if (evidence) {
        if (store) {
          store.recordEvidenceSync(evidence);
        } else {
          const list = (session.metadata['verification_evidence'] as VerificationEvidence[]) || [];
          list.push(evidence);
          session.metadata['verification_evidence'] = list;
        }
      }

      const logEvent: LogEmittedEvent = {
        protocolVersion: PROTOCOL_VERSION,
        eventId: createEventId('evt'),
        sessionId: session.id,
        sequence: this.allocateSequence(session, store),
        timestamp: new Date().toISOString(),
        eventType: 'log.emitted',
        payload: {
          level: 'info',
          message: `Command completed: ${sanitizeAgentText(cmd.slice(0, 80))}`,
          taskId,
        },
      };
      events.push(validateEvent(logEvent));
    }

    const progressEvent: ProgressUpdatedEvent = {
      protocolVersion: PROTOCOL_VERSION,
      eventId: createEventId('evt'),
      sessionId: session.id,
      sequence: this.allocateSequence(session, store),
      timestamp: new Date().toISOString(),
      eventType: 'progress.updated',
      payload: {
        taskId,
        completedWork: 1,
        isEstimate: true,
        currentWork: `${toolName} finished`,
        description: `Tool completed: ${toolName}`,
      },
    };
    events.push(validateEvent(progressEvent));

    return events;
  }

  private mapStop(
    rec: Record<string, unknown>,
    session: AdapterSession,
    store?: AntigravitySessionStore,
  ): AoeEvent[] {
    const terminationReason = String(rec.terminationReason ?? rec.termination_reason ?? 'NO_TOOL_CALL');
    const taskId =
      store?.getActiveTaskIdSync() ??
      (session.metadata['current_turn_task_id'] as string) ??
      session.mapTaskId('turn_1');
    const events: AoeEvent[] = [];

    if (terminationReason === 'ERROR') {
      const errMsg = sanitizeAgentText(String(rec.error || 'Execution halted with error'));
      const taskFail: TaskFailedEvent = {
        protocolVersion: PROTOCOL_VERSION,
        eventId: createEventId('evt'),
        sessionId: session.id,
        sequence: this.allocateSequence(session, store),
        timestamp: new Date().toISOString(),
        eventType: 'task.failed',
        payload: {
          taskId,
          error: {
            code: 'EXECUTION_ERROR',
            message: errMsg,
          },
          recoverable: false,
        },
      };
      events.push(validateEvent(taskFail));

      const sessionEnd: SessionEndedEvent = {
        protocolVersion: PROTOCOL_VERSION,
        eventId: createEventId('evt'),
        sessionId: session.id,
        sequence: this.allocateSequence(session, store),
        timestamp: new Date().toISOString(),
        eventType: 'session.ended',
        payload: {
          status: 'failed',
          summary: `Session ended with error: ${errMsg}`,
        },
      };
      events.push(validateEvent(sessionEnd));
      store?.markTerminatedSync('ERROR');
      return events;
    }

    if (terminationReason === 'USER_CANCELED') {
      const taskFail: TaskFailedEvent = {
        protocolVersion: PROTOCOL_VERSION,
        eventId: createEventId('evt'),
        sessionId: session.id,
        sequence: this.allocateSequence(session, store),
        timestamp: new Date().toISOString(),
        eventType: 'task.failed',
        payload: {
          taskId,
          error: {
            code: 'USER_CANCELED',
            message: 'Execution canceled by user',
          },
          recoverable: true,
        },
      };
      events.push(validateEvent(taskFail));

      const sessionEnd: SessionEndedEvent = {
        protocolVersion: PROTOCOL_VERSION,
        eventId: createEventId('evt'),
        sessionId: session.id,
        sequence: this.allocateSequence(session, store),
        timestamp: new Date().toISOString(),
        eventType: 'session.ended',
        payload: {
          status: 'cancelled',
          summary: 'Execution canceled by user',
        },
      };
      events.push(validateEvent(sessionEnd));
      store?.markTerminatedSync('USER_CANCELED');
      return events;
    }

    // Invariant: Do not automatically classify Stop as successful completion.
    // Never emit task.completed without verified evidence bound to this specific task.
    const metaVerified = rec.metadata && typeof rec.metadata === 'object'
      ? (rec.metadata as Record<string, unknown>).verified === true
      : rec.verified === true;

    const hasVerifiedEvidence =
      metaVerified ||
      (store
        ? store.hasPassedVerificationSync(taskId)
        : (session.metadata['verification_evidence'] as VerificationEvidence[] | undefined)?.some(
            (ev) => ev.taskId === taskId && ev.passed,
          ) === true);

    if (terminationReason === 'NO_TOOL_CALL' && hasVerifiedEvidence) {
      const taskComplete: TaskCompletedEvent = {
        protocolVersion: PROTOCOL_VERSION,
        eventId: createEventId('evt'),
        sessionId: session.id,
        sequence: this.allocateSequence(session, store),
        timestamp: new Date().toISOString(),
        eventType: 'task.completed',
        payload: {
          taskId,
          resultSummary: 'Turn completed with verified deliverables',
          verified: true,
        },
      };
      events.push(validateEvent(taskComplete));

      const sessionEnd: SessionEndedEvent = {
        protocolVersion: PROTOCOL_VERSION,
        eventId: createEventId('evt'),
        sessionId: session.id,
        sequence: this.allocateSequence(session, store),
        timestamp: new Date().toISOString(),
        eventType: 'session.ended',
        payload: {
          status: 'completed',
          summary: 'Session finished successfully',
        },
      };
      events.push(validateEvent(sessionEnd));
      store?.markTerminatedSync(terminationReason);
      return events;
    }

    // Stop without sufficient completion evidence: emit task.updated warning instead of task.completed
    const taskUpdate: TaskUpdatedEvent = {
      protocolVersion: PROTOCOL_VERSION,
      eventId: createEventId('evt'),
      sessionId: session.id,
      sequence: this.allocateSequence(session, store),
      timestamp: new Date().toISOString(),
      eventType: 'task.updated',
      payload: {
        taskId,
        status: 'warning',
        message: 'Turn finished without verified test assertions',
        reason: 'UNVERIFIED_COMPLETION',
      },
    };
    events.push(validateEvent(taskUpdate));

    const sessionEnd: SessionEndedEvent = {
      protocolVersion: PROTOCOL_VERSION,
      eventId: createEventId('evt'),
      sessionId: session.id,
      sequence: this.allocateSequence(session, store),
      timestamp: new Date().toISOString(),
      eventType: 'session.ended',
      payload: {
        status: 'completed',
        summary: `Session stopped with reason: ${terminationReason} (unverified outcome)`,
      },
    };
    events.push(validateEvent(sessionEnd));
    store?.markTerminatedSync(terminationReason);

    return events;
  }
}
