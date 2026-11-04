import { describe, it, expect } from 'vitest';
import { Engine, TerminalSessionError } from '../index.js';
import { createEvent } from '@zyanx04/protocol';

describe('Engine Session Management', () => {
  it('manages multiple independent concurrent sessions', () => {
    const engine = new Engine();

    const start1 = createEvent('session.started', {
      sessionId: 'sess_1',
      sequence: 0,
      payload: { agent: { name: 'claude' }, workingDirectory: '/dir1' },
    });
    const start2 = createEvent('session.started', {
      sessionId: 'sess_2',
      sequence: 0,
      payload: { agent: { name: 'codex' }, workingDirectory: '/dir2' },
    });

    const res1 = engine.processEvent(start1);
    const res2 = engine.processEvent(start2);

    expect(res1.status).toBe('accepted');
    expect(res2.status).toBe('accepted');

    const snap1 = engine.getSessionSnapshot('sess_1');
    const snap2 = engine.getSessionSnapshot('sess_2');

    expect(snap1?.agent.name).toBe('claude');
    expect(snap2?.agent.name).toBe('codex');
    expect(engine.listSessions().length).toBe(2);
  });

  it('transitions session from active to completed', () => {
    const engine = new Engine();
    engine.processEvent(
      createEvent('session.started', {
        sessionId: 'sess_test',
        sequence: 0,
        payload: { agent: { name: 'claude' }, workingDirectory: '/dir' },
      }),
    );

    const endEvent = createEvent('session.ended', {
      sessionId: 'sess_test',
      sequence: 1,
      payload: { status: 'completed', durationMs: 500 },
    });

    const res = engine.processEvent(endEvent);
    expect(res.status).toBe('accepted');

    const snap = engine.getSessionSnapshot('sess_test');
    expect(snap?.status).toBe('completed');
    expect(snap?.durationMs).toBe(500);
  });

  it('rejects events submitted after session reaches terminal status', () => {
    const engine = new Engine();
    engine.processEvent(
      createEvent('session.started', {
        sessionId: 'sess_terminal',
        sequence: 0,
        payload: { agent: { name: 'claude' }, workingDirectory: '/dir' },
      }),
    );
    engine.processEvent(
      createEvent('session.ended', {
        sessionId: 'sess_terminal',
        sequence: 1,
        payload: { status: 'completed' },
      }),
    );

    const postEndEvent = createEvent('log.emitted', {
      sessionId: 'sess_terminal',
      sequence: 2,
      payload: { level: 'info', message: 'Aftermath' },
    });

    const res = engine.processEvent(postEndEvent);
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(res.error).toBeInstanceOf(TerminalSessionError);
    }
  });
});
