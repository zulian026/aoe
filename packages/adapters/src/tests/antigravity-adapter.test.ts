import { describe, it, expect, beforeEach } from 'vitest';
import { Readable, Writable } from 'node:stream';
import { AntigravityAdapter } from '../agents/antigravity/adapter.js';
import {
  runHookBridge,
  getAntigravityResponseForEvent,
} from '../agents/antigravity/hook-bridge.js';
import {
  createIpcServer,
  UnixSocketIpcClient,
  resolveSocketPath,
} from '../agents/antigravity/ipc-transport.js';
import { AdapterParsingError } from '../errors/index.js';
import type { AoeEvent } from '@zyanx04/protocol';

describe('AntigravityAdapter & Hook Bridge Suite', () => {
  let adapter: AntigravityAdapter;

  beforeEach(() => {
    adapter = new AntigravityAdapter();
  });

  // 1. SessionStart normalization
  it('normalizes SessionStart into session.started with correct metadata and sequence', () => {
    const session = adapter.initialize({}, 'sess-ag-1');
    const payload = {
      conversationId: 'conv-uuid-1234',
      workspacePaths: ['/home/user/project'],
      transcriptPath: '/home/user/project/.gemini/transcript.jsonl',
      artifactDirectoryPath: '/home/user/project/.gemini/artifacts',
      modelName: 'gemini-3.8-flash',
      hookEventName: 'SessionStart',
    };

    const events = adapter.normalize(payload, session);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('session.started');
    expect(events[0].sessionId).toBe('sess-ag-1');
    expect(events[0].sequence).toBe(0);

    const data = events[0].payload as {
      agent: { name: string; version?: string };
      workingDirectory: string;
      metadata?: Record<string, unknown>;
    };
    expect(data.agent.name).toBe('antigravity');
    expect(data.agent.version).toBe('gemini-3.8-flash');
    expect(data.workingDirectory).toBe('/home/user/project');
    expect(data.metadata?.conversationId).toBe('conv-uuid-1234');
    expect(data.metadata?.transcriptPath).toBe('/home/user/project/.gemini/transcript.jsonl');
  });

  // 2. PreInvocation normalization
  it('normalizes PreInvocation into task.started with sanitized task name', () => {
    const session = adapter.initialize({});
    const payload = {
      conversationId: 'conv-uuid-1234',
      invocationNum: 1,
      lastUserInput: 'Please refactor the authentication controller',
      hookEventName: 'PreInvocation',
    };

    const events = adapter.normalize(payload, session);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('task.started');
    const data = events[0].payload as { taskId: string; taskName: string };
    expect(data.taskName).toBe('Please refactor the authentication controller');
    expect(data.taskId).toContain('turn_1');
  });

  // 3. PreToolUse normalization
  it('normalizes PreToolUse into progress estimate and log without premature completion', () => {
    const session = adapter.initialize({});
    session.metadata['current_turn_task_id'] = 'task_turn_1';

    const payload = {
      toolCall: {
        name: 'run_command',
        args: { CommandLine: 'pnpm test' },
      },
      stepIdx: 12,
      hookEventName: 'PreToolUse',
    };

    const events = adapter.normalize(payload, session);
    expect(events.length).toBeGreaterThanOrEqual(1);

    const logEvent = events.find((e) => e.eventType === 'log.emitted');
    expect(logEvent).toBeDefined();
    expect((logEvent?.payload as { message: string }).message).toContain('$ pnpm test');

    const progressEvent = events.find((e) => e.eventType === 'progress.updated');
    expect(progressEvent).toBeDefined();
    expect((progressEvent?.payload as { isEstimate: boolean }).isEstimate).toBe(true);
    expect((progressEvent?.payload as { completedWork: number }).completedWork).toBe(0);
  });

  // 4. PostToolUse success and failure
  it('normalizes PostToolUse with error into diagnostic.emitted and log.emitted', () => {
    const session = adapter.initialize({});
    const payload = {
      toolCall: {
        name: 'run_command',
        args: { CommandLine: 'build-pkg' },
      },
      error: 'exit code 1: command not found',
      stepIdx: 14,
      hookEventName: 'PostToolUse',
    };

    const events = adapter.normalize(payload, session);
    const diag = events.find((e) => e.eventType === 'diagnostic.emitted');
    expect(diag).toBeDefined();
    expect((diag?.payload as { severity: string }).severity).toBe('error');
    expect((diag?.payload as { message: string }).message).toContain('command not found');

    const log = events.find((e) => e.eventType === 'log.emitted');
    expect(log).toBeDefined();
    expect((log?.payload as { level: string }).level).toBe('error');
  });

  // 5. File modification events
  it('emits file.changed with CREATED or MODIFIED on successful write_file and edit_file', () => {
    const session = adapter.initialize({});

    // write_file (new)
    const writePayload = {
      toolCall: {
        name: 'write_file',
        args: { Path: '/workspace/src/new-service.ts', Content: 'code' },
      },
      stepIdx: 20,
      hookEventName: 'PostToolUse',
    };
    const writeEvents = adapter.normalize(writePayload, session);
    const fileCreated = writeEvents.find((e) => e.eventType === 'file.changed');
    expect(fileCreated).toBeDefined();
    expect((fileCreated?.payload as { action: string }).action).toBe('CREATED');
    expect((fileCreated?.payload as { path: string }).path).toBe('/workspace/src/new-service.ts');

    // edit_file
    const editPayload = {
      toolCall: {
        name: 'edit_file',
        args: { Path: '/workspace/src/new-service.ts', Replacement: 'new code' },
      },
      stepIdx: 21,
      hookEventName: 'PostToolUse',
    };
    const editEvents = adapter.normalize(editPayload, session);
    const fileModified = editEvents.find((e) => e.eventType === 'file.changed');
    expect(fileModified).toBeDefined();
    expect((fileModified?.payload as { action: string }).action).toBe('MODIFIED');
  });

  // 6. Stop with successful verified outcome
  it('normalizes Stop with verified outcome into task.completed (verified: true) and session.ended', () => {
    const session = adapter.initialize({});
    session.metadata['tests_verified'] = true;

    const payload = {
      executionNum: 1,
      terminationReason: 'NO_TOOL_CALL',
      hookEventName: 'Stop',
    };

    const events = adapter.normalize(payload, session);
    const taskCompleted = events.find((e) => e.eventType === 'task.completed');
    expect(taskCompleted).toBeDefined();
    expect((taskCompleted?.payload as { verified: boolean }).verified).toBe(true);

    const sessionEnded = events.find((e) => e.eventType === 'session.ended');
    expect(sessionEnded).toBeDefined();
    expect((sessionEnded?.payload as { status: string }).status).toBe('completed');
  });

  // 7. Stop with error
  it('normalizes Stop with ERROR into task.failed and session.ended with failed status', () => {
    const session = adapter.initialize({});
    const payload = {
      executionNum: 1,
      terminationReason: 'ERROR',
      error: 'Uncaught exception during execution',
      hookEventName: 'Stop',
    };

    const events = adapter.normalize(payload, session);
    const taskFailed = events.find((e) => e.eventType === 'task.failed');
    expect(taskFailed).toBeDefined();
    expect((taskFailed?.payload as { error: { message: string } }).error.message).toContain(
      'Uncaught exception',
    );

    const sessionEnded = events.find((e) => e.eventType === 'session.ended');
    expect(sessionEnded).toBeDefined();
    expect((sessionEnded?.payload as { status: string }).status).toBe('failed');
  });

  // 8. Stop without sufficient completion evidence
  it('does NOT emit task.completed when Stop has NO_TOOL_CALL but lacks verification evidence', () => {
    const session = adapter.initialize({});
    delete session.metadata['tests_verified'];

    const payload = {
      executionNum: 1,
      terminationReason: 'NO_TOOL_CALL',
      hookEventName: 'Stop',
    };

    const events = adapter.normalize(payload, session);
    const taskCompleted = events.find((e) => e.eventType === 'task.completed');
    expect(taskCompleted).toBeUndefined(); // Invariant: Never fabricate completion!

    const taskUpdated = events.find((e) => e.eventType === 'task.updated');
    expect(taskUpdated).toBeDefined();
    expect((taskUpdated?.payload as { status: string }).status).toBe('warning');

    const sessionEnded = events.find((e) => e.eventType === 'session.ended');
    expect(sessionEnded).toBeDefined();
    expect((sessionEnded?.payload as { status: string }).status).toBe('completed');
  });

  // 9. Missing optional fields
  it('handles missing or sparse optional fields gracefully', () => {
    const session = adapter.initialize({});
    const sparsePayload = {
      conversationId: 'minimal-id',
    };

    const events = adapter.normalize(sparsePayload, session);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].eventType).toBe('session.started');
  });

  // 10. Malformed JSON
  it('throws AdapterParsingError when payload string is malformed JSON', () => {
    const session = adapter.initialize({});
    expect(() => {
      adapter.normalize('{ invalid json here', session);
    }).toThrow(AdapterParsingError);
  });

  // 11. Invalid hook payload
  it('returns empty array when payload is not an object', () => {
    const session = adapter.initialize({});
    expect(adapter.normalize(null, session)).toEqual([]);
    expect(adapter.normalize(12345, session)).toEqual([]);
  });

  // 12. Sensitive-data sanitization
  it('sanitizes API keys, secrets, and private reasoning tags', () => {
    const session = adapter.initialize({});
    const payload = {
      conversationId: 'conv-safe',
      invocationNum: 2,
      lastUserInput:
        '<thought>internal secret thinking</thought> Fix API with sk-abcdef12345678901234567890',
      hookEventName: 'PreInvocation',
    };

    const events = adapter.normalize(payload, session);
    expect(events).toHaveLength(1);
    const taskName = (events[0].payload as { taskName: string }).taskName;
    expect(taskName).not.toContain('internal secret thinking');
    expect(taskName).not.toContain('sk-abcdef12345678901234567890');
    expect(taskName).toContain('sk-[REDACTED]');
  });

  // 13. Sequence ordering
  it('maintains strictly increasing sequence numbers across multiple normalized events', () => {
    const session = adapter.initialize({}, 'sess-seq-1');

    const e1 = adapter.normalize({ hookEventName: 'SessionStart' }, session);
    const e2 = adapter.normalize(
      { hookEventName: 'PreInvocation', lastUserInput: 'Work' },
      session,
    );
    const e3 = adapter.normalize(
      { hookEventName: 'PreToolUse', toolCall: { name: 'read_file' } },
      session,
    );

    const allEvents = [...e1, ...e2, ...e3];
    expect(allEvents.length).toBeGreaterThanOrEqual(3);

    for (let i = 1; i < allEvents.length; i++) {
      expect(allEvents[i].sequence).toBe(allEvents[i - 1].sequence + 1);
    }
  });

  // 14. Duplicate event handling
  it('preserves task identifier mapping across related events in the session', () => {
    const session = adapter.initialize({});
    const id1 = session.mapTaskId('turn_1');
    const id2 = session.mapTaskId('turn_1');
    expect(id1).toBe(id2);
  });

  // 15. IPC consumer unavailable
  it('handles IPC consumer unavailability gracefully without throwing or blocking', async () => {
    const deadSocketPath = resolveSocketPath('non_existent_session_999999');
    const client = new UnixSocketIpcClient(deadSocketPath, 50);

    const events = adapter.normalize({ hookEventName: 'SessionStart' }, adapter.initialize({}));
    const sent = await client.send(events);
    expect(sent).toBe(false); // Graceful fallback
  });

  // 16. Hook response latency and timeout behavior
  it('runHookBridge processes input and returns valid Antigravity JSON on stdout', async () => {
    const stdinData = JSON.stringify({
      conversationId: 'conv-test-bridge',
      toolCall: { name: 'run_command', args: { CommandLine: 'ls' } },
      stepIdx: 1,
    });

    const mockStdin = Readable.from([stdinData]);
    let mockStdout = '';
    const mockStdoutStream = new Writable({
      write(chunk, _encoding, callback) {
        mockStdout += chunk.toString();
        callback();
      },
    });

    const result = await runHookBridge({
      event: 'PreToolUse',
      stdinStream: mockStdin,
      stdoutStream: mockStdoutStream,
      timeoutMs: 300,
    });

    expect(result.success).toBe(true);
    expect(result.event).toBe('PreToolUse');
    expect(result.durationMs).toBeLessThan(500);

    const response = JSON.parse(mockStdout.trim());
    expect(response).toEqual({ decision: 'allow' });
  });

  it('verifies canonical Antigravity response mapping for all hook events', () => {
    expect(getAntigravityResponseForEvent('PreToolUse')).toEqual({ decision: 'allow' });
    expect(getAntigravityResponseForEvent('PostToolUse')).toEqual({});
    expect(getAntigravityResponseForEvent('SessionStart')).toEqual({ injectSteps: [] });
    expect(getAntigravityResponseForEvent('PreInvocation')).toEqual({
      injectSteps: [],
      terminationBehavior: '',
    });
    expect(getAntigravityResponseForEvent('Stop')).toEqual({ decision: '' });
  });

  // End-to-end IPC Socket Fixture
  it('streams normalized events over Unix domain socket to an active IPC receiver', async () => {
    const socketPath = resolveSocketPath(`test_ipc_${Date.now()}`);
    const receivedEvents: AoeEvent[] = [];

    const server = await createIpcServer(socketPath, (event) => {
      receivedEvents.push(event);
    });

    try {
      const stdinData = JSON.stringify({
        conversationId: 'conv-e2e-ipc',
        hookEventName: 'SessionStart',
        workspacePaths: ['/tmp/test-project'],
      });

      const mockStdin = Readable.from([stdinData]);
      const mockStdoutStream = new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
      });

      const result = await runHookBridge({
        event: 'SessionStart',
        socketPath,
        stdinStream: mockStdin,
        stdoutStream: mockStdoutStream,
        timeoutMs: 300,
      });

      expect(result.success).toBe(true);
      expect(result.forwarded).toBe(true);

      // Wait a moment for server socket to receive data
      await new Promise((r) => setTimeout(r, 100));

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].eventType).toBe('session.started');
      expect((receivedEvents[0].payload as { workingDirectory: string }).workingDirectory).toBe(
        '/tmp/test-project',
      );
    } finally {
      await server.close();
    }
  });
});
