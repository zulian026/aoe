import { describe, it, expect, beforeEach } from 'vitest';
import { SidecarReadModel } from '../sidecar/read-model.js';
import { createEvent } from '@zyanx04/protocol';

describe('SidecarReadModel', () => {
  let model: SidecarReadModel;

  beforeEach(() => {
    model = new SidecarReadModel();
  });

  it('initializes with uninitialized state', () => {
    expect(model.status).toBe('uninitialized');
    expect(model.isTerminated).toBe(false);
    expect(model.tasks.size).toBe(0);
    expect(model.activeTaskId).toBeUndefined();
  });

  it('transitions to active on session.started', () => {
    const event = createEvent('session.started', {
      sessionId: 'sess_123',
      sequence: 0,
      payload: {
        agent: { name: 'antigravity', version: '1.5.0' },
        workingDirectory: '/home/user/work',
      },
    });

    model.reduce(event);
    expect(model.status).toBe('active');
    expect(model.sessionId).toBe('sess_123');
    expect(model.agent?.name).toBe('antigravity');
    expect(model.workingDirectory).toBe('/home/user/work');
    expect(model.isTerminated).toBe(false);
  });

  it('tracks task lifecycle, progress, and status', () => {
    model.reduce(
      createEvent('session.started', {
        sessionId: 'sess_1',
        sequence: 0,
        payload: {
          agent: { name: 'test' },
          workingDirectory: '/home/user/work',
        },
      }),
    );

    // Start task 1
    model.reduce(
      createEvent('task.started', {
        sessionId: 'sess_1',
        sequence: 1,
        payload: { taskId: 'task_1', taskName: 'Task 1' },
      }),
    );
    expect(model.activeTaskId).toBe('task_1');
    expect(model.tasks.get('task_1')?.status).toBe('running');
    expect(model.rootTaskIds).toEqual(['task_1']);

    // Update task 1 progress
    model.reduce(
      createEvent('progress.updated', {
        sessionId: 'sess_1',
        sequence: 2,
        payload: {
          taskId: 'task_1',
          completedWork: 50,
          totalWork: 100,
          unit: '%',
          currentWork: 'compiling files',
          isEstimate: false,
        },
      }),
    );
    expect(model.tasks.get('task_1')?.progress?.completedWork).toBe(50);
    expect(model.tasks.get('task_1')?.progress?.percentage).toBe(50);
    expect(model.overallProgress?.currentWork).toBe('compiling files');
    expect(model.activeTools.has('compiling files')).toBe(true);

    // Complete task 1
    model.reduce(
      createEvent('task.completed', {
        sessionId: 'sess_1',
        sequence: 3,
        payload: {
          taskId: 'task_1',
          verified: true,
          resultSummary: 'Task 1 passed cleanly',
        },
      }),
    );
    expect(model.tasks.get('task_1')?.status).toBe('completed');
    expect(model.tasks.get('task_1')?.verified).toBe(true);
    expect(model.activeTaskId).toBeUndefined();
    expect(model.verificationStatus.verified).toBe(true);
    expect(model.verificationStatus.evidenceCount).toBe(1);

    // Start task 2 and fail it
    model.reduce(
      createEvent('task.started', {
        sessionId: 'sess_1',
        sequence: 4,
        payload: { taskId: 'task_2', taskName: 'Task 2' },
      }),
    );
    expect(model.activeTaskId).toBe('task_2');

    model.reduce(
      createEvent('task.failed', {
        sessionId: 'sess_1',
        sequence: 5,
        payload: {
          taskId: 'task_2',
          error: { code: 'ERR_FAIL', message: 'Task 2 failed' },
        },
      }),
    );
    expect(model.tasks.get('task_2')?.status).toBe('failed');
    expect(model.tasks.get('task_2')?.error?.code).toBe('ERR_FAIL');
    expect(model.activeTaskId).toBeUndefined();
  });

  it('tracks file changes in chronological order', () => {
    model.reduce(
      createEvent('session.started', {
        sessionId: 'sess_1',
        sequence: 0,
        payload: {
          agent: { name: 'test' },
          workingDirectory: '/home/user/work',
        },
      }),
    );

    model.reduce(
      createEvent('file.changed', {
        sessionId: 'sess_1',
        sequence: 1,
        payload: {
          path: 'src/main.ts',
          action: 'CREATED',
          evidence: { verifiedOnDisk: true },
          lineDelta: { added: 25, removed: 0 },
        },
      }),
    );

    model.reduce(
      createEvent('file.changed', {
        sessionId: 'sess_1',
        sequence: 2,
        payload: {
          path: 'src/main.ts',
          action: 'MODIFIED',
          evidence: { verifiedOnDisk: true },
          lineDelta: { added: 10, removed: 5 },
        },
      }),
    );

    expect(model.fileChanges).toHaveLength(2);
    expect(model.fileChanges[0].path).toBe('src/main.ts');
    expect(model.fileChanges[0].action).toBe('CREATED');
    expect(model.fileChanges[1].action).toBe('MODIFIED');
  });

  it('captures diagnostics and warnings', () => {
    model.reduce(
      createEvent('session.started', {
        sessionId: 'sess_1',
        sequence: 0,
        payload: {
          agent: { name: 'test' },
          workingDirectory: '/home/user/work',
        },
      }),
    );

    model.reduce(
      createEvent('diagnostic.emitted', {
        sessionId: 'sess_1',
        sequence: 1,
        payload: {
          severity: 'warning',
          message: 'Deprecated API in use',
          isHypothesis: false,
        },
      }),
    );

    expect(model.diagnostics).toHaveLength(1);
    expect(model.diagnostics[0].level).toBe('warning');
    expect(model.diagnostics[0].message).toBe('Deprecated API in use');
  });

  it('reconciles terminal session state and auto-clears lingering active tasks on session.ended', () => {
    model.reduce(
      createEvent('session.started', {
        sessionId: 'sess_1',
        sequence: 0,
        payload: {
          agent: { name: 'test' },
          workingDirectory: '/home/user/work',
        },
      }),
    );

    model.reduce(
      createEvent('task.started', {
        sessionId: 'sess_1',
        sequence: 1,
        payload: { taskId: 'task_lingering', taskName: 'Lingering Task' },
      }),
    );
    expect(model.activeTaskId).toBe('task_lingering');

    // session.ended arrives while task is still running
    model.reduce(
      createEvent('session.ended', {
        sessionId: 'sess_1',
        sequence: 2,
        payload: {
          status: 'completed',
          durationMs: 1200,
          summary: 'Agent finished execution',
        },
      }),
    );

    expect(model.status).toBe('completed');
    expect(model.isTerminated).toBe(true);
    expect(model.terminationReason).toBe('Agent finished execution');
    expect(model.activeTaskId).toBeUndefined();
    expect(model.currentTask).toBeUndefined();
    expect(model.tasks.get('task_lingering')?.status).toBe('completed');
  });

  it('generates a clean serializable snapshot via getSnapshot()', () => {
    model.reduce(
      createEvent('session.started', {
        sessionId: 'sess_snap',
        sequence: 0,
        payload: {
          agent: { name: 'test' },
          workingDirectory: '/home/user/work',
        },
      }),
    );

    const snapshot = model.getSnapshot();
    expect(snapshot.sessionId).toBe('sess_snap');
    expect(snapshot.status).toBe('active');
    expect(snapshot.isTerminated).toBe(false);
    expect(typeof snapshot.tasks).toBe('object');
    expect(Array.isArray(snapshot.toolHistory)).toBe(true);
    expect(Array.isArray(snapshot.fileChanges)).toBe(true);
  });
});
