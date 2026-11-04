import { describe, it, expect } from 'vitest';
import { Engine, BufferOverflowError } from '../index.js';
import { createEvent } from '@zyanx04/protocol';

describe('Sequence Integrity & Out-of-Order Recovery', () => {
  it('accepts contiguous sequential events', () => {
    const engine = new Engine();
    engine.processEvent(
      createEvent('session.started', {
        sessionId: 'sess_seq',
        sequence: 0,
        payload: { agent: { name: 'claude' }, workingDirectory: '/dir' },
      }),
    );

    const res1 = engine.processEvent(
      createEvent('task.started', {
        sessionId: 'sess_seq',
        sequence: 1,
        payload: { taskId: 't1', taskName: 'Task 1' },
      }),
    );
    const res2 = engine.processEvent(
      createEvent('task.completed', {
        sessionId: 'sess_seq',
        sequence: 2,
        payload: { taskId: 't1', resultSummary: 'Done', verified: true },
      }),
    );

    expect(res1.status).toBe('accepted');
    expect(res2.status).toBe('accepted');
    expect(engine.getSessionSnapshot('sess_seq')?.lastSequence).toBe(2);
  });

  it('buffers out-of-order events and automatically flushes when gap closes', () => {
    const engine = new Engine();
    engine.processEvent(
      createEvent('session.started', {
        sessionId: 'sess_gap',
        sequence: 0,
        payload: { agent: { name: 'claude' }, workingDirectory: '/dir' },
      }),
    );

    // Skip sequence 1 and send sequence 2
    const event2 = createEvent('task.started', {
      sessionId: 'sess_gap',
      sequence: 2,
      payload: { taskId: 't2', taskName: 'Task 2' },
    });
    const res2 = engine.processEvent(event2);

    expect(res2.status).toBe('buffered');
    if (res2.status === 'buffered') {
      expect(res2.expectedSequence).toBe(1);
    }

    // Task 2 should not yet be in active tasks because it is buffered
    expect(engine.getSessionSnapshot('sess_gap')?.tasks.get('t2')).toBeUndefined();

    // Now send the missing sequence 1
    const event1 = createEvent('task.started', {
      sessionId: 'sess_gap',
      sequence: 1,
      payload: { taskId: 't1', taskName: 'Task 1' },
    });
    const res1 = engine.processEvent(event1);

    expect(res1.status).toBe('accepted');

    // Both task 1 and task 2 should now be in state because buffer was drained!
    const snap = engine.getSessionSnapshot('sess_gap');
    expect(snap?.tasks.get('t1')).toBeDefined();
    expect(snap?.tasks.get('t2')).toBeDefined();
    expect(snap?.lastSequence).toBe(2);
  });

  it('enforces maximum buffer capacity limit', () => {
    const engine = new Engine({ maxBufferSize: 2 });
    engine.processEvent(
      createEvent('session.started', {
        sessionId: 'sess_overflow',
        sequence: 0,
        payload: { agent: { name: 'claude' }, workingDirectory: '/dir' },
      }),
    );

    // Buffer 2 out-of-order events (sequences 2 and 3)
    engine.processEvent(
      createEvent('log.emitted', {
        sessionId: 'sess_overflow',
        sequence: 2,
        payload: { level: 'info', message: 'Log 2' },
      }),
    );
    engine.processEvent(
      createEvent('log.emitted', {
        sessionId: 'sess_overflow',
        sequence: 3,
        payload: { level: 'info', message: 'Log 3' },
      }),
    );

    // Attempting to buffer a 3rd should throw/reject with BufferOverflowError
    const res = engine.processEvent(
      createEvent('log.emitted', {
        sessionId: 'sess_overflow',
        sequence: 4,
        payload: { level: 'info', message: 'Log 4' },
      }),
    );

    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(res.error).toBeInstanceOf(BufferOverflowError);
    }
  });
});
