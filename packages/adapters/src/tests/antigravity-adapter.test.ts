import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { Readable, Writable } from 'node:stream';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
import { AntigravitySessionStore, sanitizeSessionId } from '../agents/antigravity/state-store.js';
import {
  identifyTestRunner,
  evaluateVerificationEvidence,
} from '../agents/antigravity/evidence.js';
import { AdapterParsingError } from '../errors/index.js';
import type { AoeEvent, TaskCompletedEvent, TaskUpdatedEvent } from '@zyanx04/protocol';

describe('AntigravityAdapter & Hook Bridge Suite', () => {
  let adapter: AntigravityAdapter;
  const testSessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoe-adapter-test-'));
  process.env.AOE_SESSION_DIR = testSessionDir;

  beforeEach(() => {
    adapter = new AntigravityAdapter();
  });

  afterAll(() => {
    try {
      fs.rmSync(testSessionDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
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
    const taskId = session.mapTaskId('turn_1');
    session.metadata['current_turn_task_id'] = taskId;
    session.metadata['verification_evidence'] = [
      {
        taskId,
        runner: 'vitest',
        command: 'vitest run',
        exitCode: 0,
        passed: true,
        timestamp: new Date().toISOString(),
      },
    ];

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
    delete session.metadata['verification_evidence'];

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
      hookEventName: 'SessionStart',
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
      conversationId: `conv-test-bridge-${Date.now()}`,
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
        conversationId: `conv-e2e-ipc-${Date.now()}`,
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

  // =========================================================================
  // Phase 1: Stateful Session Authority & Cross-Process Sequencing Tests
  // =========================================================================
  describe('Stateful Session Authority & Cross-Process Sequencing', () => {
    it('allocates strictly monotonic sequence numbers across discrete hook processes', () => {
      const convId = `test-seq-processes-${Date.now()}`;
      const p1Store = new AntigravitySessionStore(convId, testSessionDir);
      const p2Store = new AntigravitySessionStore(convId, testSessionDir);
      const p3Store = new AntigravitySessionStore(convId, testSessionDir);
      const p4Store = new AntigravitySessionStore(convId, testSessionDir);
      const p5Store = new AntigravitySessionStore(convId, testSessionDir);

      const s1 = adapter.initialize({}, convId);
      const e1 = adapter.normalize({ hookEventName: 'SessionStart' }, s1, undefined, p1Store);

      const s2 = adapter.initialize({}, convId);
      const e2 = adapter.normalize(
        { hookEventName: 'PreInvocation', lastUserInput: 'Implement auth controller' },
        s2,
        undefined,
        p2Store,
      );

      const s3 = adapter.initialize({}, convId);
      const e3 = adapter.normalize(
        {
          hookEventName: 'PreToolUse',
          toolCall: { name: 'run_command', args: { CommandLine: 'pnpm test' } },
          stepIdx: 1,
        },
        s3,
        undefined,
        p3Store,
      );

      const s4 = adapter.initialize({}, convId);
      const e4 = adapter.normalize(
        {
          hookEventName: 'PostToolUse',
          toolCall: { name: 'run_command', args: { CommandLine: 'pnpm test' } },
          stepIdx: 1,
        },
        s4,
        undefined,
        p4Store,
      );

      const s5 = adapter.initialize({}, convId);
      const e5 = adapter.normalize(
        {
          hookEventName: 'Stop',
          terminationReason: 'NO_TOOL_CALL',
          executionNum: 1,
        },
        s5,
        undefined,
        p5Store,
      );

      const allEvents = [...e1, ...e2, ...e3, ...e4, ...e5];
      expect(allEvents.length).toBeGreaterThanOrEqual(6);

      // Verify sequence is strictly monotonic starting at 0 with no collisions or resets
      for (let i = 0; i < allEvents.length; i++) {
        expect(allEvents[i].sequence).toBe(i);
      }
    });

    it('allocates non-overlapping monotonic sequences under concurrent hook execution', async () => {
      const convId = `test-concurrent-alloc-${Date.now()}`;
      const store = new AntigravitySessionStore(convId, testSessionDir);

      const promises = Array.from({ length: 10 }, async () => {
        await new Promise((r) => setTimeout(r, Math.random() * 10));
        return store.allocateSequencesSync(2);
      });

      const results = await Promise.all(promises);
      const allAllocated: number[] = [];
      for (const range of results) {
        expect(range).toHaveLength(2);
        allAllocated.push(...range);
      }

      expect(allAllocated).toHaveLength(20);
      allAllocated.sort((a, b) => a - b);
      for (let i = 0; i < 20; i++) {
        expect(allAllocated[i]).toBe(i);
      }
    });

    it('persists state authority and recovers seamlessly across restarts', () => {
      const convId = `test-state-restart-${Date.now()}`;
      const initialStore = new AntigravitySessionStore(convId, testSessionDir);

      initialStore.setActiveTaskIdSync('task-turn-1');
      const taskId1 = initialStore.mapTaskIdSync('turn_1');
      const seqRange = initialStore.allocateSequencesSync(3);
      expect(seqRange).toEqual([0, 1, 2]);

      // New store instance on the same session directory simulating restart
      const recoveredStore = new AntigravitySessionStore(convId, testSessionDir);
      expect(recoveredStore.getActiveTaskIdSync()).toBe('task-turn-1');
      expect(recoveredStore.mapTaskIdSync('turn_1')).toBe(taskId1);

      const nextSeq = recoveredStore.allocateSequencesSync(1);
      expect(nextSeq).toEqual([3]);
    });

    it('deduplicates identical hook event signatures safely', () => {
      const convId = `test-dedup-sig-${Date.now()}`;
      const store = new AntigravitySessionStore(convId, testSessionDir);
      const session = adapter.initialize({}, convId);

      const payload = {
        conversationId: convId,
        hookEventName: 'SessionStart',
        workspacePaths: ['/test/project'],
      };

      const first = adapter.normalize(payload, session, undefined, store);
      expect(first).toHaveLength(1);

      const duplicate = adapter.normalize(payload, session, undefined, store);
      expect(duplicate).toHaveLength(0);
    });

    it('maintains strict session isolation between conversations', () => {
      const convA = `test-iso-a-${Date.now()}`;
      const convB = `test-iso-b-${Date.now()}`;
      const storeA = new AntigravitySessionStore(convA, testSessionDir);
      const storeB = new AntigravitySessionStore(convB, testSessionDir);

      storeA.allocateSequencesSync(5);
      storeA.setActiveTaskIdSync('task-A');

      expect(storeB.getStateSync().currentSequence).toBe(-1);
      expect(storeB.getActiveTaskIdSync()).toBeUndefined();
    });

    it('Stop hook marks store as terminated and clears activeTaskId', () => {
      const convId = `test-term-${Date.now()}`;
      const store = new AntigravitySessionStore(convId, testSessionDir);
      const session = adapter.initialize({}, convId);

      adapter.normalize(
        { hookEventName: 'PreInvocation', invocationNum: 1, conversationId: convId },
        session,
        undefined,
        store,
      );
      expect(store.getActiveTaskIdSync()).toBeDefined();
      expect(store.getStateSync().isTerminated).toBe(false);

      adapter.normalize(
        { hookEventName: 'Stop', conversationId: convId, terminationReason: 'NO_TOOL_CALL' },
        session,
        undefined,
        store,
      );

      const state = store.getStateSync();
      expect(state.isTerminated).toBe(true);
      expect(state.terminationReason).toBe('NO_TOOL_CALL');
      expect(state.activeTaskId).toBeUndefined();
    });
  });

  // =========================================================================
  // Phase 2: Verification Evidence Model & Anti-False-Positive Tests
  // =========================================================================
  describe('Verification Evidence Model', () => {
    it('identifyTestRunner strictly recognizes test commands and rejects non-test utilities', () => {
      expect(identifyTestRunner('npm test').isTestRunner).toBe(true);
      expect(identifyTestRunner('npm run test').isTestRunner).toBe(true);
      expect(identifyTestRunner('pnpm test').isTestRunner).toBe(true);
      expect(identifyTestRunner('pnpm --filter @zyanx04/adapters test').isTestRunner).toBe(true);
      expect(identifyTestRunner('yarn test').isTestRunner).toBe(true);
      expect(identifyTestRunner('bun test').isTestRunner).toBe(true);
      expect(identifyTestRunner('vitest run src/tests/adapter.test.ts').runnerName).toBe('vitest');
      expect(identifyTestRunner('jest --coverage').runnerName).toBe('jest');
      expect(identifyTestRunner('pytest -v tests/').runnerName).toBe('pytest');
      expect(identifyTestRunner('cargo test --all').runnerName).toBe('cargo-test');
      expect(identifyTestRunner('go test ./...').runnerName).toBe('go-test');

      // False positive hazards - MUST return false for isTestRunner
      expect(identifyTestRunner('mkdir test').isTestRunner).toBe(false);
      expect(identifyTestRunner('mkdir -p src/test').isTestRunner).toBe(false);
      expect(identifyTestRunner('cat test.txt').isTestRunner).toBe(false);
      expect(identifyTestRunner('echo "test passed"').isTestRunner).toBe(false);
      expect(identifyTestRunner('touch test.ts').isTestRunner).toBe(false);
      expect(identifyTestRunner('git status').isTestRunner).toBe(false);
      expect(identifyTestRunner('ls -la test/').isTestRunner).toBe(false);
      expect(identifyTestRunner('rm -rf test').isTestRunner).toBe(false);
    });

    it('evaluateVerificationEvidence generates structured evidence only for valid test commands', () => {
      const validPass = evaluateVerificationEvidence('pnpm test', undefined, 'task-1');
      expect(validPass).toBeDefined();
      expect(validPass?.passed).toBe(true);
      expect(validPass?.taskId).toBe('task-1');
      expect(validPass?.runnerName).toBe('package-manager-test');

      const validFail = evaluateVerificationEvidence('pytest', 'exit code 1', 'task-1');
      expect(validFail).toBeDefined();
      expect(validFail?.passed).toBe(false);
      expect(validFail?.runnerName).toBe('pytest');

      const nonTest = evaluateVerificationEvidence('mkdir test', undefined, 'task-1');
      expect(nonTest).toBeNull();
    });

    it('PostToolUse with mkdir test produces NO verification evidence and Stop emits warning without task.completed', () => {
      const convId = `test-mkdir-hazard-${Date.now()}`;
      const store = new AntigravitySessionStore(convId, testSessionDir);
      const session = adapter.initialize({}, convId);

      // 1. PreInvocation starts turn 1
      adapter.normalize(
        { hookEventName: 'PreInvocation', invocationNum: 1, conversationId: convId },
        session,
        undefined,
        store,
      );
      const taskId = store.getActiveTaskIdSync()!;
      expect(taskId).toBeDefined();

      // 2. PostToolUse with mkdir test
      adapter.normalize(
        {
          hookEventName: 'PostToolUse',
          conversationId: convId,
          toolCall: { name: 'run_command', args: { CommandLine: 'mkdir test' } },
        },
        session,
        undefined,
        store,
      );

      expect(store.hasPassedVerificationSync(taskId)).toBe(false);
      expect(store.getStateSync().verificationEvidence).toHaveLength(0);

      // 3. Stop hook
      const stopEvents = adapter.normalize(
        {
          hookEventName: 'Stop',
          conversationId: convId,
          terminationReason: 'NO_TOOL_CALL',
          executionNum: 1,
        },
        session,
        undefined,
        store,
      );

      const completed = stopEvents.find((e) => e.eventType === 'task.completed');
      expect(completed).toBeUndefined(); // Invariant: Never fabricate completion!

      const updated = stopEvents.find((e) => e.eventType === 'task.updated') as
        TaskUpdatedEvent | undefined;
      expect(updated).toBeDefined();
      expect(updated?.payload.status).toBe('warning');
    });

    it('Stop emits task.completed ONLY when active task has passing verification evidence', () => {
      const convId = `test-pass-evidence-${Date.now()}`;
      const store = new AntigravitySessionStore(convId, testSessionDir);
      const session = adapter.initialize({}, convId);

      // 1. PreInvocation
      adapter.normalize(
        { hookEventName: 'PreInvocation', invocationNum: 1, conversationId: convId },
        session,
        undefined,
        store,
      );
      const taskId = store.getActiveTaskIdSync()!;

      // 2. Successful test execution
      adapter.normalize(
        {
          hookEventName: 'PostToolUse',
          conversationId: convId,
          toolCall: { name: 'run_command', args: { CommandLine: 'pnpm test' } },
        },
        session,
        undefined,
        store,
      );

      expect(store.hasPassedVerificationSync(taskId)).toBe(true);

      // 3. Stop
      const stopEvents = adapter.normalize(
        {
          hookEventName: 'Stop',
          conversationId: convId,
          terminationReason: 'NO_TOOL_CALL',
          executionNum: 1,
        },
        session,
        undefined,
        store,
      );

      const completed = stopEvents.find((e) => e.eventType === 'task.completed') as
        TaskCompletedEvent | undefined;
      expect(completed).toBeDefined();
      expect(completed?.payload.verified).toBe(true);
      expect(completed?.payload.taskId).toBe(taskId);
    });

    it('verification evidence is task-bound and does NOT complete subsequent tasks without new verification', () => {
      const convId = `test-evidence-isolation-${Date.now()}`;
      const store = new AntigravitySessionStore(convId, testSessionDir);
      const session = adapter.initialize({}, convId);

      // Turn 1: run tests and pass
      adapter.normalize(
        { hookEventName: 'PreInvocation', invocationNum: 1, conversationId: convId },
        session,
        undefined,
        store,
      );
      const task1 = store.getActiveTaskIdSync()!;
      adapter.normalize(
        {
          hookEventName: 'PostToolUse',
          conversationId: convId,
          toolCall: { name: 'run_command', args: { CommandLine: 'vitest run' } },
        },
        session,
        undefined,
        store,
      );
      expect(store.hasPassedVerificationSync(task1)).toBe(true);

      // Turn 2: Starts a new turn task
      adapter.normalize(
        { hookEventName: 'PreInvocation', invocationNum: 2, conversationId: convId },
        session,
        undefined,
        store,
      );
      const task2 = store.getActiveTaskIdSync()!;
      expect(task2).not.toBe(task1);

      // No tests run in Turn 2, only file write
      adapter.normalize(
        {
          hookEventName: 'PostToolUse',
          conversationId: convId,
          toolCall: { name: 'write_file', args: { Path: '/workspace/foo.ts', Content: 'code' } },
        },
        session,
        undefined,
        store,
      );

      expect(store.hasPassedVerificationSync(task2)).toBe(false);

      // Stop Turn 2
      const stopEvents = adapter.normalize(
        {
          hookEventName: 'Stop',
          conversationId: convId,
          terminationReason: 'NO_TOOL_CALL',
          executionNum: 2,
        },
        session,
        undefined,
        store,
      );

      const completed = stopEvents.find((e) => e.eventType === 'task.completed');
      expect(completed).toBeUndefined(); // Must NOT complete task2 with task1's evidence!
    });

    it('failed test run does not allow task completion on Stop', () => {
      const convId = `test-failed-test-${Date.now()}`;
      const store = new AntigravitySessionStore(convId, testSessionDir);
      const session = adapter.initialize({}, convId);

      adapter.normalize(
        { hookEventName: 'PreInvocation', invocationNum: 1, conversationId: convId },
        session,
        undefined,
        store,
      );
      const taskId = store.getActiveTaskIdSync()!;

      adapter.normalize(
        {
          hookEventName: 'PostToolUse',
          conversationId: convId,
          toolCall: { name: 'run_command', args: { CommandLine: 'pnpm test' } },
          error: 'Test suite failed with 3 errors',
        },
        session,
        undefined,
        store,
      );

      expect(store.hasPassedVerificationSync(taskId)).toBe(false);

      const stopEvents = adapter.normalize(
        {
          hookEventName: 'Stop',
          conversationId: convId,
          terminationReason: 'NO_TOOL_CALL',
          executionNum: 1,
        },
        session,
        undefined,
        store,
      );

      const completed = stopEvents.find((e) => e.eventType === 'task.completed');
      expect(completed).toBeUndefined();
    });
  });

  // =========================================================================
  // Phase 3: Explicit Hook Event Identification Tests
  // =========================================================================
  describe('Explicit Hook Event Identification & Parsing Safety', () => {
    it('PostToolUse without error is not misclassified as PreToolUse', () => {
      const session = adapter.initialize({});
      const events = adapter.normalize(
        {
          hookEventName: 'PostToolUse',
          toolCall: { name: 'read_file', args: { Path: '/test.ts' } },
        },
        session,
      );

      const progress = events.find((e) => e.eventType === 'progress.updated');
      expect(progress).toBeDefined();
      expect((progress?.payload as { currentWork: string }).currentWork).toContain(
        'read_file finished',
      );
    });

    it('throws AdapterParsingError when hook event name is omitted or unknown', () => {
      const session = adapter.initialize({});
      expect(() => {
        adapter.normalize({ conversationId: 'c1' }, session);
      }).toThrow(AdapterParsingError);

      expect(() => {
        adapter.normalize({ hookEventName: 'NonExistentHookEvent' }, session);
      }).toThrow(AdapterParsingError);
    });
  });

  // =========================================================================
  // Phase 4: POSIX Socket Portability & Security Hardening
  // =========================================================================
  describe('POSIX Socket Portability & Security Hardening', () => {
    it('sanitizeSessionId safely handles empty, whitespace, and path traversal strings', () => {
      expect(sanitizeSessionId('')).toBe('default');
      expect(sanitizeSessionId('   ')).toBe('default');
      expect(sanitizeSessionId(undefined)).toBe('default');
      expect(sanitizeSessionId('../../../../etc/passwd')).toBe('____________etc_passwd');
      expect(sanitizeSessionId('my-session-123')).toBe('my-session-123');
    });

    it('resolveSocketPath stays strictly under 96 bytes even with long session IDs', () => {
      const longId = 'a'.repeat(128);
      const sockPath = resolveSocketPath(longId);
      const byteLen = Buffer.byteLength(sockPath, 'utf-8');
      expect(byteLen).toBeLessThanOrEqual(96);
      expect(sockPath).toContain('aoe-');
      expect(sockPath.endsWith('.sock')).toBe(true);
    });

    it('enforces 0o600 permissions on persistent state and lock files on POSIX', () => {
      if (process.platform === 'win32') {
        return; // POSIX file permissions test
      }
      const convId = `test-perms-${Date.now()}`;
      const store = new AntigravitySessionStore(convId, testSessionDir);
      store.allocateSequencesSync(1);

      expect(fs.existsSync(store.statePath)).toBe(true);
      const stateStat = fs.statSync(store.statePath);
      // Mask mode with 0o777 to get permission bits
      const mode = stateStat.mode & 0o777;
      expect(mode).toBe(0o600);
      store.clean();
    });
  });

  // =========================================================================
  // Phase 5: Hook Bridge Diagnostics & Stream Drainage Tests
  // =========================================================================
  describe('Hook Bridge Robustness & Stream Drainage', () => {
    it('runHookBridge handles malformed stdin gracefully without throwing', async () => {
      const mockStdin = Readable.from(['{ corrupt json ']);
      let mockStdout = '';
      let mockStderr = '';

      const mockStdoutStream = new Writable({
        write(chunk, _encoding, callback) {
          mockStdout += chunk.toString();
          callback();
        },
      });
      const mockStderrStream = new Writable({
        write(chunk, _encoding, callback) {
          mockStderr += chunk.toString();
          callback();
        },
      });

      const result = await runHookBridge({
        event: 'PreToolUse',
        stdinStream: mockStdin,
        stdoutStream: mockStdoutStream,
        stderrStream: mockStderrStream,
        timeoutMs: 300,
      });

      expect(result.success).toBe(false);
      expect(mockStderr).toContain('[aoe-bridge]');
      const response = JSON.parse(mockStdout.trim());
      expect(response).toEqual({ decision: 'allow' });
    });
  });
});
