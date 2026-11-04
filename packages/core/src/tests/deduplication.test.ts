import { describe, it, expect } from 'vitest';
import { Engine, ConflictingEventIdError } from '../index.js';
import { createEvent } from '@zyanx04/protocol';

describe('Event Deduplication', () => {
  it('idempotently handles identical duplicate event', () => {
    const engine = new Engine();
    const event = createEvent('session.started', {
      sessionId: 'sess_dedup',
      sequence: 0,
      payload: { agent: { name: 'claude' }, workingDirectory: '/dir' },
    });

    const res1 = engine.processEvent(event);
    const res2 = engine.processEvent(event);

    expect(res1.status).toBe('accepted');
    expect(res2.status).toBe('duplicate');
    expect(engine.getSessionSnapshot('sess_dedup')?.totalEvents).toBe(1);
  });

  it('rejects conflicting event ID with different payload', () => {
    const engine = new Engine();
    const event1 = createEvent('session.started', {
      eventId: 'evt_fixed_id',
      sessionId: 'sess_conflict',
      sequence: 0,
      payload: { agent: { name: 'claude' }, workingDirectory: '/dir1' },
    });
    const event2 = createEvent('session.started', {
      eventId: 'evt_fixed_id', // Reused ID
      sessionId: 'sess_conflict',
      sequence: 0,
      payload: { agent: { name: 'codex' }, workingDirectory: '/dir2' }, // Conflicting content
    });

    engine.processEvent(event1);
    const res2 = engine.processEvent(event2);

    expect(res2.status).toBe('rejected');
    if (res2.status === 'rejected') {
      expect(res2.error).toBeInstanceOf(ConflictingEventIdError);
    }
  });

  it('scopes deduplication store to session identity', () => {
    const engine = new Engine();
    const event1 = createEvent('session.started', {
      eventId: 'evt_shared_id',
      sessionId: 'sess_A',
      sequence: 0,
      payload: { agent: { name: 'claude' }, workingDirectory: '/dir' },
    });
    const event2 = createEvent('session.started', {
      eventId: 'evt_shared_id', // Same eventId, different session
      sessionId: 'sess_B',
      sequence: 0,
      payload: { agent: { name: 'claude' }, workingDirectory: '/dir' },
    });

    const res1 = engine.processEvent(event1);
    const res2 = engine.processEvent(event2);

    expect(res1.status).toBe('accepted');
    expect(res2.status).toBe('accepted');
  });
});
