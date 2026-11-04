import { describe, it, expect } from 'vitest';
import { EventStore } from '../index.js';
import { createEvent } from '@zyanx04/protocol';

describe('EventStore', () => {
  it('stores and retrieves events by eventId and session query', () => {
    const store = new EventStore(100);
    const event1 = createEvent('session.started', {
      sessionId: 'sess_store',
      sequence: 0,
      payload: { agent: { name: 'claude' }, workingDirectory: '/dir' },
    });
    const event2 = createEvent('task.started', {
      sessionId: 'sess_store',
      sequence: 1,
      payload: { taskId: 't1', taskName: 'Task 1' },
    });

    store.commit(event1);
    store.commit(event2);

    expect(store.getById(event1.eventId)).toEqual(event1);
    expect(store.getSessionEventCount('sess_store')).toBe(2);

    const taskEvents = store.query('sess_store', { taskId: 't1' });
    expect(taskEvents.length).toBe(1);
    expect(taskEvents[0].eventType).toBe('task.started');
  });

  it('applies FIFO eviction when exceeding maxEventsPerSession limit', () => {
    const store = new EventStore(2); // Max 2 events per session
    const e1 = createEvent('log.emitted', {
      sessionId: 'sess_fifo',
      sequence: 0,
      payload: { level: 'info', message: 'First' },
    });
    const e2 = createEvent('log.emitted', {
      sessionId: 'sess_fifo',
      sequence: 1,
      payload: { level: 'info', message: 'Second' },
    });
    const e3 = createEvent('log.emitted', {
      sessionId: 'sess_fifo',
      sequence: 2,
      payload: { level: 'info', message: 'Third' },
    });

    store.commit(e1);
    store.commit(e2);
    expect(store.getSessionEventCount('sess_fifo')).toBe(2);

    // Commit 3rd event: e1 should be evicted from the store
    store.commit(e3);
    expect(store.getSessionEventCount('sess_fifo')).toBe(2);
    expect(store.getById(e1.eventId)).toBeUndefined();
    expect(store.getById(e2.eventId)).toBeDefined();
    expect(store.getById(e3.eventId)).toBeDefined();
  });
});
