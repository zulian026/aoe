import {
  PROTOCOL_VERSION,
  createEventId,
  validateEvent,
  type AoeEvent,
  type SessionStartedEvent,
  type SessionEndedEvent,
  type TaskStartedEvent,
  type TaskCompletedEvent,
  type TaskFailedEvent,
  type FileChangedEvent,
  type LogEmittedEvent,
  type ErrorOccurredEvent,
} from '@aoe/protocol';
import type { AdapterSession } from '../../contracts/session.js';
import { sanitizeAgentText, sanitizePayload } from '../../utils/sanitizer.js';
import {
  GeminiCliHookPayloadSchema,
  GeminiCliStreamEventSchema,
  type GeminiCliHookPayload,
  type GeminiCliStreamEvent,
} from './schema.js';

export class GeminiCliMapper {
  /**
   * Translates a parsed Gemini CLI event into one or more canonical AOE protocol events.
   */
  public mapEvent(raw: unknown, session: AdapterSession): AoeEvent[] {
    const hookResult = GeminiCliHookPayloadSchema.safeParse(raw);
    if (hookResult.success) {
      return this.mapHookPayload(hookResult.data, session);
    }

    const streamResult = GeminiCliStreamEventSchema.safeParse(raw);
    if (streamResult.success) {
      return this.mapStreamEvent(streamResult.data, session);
    }

    return [];
  }

  private mapHookPayload(payload: GeminiCliHookPayload, session: AdapterSession): AoeEvent[] {
    const events: AoeEvent[] = [];
    const eventName = payload.hook_event_name;

    switch (eventName) {
      case 'SessionStart': {
        const event: SessionStartedEvent = {
          protocolVersion: PROTOCOL_VERSION,
          eventId: createEventId('evt'),
          sessionId: session.id,
          sequence: session.nextSequence(),
          timestamp: new Date().toISOString(),
          eventType: 'session.started',
          payload: {
            agent: {
              name: 'gemini-cli',
            },
            workingDirectory: payload.cwd ?? session.workingDirectory,
            metadata: {
              externalSessionId: payload.session_id,
            },
          },
        };
        events.push(validateEvent(event));
        break;
      }

      case 'SessionEnd': {
        const event: SessionEndedEvent = {
          protocolVersion: PROTOCOL_VERSION,
          eventId: createEventId('evt'),
          sessionId: session.id,
          sequence: session.nextSequence(),
          timestamp: new Date().toISOString(),
          eventType: 'session.ended',
          payload: {
            status: 'completed',
            summary: 'Gemini CLI session completed',
          },
        };
        events.push(validateEvent(event));
        break;
      }

      case 'BeforeAgent': {
        const msg = payload.message ? sanitizeAgentText(payload.message) : 'Agent iteration turn';
        const taskId = session.mapTaskId(`turn_${Date.now()}`);

        const taskStart: TaskStartedEvent = {
          protocolVersion: PROTOCOL_VERSION,
          eventId: createEventId('evt'),
          sessionId: session.id,
          sequence: session.nextSequence(),
          timestamp: new Date().toISOString(),
          eventType: 'task.started',
          payload: {
            taskId,
            taskName: msg.slice(0, 80),
            metadata: {
              source: 'BeforeAgent',
            },
          },
        };
        events.push(validateEvent(taskStart));
        break;
      }

      case 'BeforeTool': {
        const toolName = payload.tool_name ?? 'Tool';
        const rawToolId =
          payload.tool_use_id ??
          payload.call_id ??
          `tool_${toolName}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        session.metadata['current_gemini_tool_id'] = rawToolId;
        const taskId = session.mapTaskId(rawToolId);
        const summary = this.formatToolSummary(toolName, payload.tool_input);

        const taskStart: TaskStartedEvent = {
          protocolVersion: PROTOCOL_VERSION,
          eventId: createEventId('evt'),
          sessionId: session.id,
          sequence: session.nextSequence(),
          timestamp: new Date().toISOString(),
          eventType: 'task.started',
          payload: {
            taskId,
            taskName: `${toolName}: ${summary}`,
            metadata: {
              toolName,
              toolInput: sanitizePayload(payload.tool_input),
            },
          },
        };
        events.push(validateEvent(taskStart));

        // If run_command tool, emit log entry
        if (toolName === 'run_command' && payload.tool_input?.command) {
          const cmd = sanitizeAgentText(String(payload.tool_input.command));
          const logEvent: LogEmittedEvent = {
            protocolVersion: PROTOCOL_VERSION,
            eventId: createEventId('evt'),
            sessionId: session.id,
            sequence: session.nextSequence(),
            timestamp: new Date().toISOString(),
            eventType: 'log.emitted',
            payload: {
              level: 'info',
              message: `$ ${cmd}`,
              taskId,
            },
          };
          events.push(validateEvent(logEvent));
        }
        break;
      }

      case 'AfterTool': {
        const toolName = payload.tool_name ?? 'Tool';
        const rawToolId =
          payload.tool_use_id ??
          payload.call_id ??
          (session.metadata['current_gemini_tool_id'] as string) ??
          `tool_${toolName}_${Date.now()}`;
        delete session.metadata['current_gemini_tool_id'];
        const taskId = session.mapTaskId(rawToolId);

        if (payload.error) {
          const errText = sanitizeAgentText(String(payload.error));
          const taskFail: TaskFailedEvent = {
            protocolVersion: PROTOCOL_VERSION,
            eventId: createEventId('evt'),
            sessionId: session.id,
            sequence: session.nextSequence(),
            timestamp: new Date().toISOString(),
            eventType: 'task.failed',
            payload: {
              taskId,
              error: {
                code: 'TOOL_EXECUTION_FAILURE',
                message: errText,
              },
            },
          };
          events.push(validateEvent(taskFail));

          const errEvent: ErrorOccurredEvent = {
            protocolVersion: PROTOCOL_VERSION,
            eventId: createEventId('evt'),
            sessionId: session.id,
            sequence: session.nextSequence(),
            timestamp: new Date().toISOString(),
            eventType: 'error.occurred',
            payload: {
              code: 'TOOL_EXECUTION_FAILURE',
              message: `Tool ${toolName} failed: ${errText}`,
              severity: 'recoverable',
              taskId,
            },
          };
          events.push(validateEvent(errEvent));
          break;
        }

        // File modifications
        if (toolName === 'write_file' || toolName === 'edit_file') {
          const filePath =
            typeof payload.tool_input?.path === 'string' ? payload.tool_input.path : '';
          if (filePath) {
            const action = toolName === 'write_file' ? 'CREATED' : 'MODIFIED';
            const fileEvent: FileChangedEvent = {
              protocolVersion: PROTOCOL_VERSION,
              eventId: createEventId('evt'),
              sessionId: session.id,
              sequence: session.nextSequence(),
              timestamp: new Date().toISOString(),
              eventType: 'file.changed',
              payload: {
                path: filePath,
                action,
                evidence: {
                  verifiedOnDisk: true,
                },
                taskId,
              },
            };
            events.push(validateEvent(fileEvent));
          }
        }

        const taskComplete: TaskCompletedEvent = {
          protocolVersion: PROTOCOL_VERSION,
          eventId: createEventId('evt'),
          sessionId: session.id,
          sequence: session.nextSequence(),
          timestamp: new Date().toISOString(),
          eventType: 'task.completed',
          payload: {
            taskId,
            resultSummary: `${toolName} executed successfully`,
            verified: true,
          },
        };
        events.push(validateEvent(taskComplete));
        break;
      }
    }

    return events;
  }

  private mapStreamEvent(event: GeminiCliStreamEvent, session: AdapterSession): AoeEvent[] {
    const events: AoeEvent[] = [];

    switch (event.type) {
      case 'init': {
        const initEvent: SessionStartedEvent = {
          protocolVersion: PROTOCOL_VERSION,
          eventId: createEventId('evt'),
          sessionId: session.id,
          sequence: session.nextSequence(),
          timestamp: new Date().toISOString(),
          eventType: 'session.started',
          payload: {
            agent: {
              name: 'gemini-cli',
            },
            workingDirectory: event.cwd ?? session.workingDirectory,
            metadata: {
              externalSessionId: event.session_id,
            },
          },
        };
        events.push(validateEvent(initEvent));
        break;
      }

      case 'tool_use': {
        const toolName = event.tool_name ?? 'Tool';
        const input = event.parameters ?? event.input;
        const rawToolId =
          event.tool_use_id ??
          event.call_id ??
          event.id ??
          `tool_${toolName}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        session.metadata['current_gemini_tool_id'] = rawToolId;
        const taskId = session.mapTaskId(rawToolId);
        const summary = this.formatToolSummary(toolName, input);

        const taskStart: TaskStartedEvent = {
          protocolVersion: PROTOCOL_VERSION,
          eventId: createEventId('evt'),
          sessionId: session.id,
          sequence: session.nextSequence(),
          timestamp: new Date().toISOString(),
          eventType: 'task.started',
          payload: {
            taskId,
            taskName: `${toolName}: ${summary}`,
            metadata: {
              toolName,
              toolInput: sanitizePayload(input),
            },
          },
        };
        events.push(validateEvent(taskStart));
        break;
      }

      case 'tool_result': {
        const toolName = event.tool_name ?? 'Tool';
        const rawToolId =
          event.tool_use_id ??
          event.call_id ??
          event.id ??
          (session.metadata['current_gemini_tool_id'] as string) ??
          `tool_${toolName}_${Date.now()}`;
        delete session.metadata['current_gemini_tool_id'];
        const taskId = session.mapTaskId(rawToolId);

        const taskComplete: TaskCompletedEvent = {
          protocolVersion: PROTOCOL_VERSION,
          eventId: createEventId('evt'),
          sessionId: session.id,
          sequence: session.nextSequence(),
          timestamp: new Date().toISOString(),
          eventType: 'task.completed',
          payload: {
            taskId,
            resultSummary: `${toolName} finished`,
            verified: true,
          },
        };
        events.push(validateEvent(taskComplete));
        break;
      }

      case 'result': {
        const sessionEnd: SessionEndedEvent = {
          protocolVersion: PROTOCOL_VERSION,
          eventId: createEventId('evt'),
          sessionId: session.id,
          sequence: session.nextSequence(),
          timestamp: new Date().toISOString(),
          eventType: 'session.ended',
          payload: {
            status: 'completed',
            summary: 'Gemini CLI execution finished',
          },
        };
        events.push(validateEvent(sessionEnd));
        break;
      }

      case 'error': {
        const errMsg = sanitizeAgentText(String(event.error ?? 'Gemini CLI error'));
        const errEvent: ErrorOccurredEvent = {
          protocolVersion: PROTOCOL_VERSION,
          eventId: createEventId('evt'),
          sessionId: session.id,
          sequence: session.nextSequence(),
          timestamp: new Date().toISOString(),
          eventType: 'error.occurred',
          payload: {
            code: 'AGENT_ERROR',
            message: errMsg,
            severity: 'recoverable',
          },
        };
        events.push(validateEvent(errEvent));
        break;
      }
    }

    return events;
  }

  private formatToolSummary(toolName: string, input?: Record<string, unknown>): string {
    if (!input) return '';
    if (toolName === 'write_file' || toolName === 'edit_file' || toolName === 'read_file') {
      return typeof input.path === 'string' ? input.path : '';
    }
    if (toolName === 'run_command') {
      const cmd = typeof input.command === 'string' ? input.command : '';
      return sanitizeAgentText(cmd.slice(0, 60));
    }
    return '';
  }
}
