import { describe, it, expect, beforeEach } from 'vitest';
import { SidecarEventSequencer } from '../sidecar/event-sequencer.js';
import { createEvent } from '@zyanx04/protocol';

describe('SidecarEventSequencer', () => {
  let sequencer: SidecarEventSequencer;

  beforeEach(() => {
    sequencer = new SidecarEventSequencer();
  });

  it('accepts perfectly contiguous strictly monotonic sequence', () => {
    const e0 = createEvent('session.started', {
      sessionId: 's1',
      sequence: 0,
      payload: {
        agent: { name: 'test' },
        workingDirectory: '/test',
      },
    });
    const e1 = createEvent('task.started', {
      sessionId: 's1',
      sequence: 1,
      payload: { taskId: 't1', taskName: 'Task 1' },
    });
    const e2 = createEvent('task.completed', {
      sessionId: 's1',
      sequence: 2,
      payload: { taskId: 't1', resultSummary: 'done', verified: true },
    });

    expect(sequencer.evaluate(e0)).toEqual({ accepted: true });
    expect(sequencer.evaluate(e1)).toEqual({ accepted: true });
    expect(sequencer.evaluate(e2)).toEqual({ accepted: true });

    expect(sequencer.getLastSequence()).toBe(2);
    expect(sequencer.getExpectedSequence()).toBe(3);
    const stats = sequencer.getStats();
    expect(stats.totalEventsReceived).toBe(3);
    expect(stats.duplicateCount).toBe(0);
    expect(stats.gapCount).toBe(0);
    expect(stats.outOfOrderCount).toBe(0);
  });

  it('detects duplicate eventId', () => {
    const e0 = createEvent('session.started', {
      sessionId: 's1',
      sequence: 0,
      payload: {
        agent: { name: 'test' },
        workingDirectory: '/test',
      },
    });

    const res1 = sequencer.evaluate(e0);
    expect(res1.accepted).toBe(true);

    // Same eventId again
    const res2 = sequencer.evaluate(e0);
    expect(res2.accepted).toBe(false);
    expect(res2.anomaly).toBe('duplicate');
    expect(res2.diagnostic?.code).toBe('DUPLICATE_EVENT_ID');

    expect(sequencer.getStats().duplicateCount).toBe(1);
  });

  it('detects duplicate sequence number even with different eventId', () => {
    const e0 = createEvent('session.started', {
      sessionId: 's1',
      sequence: 0,
      payload: {
        agent: { name: 'test' },
        workingDirectory: '/test',
      },
    });
    const e0DupSeq = createEvent('session.started', {
      sessionId: 's1',
      sequence: 0,
      payload: {
        agent: { name: 'test2' },
        workingDirectory: '/test',
      },
    });

    expect(sequencer.evaluate(e0).accepted).toBe(true);
    const res = sequencer.evaluate(e0DupSeq);
    expect(res.accepted).toBe(false);
    expect(res.anomaly).toBe('duplicate');
    expect(res.diagnostic?.code).toBe('DUPLICATE_SEQUENCE');
    expect(sequencer.getStats().duplicateCount).toBe(1);
  });

  it('detects sequence gap without fabricating events and advances expected sequence', () => {
    const e0 = createEvent('session.started', {
      sessionId: 's1',
      sequence: 0,
      payload: {
        agent: { name: 'test' },
        workingDirectory: '/test',
      },
    });
    // Jump from 0 to 3 (missing 1, 2)
    const e3 = createEvent('task.started', {
      sessionId: 's1',
      sequence: 3,
      payload: { taskId: 't3', taskName: 'Task 3' },
    });

    expect(sequencer.evaluate(e0).accepted).toBe(true);
    const res = sequencer.evaluate(e3);
    expect(res.accepted).toBe(true);
    expect(res.anomaly).toBe('sequence_gap');
    expect(res.diagnostic?.code).toBe('SEQUENCE_GAP');
    expect((res.diagnostic?.details as { missingRange?: string })?.missingRange).toBe('1..2');

    expect(sequencer.getLastSequence()).toBe(3);
    expect(sequencer.getExpectedSequence()).toBe(4);
    expect(sequencer.getStats().gapCount).toBe(1);
  });

  it('detects out-of-order sequence without reordering', () => {
    const e0 = createEvent('session.started', {
      sessionId: 's1',
      sequence: 0,
      payload: {
        agent: { name: 'test' },
        workingDirectory: '/test',
      },
    });
    const e2 = createEvent('task.started', {
      sessionId: 's1',
      sequence: 2,
      payload: { taskId: 't2', taskName: 'Task 2' },
    });
    // Now sequence 1 arrives late
    const e1 = createEvent('task.started', {
      sessionId: 's1',
      sequence: 1,
      payload: { taskId: 't1', taskName: 'Task 1' },
    });

    expect(sequencer.evaluate(e0).accepted).toBe(true);
    expect(sequencer.evaluate(e2).accepted).toBe(true); // gap 1
    const res = sequencer.evaluate(e1);
    expect(res.accepted).toBe(true);
    expect(res.anomaly).toBe('out_of_order');
    expect(res.diagnostic?.code).toBe('OUT_OF_ORDER_SEQUENCE');
    expect(sequencer.getStats().outOfOrderCount).toBe(1);
  });

  it('resets tracking state on reset()', () => {
    const e0 = createEvent('session.started', {
      sessionId: 's1',
      sequence: 0,
      payload: {
        agent: { name: 'test' },
        workingDirectory: '/test',
      },
    });
    sequencer.evaluate(e0);
    expect(sequencer.getLastSequence()).toBe(0);

    sequencer.reset();
    expect(sequencer.getLastSequence()).toBe(-1);
    expect(sequencer.getExpectedSequence()).toBe(0);
    expect(sequencer.getStats().totalEventsReceived).toBe(0);
  });
});
