import { describe, it, expect, vi } from 'vitest';
import { Engine } from '../index.js';
import { createEvent } from '@zyanx04/protocol';

describe('StateDispatcher', () => {
  it('notifies subscribers upon state change and supports unsubscription', () => {
    const engine = new Engine();
    const listener = vi.fn();

    const unsubscribe = engine.subscribe('sess_disp', listener);

    engine.processEvent(
      createEvent('session.started', {
        sessionId: 'sess_disp',
        sequence: 0,
        payload: { agent: { name: 'claude' }, workingDirectory: '/dir' },
      }),
    );

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].sessionId).toBe('sess_disp');

    // Unsubscribe
    unsubscribe();

    engine.processEvent(
      createEvent('task.started', {
        sessionId: 'sess_disp',
        sequence: 1,
        payload: { taskId: 't1', taskName: 'Task 1' },
      }),
    );

    // Listener should not have been called a second time
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('isolates listener exceptions so other listeners continue receiving updates', () => {
    const engine = new Engine();
    const failingListener = vi.fn().mockImplementation(() => {
      throw new Error('Listener crashed intentionally');
    });
    const successfulListener = vi.fn();

    engine.subscribe('sess_iso', failingListener);
    engine.subscribe('sess_iso', successfulListener);

    // Should not throw even though failingListener throws
    expect(() => {
      engine.processEvent(
        createEvent('session.started', {
          sessionId: 'sess_iso',
          sequence: 0,
          payload: { agent: { name: 'claude' }, workingDirectory: '/dir' },
        }),
      );
    }).not.toThrow();

    expect(failingListener).toHaveBeenCalledTimes(1);
    expect(successfulListener).toHaveBeenCalledTimes(1);
  });

  it('guarantees snapshot immutability to consumers', () => {
    const engine = new Engine();
    let receivedTasks: unknown;

    engine.subscribe('sess_mut', (snapshot) => {
      receivedTasks = snapshot.tasks;
    });

    engine.processEvent(
      createEvent('session.started', {
        sessionId: 'sess_mut',
        sequence: 0,
        payload: { agent: { name: 'claude' }, workingDirectory: '/dir' },
      }),
    );

    const snap = engine.getSessionSnapshot('sess_mut');
    expect(snap).not.toBeNull();
    expect(receivedTasks).toBeDefined();

    // Verify mutating an external variable does not corrupt engine internal state
    const tasksMap = snap!.tasks as Map<string, unknown>;
    try {
      tasksMap.set('fake', {} as unknown);
    } catch {
      // If readonly map throws or fails, that is also acceptable
    }

    const freshSnap = engine.getSessionSnapshot('sess_mut');
    expect(freshSnap?.tasks.has('fake')).toBe(false);
  });
});
