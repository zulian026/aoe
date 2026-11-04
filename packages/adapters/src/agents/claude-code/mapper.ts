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
} from '@zyanx04/protocol';
import type { AdapterSession } from '../../contracts/session.js';
import { sanitizeAgentText, sanitizePayload } from '../../utils/sanitizer.js';
import {
  ClaudeCodeHookPayloadSchema,
  ClaudeCodeStreamEventSchema,
  type ClaudeCodeHookPayload,
  type ClaudeCodeStreamEvent,
} from './schema.js';

export class ClaudeCodeMapper {
  /**
   * Translates a parsed Claude Code event into one or more canonical AOE protocol events.
   */
  public mapEvent(raw: unknown, session: AdapterSession): AoeEvent[] {
    // 1. Try Hook Payload schema
    const hookResult = ClaudeCodeHookPayloadSchema.safeParse(raw);
    if (hookResult.success) {
      return this.mapHookPayload(hookResult.data, session);
    }

    // 2. Try Stream-JSON schema
    const streamResult = ClaudeCodeStreamEventSchema.safeParse(raw);
    if (streamResult.success) {
      return this.mapStreamEvent(streamResult.data, session);
    }

    return [];
  }

  private mapHookPayload(payload: ClaudeCodeHookPayload, session: AdapterSession): AoeEvent[] {
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
              name: 'claude-code',
            },
            workingDirectory: payload.cwd ?? session.workingDirectory,
            metadata: {
              externalSessionId: payload.session_id,
              permissionMode: payload.permission_mode,
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
            summary: 'Claude Code session completed',
          },
        };
        events.push(validateEvent(event));
        break;
      }

      case 'UserPromptSubmit': {
        const promptText = payload.prompt ?? payload.message ?? 'User prompt';
        const sanitizedPrompt = sanitizeAgentText(promptText);
        const taskId = session.mapTaskId(`prompt_${Date.now()}`);

        const taskStart: TaskStartedEvent = {
          protocolVersion: PROTOCOL_VERSION,
          eventId: createEventId('evt'),
          sessionId: session.id,
          sequence: session.nextSequence(),
          timestamp: new Date().toISOString(),
          eventType: 'task.started',
          payload: {
            taskId,
            taskName: sanitizedPrompt.slice(0, 80),
            metadata: {
              source: 'UserPromptSubmit',
            },
          },
        };
        events.push(validateEvent(taskStart));
        break;
      }

      case 'PreToolUse': {
        const toolName = payload.tool_name ?? 'Tool';
        const rawToolUseId = payload.tool_use_id ?? `tool_${toolName}_${Date.now()}`;
        const taskId = session.mapTaskId(rawToolUseId);
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

        // If tool is Bash, emit log of command execution
        if (toolName === 'Bash' && payload.tool_input?.command) {
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

      case 'PostToolUse': {
        const toolName = payload.tool_name ?? 'Tool';
        const rawToolUseId = payload.tool_use_id ?? `tool_${toolName}_${Date.now()}`;
        const taskId = session.mapTaskId(rawToolUseId);

        // Check if tool produced a file change
        if (toolName === 'Edit' || toolName === 'Write') {
          const filePath =
            typeof payload.tool_input?.file_path === 'string' ? payload.tool_input.file_path : '';
          if (filePath) {
            const action = toolName === 'Write' ? 'CREATED' : 'MODIFIED';
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

      case 'PostToolUseFailure': {
        const toolName = payload.tool_name ?? 'Tool';
        const rawToolUseId = payload.tool_use_id ?? `tool_${toolName}_${Date.now()}`;
        const taskId = session.mapTaskId(rawToolUseId);
        const errorMsg = sanitizeAgentText(
          String(payload.error ?? payload.tool_response ?? 'Tool execution failed'),
        );

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
              message: errorMsg,
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
            message: `Tool ${toolName} failed: ${errorMsg}`,
            severity: 'recoverable',
            taskId,
          },
        };
        events.push(validateEvent(errEvent));
        break;
      }
    }

    return events;
  }

  private mapStreamEvent(event: ClaudeCodeStreamEvent, session: AdapterSession): AoeEvent[] {
    const events: AoeEvent[] = [];

    if (event.type === 'tool_use') {
      const toolName = event.name ?? 'Tool';
      const taskId = session.mapTaskId(event.id ?? `tool_${toolName}_${Date.now()}`);
      const summary = this.formatToolSummary(toolName, event.input);

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
            toolInput: sanitizePayload(event.input),
          },
        },
      };
      events.push(validateEvent(taskStart));
    } else if (event.type === 'tool_result') {
      const toolName = event.name ?? 'Tool';
      const taskId = session.mapTaskId(event.id ?? `tool_${toolName}_${Date.now()}`);

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
    } else if (event.type === 'result') {
      const sessionEnd: SessionEndedEvent = {
        protocolVersion: PROTOCOL_VERSION,
        eventId: createEventId('evt'),
        sessionId: session.id,
        sequence: session.nextSequence(),
        timestamp: new Date().toISOString(),
        eventType: 'session.ended',
        payload: {
          status: 'completed',
          summary: 'Claude Code process completed',
        },
      };
      events.push(validateEvent(sessionEnd));
    }

    return events;
  }

  private formatToolSummary(toolName: string, input?: Record<string, unknown>): string {
    if (!input) return '';
    if (toolName === 'Edit' || toolName === 'Write' || toolName === 'Read') {
      return typeof input.file_path === 'string' ? input.file_path : '';
    }
    if (toolName === 'Bash') {
      const cmd = typeof input.command === 'string' ? input.command : '';
      return sanitizeAgentText(cmd.slice(0, 60));
    }
    if (toolName === 'Grep' || toolName === 'Glob') {
      return typeof input.pattern === 'string' ? input.pattern : '';
    }
    return '';
  }
}
