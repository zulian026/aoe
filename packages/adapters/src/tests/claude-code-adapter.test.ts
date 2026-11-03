import { describe, it, expect, beforeEach } from 'vitest';
import { ClaudeCodeAdapter } from '../agents/claude-code/adapter.js';

describe('ClaudeCodeAdapter', () => {
  let adapter: ClaudeCodeAdapter;

  beforeEach(() => {
    adapter = new ClaudeCodeAdapter();
  });

  it('detects Claude Code from environment variables and metadata', () => {
    const envDetected = adapter.detect({
      environment: { CLAUDE_CODE_ENTRYPOINT: 'cli' },
    });
    expect(envDetected.detected).toBe(true);
    expect(envDetected.confidence).toBe('high');

    const exactDetected = adapter.detect({
      environment: { CLAUDE_PROJECT_DIR: '/workspace' },
      metadata: { agent: 'claude-code' },
    });
    expect(exactDetected.detected).toBe(true);
    expect(exactDetected.confidence).toBe('exact');

    const noneDetected = adapter.detect({});
    expect(noneDetected.detected).toBe(false);
  });

  it('normalizes SessionStart hook payload into session.started event', () => {
    const session = adapter.initialize({}, 'sess-claude-1');
    const hookPayload = {
      session_id: 'claude-session-abc',
      hook_event_name: 'SessionStart',
      cwd: '/workspace/project',
      permission_mode: 'auto',
    };

    const events = adapter.normalize(hookPayload, session);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('session.started');
    expect(events[0].sessionId).toBe('sess-claude-1');
    expect(events[0].sequence).toBe(0);
    const payload = events[0].payload as { agent: { name: string }; workingDirectory: string };
    expect(payload.agent.name).toBe('claude-code');
    expect(payload.workingDirectory).toBe('/workspace/project');
  });

  it('normalizes SessionEnd hook payload into session.ended event', () => {
    const session = adapter.initialize({});
    const hookPayload = {
      session_id: 'claude-session-abc',
      hook_event_name: 'SessionEnd',
    };

    const events = adapter.normalize(hookPayload, session);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('session.ended');
    const payload = events[0].payload as { status: string };
    expect(payload.status).toBe('completed');
  });

  it('normalizes UserPromptSubmit hook payload into task.started event', () => {
    const session = adapter.initialize({});
    const hookPayload = {
      session_id: 'claude-session-abc',
      hook_event_name: 'UserPromptSubmit',
      prompt: 'Fix type error in src/index.ts',
    };

    const events = adapter.normalize(hookPayload, session);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('task.started');
    const payload = events[0].payload as { taskName: string; taskId: string };
    expect(payload.taskName).toBe('Fix type error in src/index.ts');
  });

  it('normalizes PreToolUse and PostToolUse for Edit into task and file.changed events', () => {
    const session = adapter.initialize({});

    // 1. PreToolUse
    const preTool = {
      session_id: 'claude-session-abc',
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_use_id: 'tool_edit_42',
      tool_input: {
        file_path: 'src/main.ts',
        old_string: 'const a = 1;',
        new_string: 'const a = 2;',
      },
    };

    const startEvents = adapter.normalize(preTool, session);
    expect(startEvents).toHaveLength(1);
    expect(startEvents[0].eventType).toBe('task.started');
    expect((startEvents[0].payload as { taskName: string }).taskName).toContain(
      'Edit: src/main.ts',
    );

    // 2. PostToolUse
    const postTool = {
      session_id: 'claude-session-abc',
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      tool_use_id: 'tool_edit_42',
      tool_input: {
        file_path: 'src/main.ts',
      },
      tool_response: 'Successfully edited src/main.ts',
    };

    const finishEvents = adapter.normalize(postTool, session);
    expect(finishEvents).toHaveLength(2);

    const fileEvent = finishEvents.find((e) => e.eventType === 'file.changed');
    expect(fileEvent).toBeDefined();
    expect((fileEvent?.payload as { path: string; action: string }).path).toBe('src/main.ts');
    expect((fileEvent?.payload as { action: string }).action).toBe('MODIFIED');

    const completeEvent = finishEvents.find((e) => e.eventType === 'task.completed');
    expect(completeEvent).toBeDefined();
  });

  it('normalizes PreToolUse for Bash command with secret masking and emits log', () => {
    const session = adapter.initialize({});
    const preBash = {
      session_id: 'claude-session-abc',
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_use_id: 'tool_bash_1',
      tool_input: {
        command: 'curl -H "Authorization: Bearer my-secret-jwt-token" https://api.example.com',
      },
    };

    const events = adapter.normalize(preBash, session);
    expect(events).toHaveLength(2); // task.started + log.emitted

    const logEvent = events.find((e) => e.eventType === 'log.emitted');
    expect(logEvent).toBeDefined();
    const logMsg = (logEvent?.payload as { message: string }).message;
    expect(logMsg).toContain('Bearer [REDACTED]');
    expect(logMsg).not.toContain('my-secret-jwt-token');
  });

  it('normalizes PostToolUseFailure into task.failed and error.occurred events', () => {
    const session = adapter.initialize({});
    const failPayload = {
      session_id: 'claude-session-abc',
      hook_event_name: 'PostToolUseFailure',
      tool_name: 'Bash',
      tool_use_id: 'tool_fail_99',
      error: 'Command failed with exit code 127: command not found',
    };

    const events = adapter.normalize(failPayload, session);
    expect(events).toHaveLength(2); // task.failed + error.occurred

    const taskFail = events.find((e) => e.eventType === 'task.failed');
    expect(taskFail).toBeDefined();

    const errEvent = events.find((e) => e.eventType === 'error.occurred');
    expect(errEvent).toBeDefined();
    expect((errEvent?.payload as { message: string }).message).toContain('command not found');
  });

  it('normalizes stream-JSON lines from Claude Code --stream-json', () => {
    const session = adapter.initialize({});
    const streamEvent = {
      type: 'tool_use',
      name: 'Write',
      id: 'tool_w1',
      input: { file_path: 'docs/test.md' },
    };

    const events = adapter.normalize(streamEvent, session);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('task.started');
  });

  it('accepts JSON string representations of payloads', () => {
    const session = adapter.initialize({});
    const rawJson = JSON.stringify({
      session_id: 'claude-sess',
      hook_event_name: 'SessionStart',
      cwd: '/workspace',
    });

    const events = adapter.normalize(rawJson, session);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('session.started');
  });
});
