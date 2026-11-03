import { describe, it, expect, beforeEach } from 'vitest';
import { GeminiCliAdapter } from '../agents/gemini-cli/adapter.js';

describe('GeminiCliAdapter', () => {
  let adapter: GeminiCliAdapter;

  beforeEach(() => {
    adapter = new GeminiCliAdapter();
  });

  it('detects Gemini CLI from environment and metadata', () => {
    const envDetected = adapter.detect({
      environment: { GEMINI_CLI_HOME: '/home/user/.gemini' },
    });
    expect(envDetected.detected).toBe(true);
    expect(envDetected.confidence).toBe('high');

    const metaDetected = adapter.detect({
      environment: { GEMINI_CLI_HOME: '/home/user/.gemini' },
      metadata: { agent: 'gemini-cli' },
    });
    expect(metaDetected.detected).toBe(true);
    expect(metaDetected.confidence).toBe('exact');

    expect(adapter.detect({}).detected).toBe(false);
  });

  it('normalizes SessionStart and SessionEnd hook payloads', () => {
    const session = adapter.initialize({}, 'sess-gemini-1');

    // Start
    const startPayload = {
      session_id: 'gemini-1234',
      hook_event_name: 'SessionStart',
      cwd: '/my/gemini/project',
    };
    const startEvents = adapter.normalize(startPayload, session);
    expect(startEvents).toHaveLength(1);
    expect(startEvents[0].eventType).toBe('session.started');
    expect(startEvents[0].sessionId).toBe('sess-gemini-1');
    const startPayloadData = startEvents[0].payload as {
      agent: { name: string };
      workingDirectory: string;
    };
    expect(startPayloadData.agent.name).toBe('gemini-cli');
    expect(startPayloadData.workingDirectory).toBe('/my/gemini/project');

    // End
    const endPayload = {
      session_id: 'gemini-1234',
      hook_event_name: 'SessionEnd',
    };
    const endEvents = adapter.normalize(endPayload, session);
    expect(endEvents).toHaveLength(1);
    expect(endEvents[0].eventType).toBe('session.ended');
  });

  it('normalizes BeforeAgent turn into task.started', () => {
    const session = adapter.initialize({});
    const turnPayload = {
      session_id: 'gemini-1234',
      hook_event_name: 'BeforeAgent',
      message: 'Implement auth middleware',
    };

    const events = adapter.normalize(turnPayload, session);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('task.started');
    expect((events[0].payload as { taskName: string }).taskName).toContain(
      'Implement auth middleware',
    );
  });

  it('normalizes BeforeTool and AfterTool for write_file into task and file.changed events', () => {
    const session = adapter.initialize({});

    // BeforeTool
    const beforeTool = {
      session_id: 'gemini-1234',
      hook_event_name: 'BeforeTool',
      tool_name: 'write_file',
      tool_input: {
        path: '/workspace/src/auth.ts',
        content: 'export const auth = true;',
      },
    };
    const beforeEvents = adapter.normalize(beforeTool, session);
    expect(beforeEvents).toHaveLength(1);
    expect(beforeEvents[0].eventType).toBe('task.started');
    expect((beforeEvents[0].payload as { taskName: string }).taskName).toContain(
      'write_file: /workspace/src/auth.ts',
    );

    // AfterTool
    const afterTool = {
      session_id: 'gemini-1234',
      hook_event_name: 'AfterTool',
      tool_name: 'write_file',
      tool_input: {
        path: '/workspace/src/auth.ts',
      },
      tool_result: { success: true },
    };
    const afterEvents = adapter.normalize(afterTool, session);
    expect(afterEvents).toHaveLength(2); // file.changed + task.completed

    const fileEvent = afterEvents.find((e) => e.eventType === 'file.changed');
    expect(fileEvent).toBeDefined();
    expect((fileEvent?.payload as { path: string; action: string }).path).toBe(
      '/workspace/src/auth.ts',
    );
    expect((fileEvent?.payload as { action: string }).action).toBe('CREATED');

    const completeEvent = afterEvents.find((e) => e.eventType === 'task.completed');
    expect(completeEvent).toBeDefined();
  });

  it('normalizes run_command tool execution and logs command with secret masking', () => {
    const session = adapter.initialize({});
    const runTool = {
      session_id: 'gemini-1234',
      hook_event_name: 'BeforeTool',
      tool_name: 'run_command',
      tool_input: {
        command: 'curl -u admin:password=mySecretPassword123 http://internal.net',
      },
    };

    const events = adapter.normalize(runTool, session);
    expect(events).toHaveLength(2); // task.started + log.emitted

    const logEvent = events.find((e) => e.eventType === 'log.emitted');
    expect(logEvent).toBeDefined();
    const msg = (logEvent?.payload as { message: string }).message;
    expect(msg).toContain('password=[REDACTED]');
    expect(msg).not.toContain('mySecretPassword123');
  });

  it('normalizes tool execution errors into task.failed and error.occurred', () => {
    const session = adapter.initialize({});
    const failTool = {
      session_id: 'gemini-1234',
      hook_event_name: 'AfterTool',
      tool_name: 'run_command',
      error: 'Permission denied (exit code 1)',
    };

    const events = adapter.normalize(failTool, session);
    expect(events).toHaveLength(2);

    const taskFail = events.find((e) => e.eventType === 'task.failed');
    expect(taskFail).toBeDefined();

    const errEvent = events.find((e) => e.eventType === 'error.occurred');
    expect(errEvent).toBeDefined();
    expect((errEvent?.payload as { message: string }).message).toContain('Permission denied');
  });

  it('normalizes stream-json output from Gemini CLI --output-format stream-json', () => {
    const session = adapter.initialize({});

    const initEvent = {
      type: 'init',
      session_id: 'stream-1',
      cwd: '/workspace',
    };
    const eventsInit = adapter.normalize(initEvent, session);
    expect(eventsInit).toHaveLength(1);
    expect(eventsInit[0].eventType).toBe('session.started');

    const toolEvent = {
      type: 'tool_use',
      tool_name: 'edit_file',
      parameters: { path: 'index.ts' },
    };
    const eventsTool = adapter.normalize(toolEvent, session);
    expect(eventsTool).toHaveLength(1);
    expect(eventsTool[0].eventType).toBe('task.started');

    const resultEvent = {
      type: 'result',
    };
    const eventsResult = adapter.normalize(resultEvent, session);
    expect(eventsResult).toHaveLength(1);
    expect(eventsResult[0].eventType).toBe('session.ended');
  });
});
