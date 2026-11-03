import { describe, it, expect } from 'vitest';
import {
  Engine,
  MissingParentTaskError,
  DuplicateTaskError,
  InvalidLifecycleTransitionError,
} from '../index.js';
import { createEvent } from '@aoe/protocol';

describe('Task Hierarchy & State Transitions', () => {
  it('correctly builds nested task hierarchies and calculates depths', () => {
    const engine = new Engine();
    engine.processEvent(
      createEvent('session.started', {
        sessionId: 'sess_task',
        sequence: 0,
        payload: { agent: { name: 'claude' }, workingDirectory: '/dir' },
      }),
    );

    // Root task
    engine.processEvent(
      createEvent('task.started', {
        sessionId: 'sess_task',
        sequence: 1,
        payload: { taskId: 'root_1', taskName: 'Root Task' },
      }),
    );

    // Child task
    engine.processEvent(
      createEvent('task.started', {
        sessionId: 'sess_task',
        sequence: 2,
        payload: { taskId: 'child_1', taskName: 'Child Task', parentTaskId: 'root_1' },
      }),
    );

    // Grandchild task
    engine.processEvent(
      createEvent('task.started', {
        sessionId: 'sess_task',
        sequence: 3,
        payload: { taskId: 'grandchild_1', taskName: 'Grandchild Task', parentTaskId: 'child_1' },
      }),
    );

    const snap = engine.getSessionSnapshot('sess_task');
    expect(snap?.rootTaskIds).toEqual(['root_1']);

    const root = snap?.tasks.get('root_1');
    const child = snap?.tasks.get('child_1');
    const grandchild = snap?.tasks.get('grandchild_1');

    expect(root?.depth).toBe(0);
    expect(root?.childTaskIds).toEqual(['child_1']);

    expect(child?.depth).toBe(1);
    expect(child?.parentTaskId).toBe('root_1');
    expect(child?.childTaskIds).toEqual(['grandchild_1']);

    expect(grandchild?.depth).toBe(2);
    expect(grandchild?.parentTaskId).toBe('child_1');
  });

  it('rejects child task referencing non-existent parent', () => {
    const engine = new Engine();
    engine.processEvent(
      createEvent('session.started', {
        sessionId: 'sess_missing_parent',
        sequence: 0,
        payload: { agent: { name: 'claude' }, workingDirectory: '/dir' },
      }),
    );

    const res = engine.processEvent(
      createEvent('task.started', {
        sessionId: 'sess_missing_parent',
        sequence: 1,
        payload: { taskId: 't1', taskName: 'Task 1', parentTaskId: 'non_existent_parent' },
      }),
    );

    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(res.error).toBeInstanceOf(MissingParentTaskError);
    }
  });

  it('rejects duplicate task registration', () => {
    const engine = new Engine();
    engine.processEvent(
      createEvent('session.started', {
        sessionId: 'sess_dup_task',
        sequence: 0,
        payload: { agent: { name: 'claude' }, workingDirectory: '/dir' },
      }),
    );
    engine.processEvent(
      createEvent('task.started', {
        sessionId: 'sess_dup_task',
        sequence: 1,
        payload: { taskId: 't_unique', taskName: 'Task' },
      }),
    );

    const res = engine.processEvent(
      createEvent('task.started', {
        sessionId: 'sess_dup_task',
        sequence: 2,
        payload: { taskId: 't_unique', taskName: 'Duplicate Task' },
      }),
    );

    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(res.error).toBeInstanceOf(DuplicateTaskError);
    }
  });

  it('rejects invalid task transitions once completed', () => {
    const engine = new Engine();
    engine.processEvent(
      createEvent('session.started', {
        sessionId: 'sess_trans',
        sequence: 0,
        payload: { agent: { name: 'claude' }, workingDirectory: '/dir' },
      }),
    );
    engine.processEvent(
      createEvent('task.started', {
        sessionId: 'sess_trans',
        sequence: 1,
        payload: { taskId: 't1', taskName: 'Task 1' },
      }),
    );
    engine.processEvent(
      createEvent('task.completed', {
        sessionId: 'sess_trans',
        sequence: 2,
        payload: { taskId: 't1', resultSummary: 'Done', verified: true },
      }),
    );

    // Attempting to transition a completed task back to running
    const res = engine.processEvent(
      createEvent('task.updated', {
        sessionId: 'sess_trans',
        sequence: 3,
        payload: { taskId: 't1', status: 'running' },
      }),
    );

    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(res.error).toBeInstanceOf(InvalidLifecycleTransitionError);
    }
  });
});
