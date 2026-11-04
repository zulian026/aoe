import { describe, it, expect } from 'vitest';
import { Engine } from '../index.js';
import { createEvent } from '@zyanx04/protocol';

describe('Event Processing Atomicity', () => {
  it('guarantees that rejected events leave zero partial mutations', () => {
    const engine = new Engine();
    engine.processEvent(
      createEvent('session.started', {
        sessionId: 'sess_atomic',
        sequence: 0,
        payload: { agent: { name: 'claude' }, workingDirectory: '/dir' },
      }),
    );
    engine.processEvent(
      createEvent('task.started', {
        sessionId: 'sess_atomic',
        sequence: 1,
        payload: { taskId: 't1', taskName: 'Task 1' },
      }),
    );

    const initialSnapshot = engine.getSessionSnapshot('sess_atomic');
    expect(initialSnapshot?.lastSequence).toBe(1);
    expect(initialSnapshot?.totalEvents).toBe(2);

    // Attempt to process an invalid event: missing parent task
    const invalidEvent = createEvent('task.started', {
      sessionId: 'sess_atomic',
      sequence: 2,
      payload: { taskId: 't2', taskName: 'Task 2', parentTaskId: 'ghost_parent' },
    });

    const result = engine.processEvent(invalidEvent);
    expect(result.status).toBe('rejected');

    // Verify atomic state preservation:
    const postRejectionSnapshot = engine.getSessionSnapshot('sess_atomic');
    // Sequence must not have advanced
    expect(postRejectionSnapshot?.lastSequence).toBe(1);
    // Total events must remain 2
    expect(postRejectionSnapshot?.totalEvents).toBe(2);
    // Task 2 must not exist in state
    expect(postRejectionSnapshot?.tasks.get('t2')).toBeUndefined();
    // Event store must not have committed the invalid event
    expect(engine.getEvents('sess_atomic').length).toBe(2);
  });
});
