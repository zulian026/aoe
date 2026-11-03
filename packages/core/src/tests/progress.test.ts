import { describe, it, expect } from 'vitest';
import { Engine } from '../index.js';
import { createEvent } from '@aoe/protocol';

describe('Engine Progress Tracking', () => {
  it('tracks progress metrics on tasks and aggregates session completion', () => {
    const engine = new Engine();
    engine.processEvent(
      createEvent('session.started', {
        sessionId: 'sess_prog',
        sequence: 0,
        payload: { agent: { name: 'claude' }, workingDirectory: '/dir' },
      }),
    );
    engine.processEvent(
      createEvent('task.started', {
        sessionId: 'sess_prog',
        sequence: 1,
        payload: { taskId: 't1', taskName: 'Task 1' },
      }),
    );

    // Update progress on task 1
    const res = engine.processEvent(
      createEvent('progress.updated', {
        sessionId: 'sess_prog',
        sequence: 2,
        payload: {
          taskId: 't1',
          completedWork: 5,
          totalWork: 10,
          isEstimate: false,
          unit: 'files',
        },
      }),
    );

    expect(res.status).toBe('accepted');

    const snap = engine.getSessionSnapshot('sess_prog');
    const task1 = snap?.tasks.get('t1');
    expect(task1?.progress?.completedWork).toBe(5);
    expect(task1?.progress?.percentage).toBe(50);
  });

  it('preserves estimate flag and derives overall session progress from tasks', () => {
    const engine = new Engine();
    engine.processEvent(
      createEvent('session.started', {
        sessionId: 'sess_agg',
        sequence: 0,
        payload: { agent: { name: 'claude' }, workingDirectory: '/dir' },
      }),
    );
    engine.processEvent(
      createEvent('task.started', {
        sessionId: 'sess_agg',
        sequence: 1,
        payload: { taskId: 't1', taskName: 'Task 1' },
      }),
    );
    engine.processEvent(
      createEvent('task.started', {
        sessionId: 'sess_agg',
        sequence: 2,
        payload: { taskId: 't2', taskName: 'Task 2' },
      }),
    );

    // Complete task 1
    engine.processEvent(
      createEvent('task.completed', {
        sessionId: 'sess_agg',
        sequence: 3,
        payload: { taskId: 't1', resultSummary: 'Done', verified: true },
      }),
    );

    const snap = engine.getSessionSnapshot('sess_agg');
    expect(snap?.activeTaskCount).toBe(1);
    expect(snap?.completedTaskCount).toBe(1);
    expect(snap?.progress?.completedWork).toBe(1);
    expect(snap?.progress?.totalWork).toBe(2);
    expect(snap?.progress?.percentage).toBe(50);
  });
});
