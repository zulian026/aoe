import { describe, it, expect, vi } from 'vitest';
import {
  AdapterManager,
  createDefaultAdapterManager,
  DuplicateAdapterError,
  AdapterNotFoundError,
  AdapterSessionError,
  type AgentAdapter,
  type AdapterContext,
  type AdapterSession,
} from '../index.js';
import { createAdapterSession } from '../contracts/session.js';

describe('AdapterManager', () => {
  const createMockAdapter = (id: string): AgentAdapter => ({
    id,
    name: `Mock Adapter ${id}`,
    version: '1.0.0',
    supportedCategories: ['session', 'task'],
    detect: (context: AdapterContext) => ({
      detected: context.metadata?.mockDetected === true,
      confidence: 'high',
      agentName: id,
    }),
    initialize: (context: AdapterContext, sessionId?: string) =>
      createAdapterSession({
        sessionId,
        adapterId: id,
        agentName: id,
        workingDirectory: context.workingDirectory,
      }),
    normalize: (_input: unknown, session: AdapterSession) => [
      {
        protocolVersion: '1.0.0',
        eventId: `evt_${Date.now()}`,
        sessionId: session.id,
        sequence: session.nextSequence(),
        timestamp: new Date().toISOString(),
        eventType: 'log.emitted',
        payload: {
          level: 'info',
          message: 'Normalized mock event',
        },
      },
    ],
    dispose: vi.fn(),
  });

  it('registers and retrieves adapters', () => {
    const manager = new AdapterManager();
    const adapter = createMockAdapter('test-1');

    manager.register(adapter);
    expect(manager.has('test-1')).toBe(true);
    expect(manager.get('test-1')).toBe(adapter);
    expect(manager.list()).toHaveLength(1);
  });

  it('rejects duplicate adapter IDs unless replace=true', () => {
    const manager = new AdapterManager();
    manager.register(createMockAdapter('dup'));

    expect(() => {
      manager.register(createMockAdapter('dup'));
    }).toThrow(DuplicateAdapterError);

    // Overwriting with replace=true
    expect(() => {
      manager.register(createMockAdapter('dup'), { replace: true });
    }).not.toThrow();
  });

  it('unregisters adapters properly', () => {
    const manager = new AdapterManager();
    manager.register(createMockAdapter('temp'));
    expect(manager.has('temp')).toBe(true);

    const deleted = manager.unregister('temp');
    expect(deleted).toBe(true);
    expect(manager.has('temp')).toBe(false);
  });

  it('throws AdapterNotFoundError when creating session for unregistered adapter', async () => {
    const manager = new AdapterManager();
    await expect(manager.createSession('nonexistent', {})).rejects.toThrow(AdapterNotFoundError);
  });

  it('evaluates detection across registered adapters', async () => {
    const manager = new AdapterManager();
    manager.register(createMockAdapter('mock-a'));
    manager.register(createMockAdapter('mock-b'));

    const detected = await manager.detect({ metadata: { mockDetected: true } });
    expect(detected).toHaveLength(2);
    expect(detected[0].result.detected).toBe(true);
    expect(detected[1].result.detected).toBe(true);
  });

  it('manages independent sessions and event dispatching', async () => {
    const manager = new AdapterManager();
    manager.register(createMockAdapter('agent-1'));
    manager.register(createMockAdapter('agent-2'));

    const session1 = await manager.createSession('agent-1', {}, 'sess-1');
    const session2 = await manager.createSession('agent-2', {}, 'sess-2');

    expect(manager.listSessions()).toHaveLength(2);
    expect(session1.id).toBe('sess-1');
    expect(session2.id).toBe('sess-2');

    const dispatched: string[] = [];
    const unsubscribe = manager.onEvent((event) => {
      dispatched.push(event.sessionId);
    });

    const events1 = await manager.ingest('sess-1', 'chunk1');
    const events2 = await manager.ingest('sess-2', 'chunk2');

    expect(events1).toHaveLength(1);
    expect(events2).toHaveLength(1);
    expect(dispatched).toEqual(['sess-1', 'sess-2']);

    unsubscribe();
  });

  it('isolates adapter failure and preserves other active sessions', async () => {
    const manager = new AdapterManager();
    const failingAdapter = createMockAdapter('failing');
    failingAdapter.normalize = () => {
      throw new Error('Adapter crashed');
    };

    manager.register(failingAdapter);
    manager.register(createMockAdapter('healthy'));

    const failSession = await manager.createSession('failing', {});
    const healthySession = await manager.createSession('healthy', {});

    await expect(manager.ingest(failSession.id, 'bad input')).rejects.toThrow('Adapter crashed');

    // Healthy session continues working unaffected
    const healthyEvents = await manager.ingest(healthySession.id, 'good input');
    expect(healthyEvents).toHaveLength(1);
  });

  it('rejects ingestion into non-existent or disposed sessions', async () => {
    const manager = new AdapterManager();
    manager.register(createMockAdapter('agent'));

    const session = await manager.createSession('agent', {});
    await manager.disposeSession(session.id);

    await expect(manager.ingest(session.id, 'data')).rejects.toThrow(AdapterSessionError);
    await expect(manager.ingest('ghost-session', 'data')).rejects.toThrow(AdapterSessionError);
  });

  it('ends session with session.ended event and completes lifecycle', async () => {
    const manager = new AdapterManager();
    manager.register(createMockAdapter('agent'));

    const session = await manager.createSession('agent', {});
    const endEvent = await manager.endSession(session.id, 'Task completed');

    expect(endEvent).not.toBeNull();
    expect(endEvent?.eventType).toBe('session.ended');
    expect(session.status).toBe('completed');

    // Subsequent end calls return null
    const secondEnd = await manager.endSession(session.id);
    expect(secondEnd).toBeNull();
  });

  it('disposes all sessions and adapters idempotently', async () => {
    const manager = new AdapterManager();
    const adapter = createMockAdapter('agent');
    manager.register(adapter);

    const session = await manager.createSession('agent', {});
    expect(manager.listSessions()).toHaveLength(1);

    await manager.dispose();

    expect(manager.listSessions()).toHaveLength(0);
    expect(session.status).toBe('disposed');
    expect(adapter.dispose).toHaveBeenCalledTimes(1);
  });

  it('createDefaultAdapterManager pre-registers jsonl, claude-code, and gemini-cli', () => {
    const defaultMgr = createDefaultAdapterManager();
    expect(defaultMgr.has('jsonl')).toBe(true);
    expect(defaultMgr.has('claude-code')).toBe(true);
    expect(defaultMgr.has('gemini-cli')).toBe(true);
    expect(defaultMgr.list().length).toBeGreaterThanOrEqual(3);
  });
});
