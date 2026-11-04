import { describe, it, expect } from 'vitest';
import { renderToString } from 'ink';
import { InteractiveApp } from '../interactive-app.js';
import { createMockSnapshot } from './test-utils.js';
import type { TaskSnapshot } from '@zyanx04/core';

describe('InteractiveApp Component', () => {
  it('renders complete SessionSnapshot in interactive view', () => {
    const tasksMap = new Map<string, TaskSnapshot>();
    tasksMap.set('task_root', {
      id: 'task_root',
      name: 'Root Execution Task',
      status: 'running',
      depth: 0,
      startedAt: '2026-11-03T18:00:00.000Z',
      updatedAt: '2026-11-03T18:00:00.000Z',
      childTaskIds: ['task_child'],
      progress: {
        completedWork: 1,
        totalWork: 2,
        isEstimate: false,
        percentage: 50,
      },
    });
    tasksMap.set('task_child', {
      id: 'task_child',
      name: 'Subtask Worker',
      status: 'completed',
      depth: 1,
      startedAt: '2026-11-03T18:00:00.000Z',
      updatedAt: '2026-11-03T18:00:01.000Z',
      completedAt: '2026-11-03T18:00:01.000Z',
      durationMs: 350,
      childTaskIds: [],
    });

    const snapshot = createMockSnapshot({
      tasks: tasksMap,
      rootTaskIds: ['task_root'],
    });

    const output = renderToString(
      <InteractiveApp
        snapshot={snapshot}
        unicode={true}
        logs={[{ level: 'info', message: 'Interactive test log' }]}
        results={[{ category: 'artifact', title: 'Bundle output', status: 'success' }]}
      />,
    );

    expect(output).toContain('AOE Session sess_test_123');
    expect(output).toContain('[Claude-Code]');
    expect(output).toContain('Root Execution Task');
    expect(output).toContain('Subtask Worker');
    expect(output).toContain('src/index.ts');
    expect(output).toContain('Potential memory leak');
    expect(output).toContain('Interactive test log');
    expect(output).toContain('Bundle output');
  });

  it('handles empty session with no tasks or files', () => {
    const emptySnapshot = createMockSnapshot({
      tasks: new Map(),
      rootTaskIds: [],
      fileChanges: [],
      diagnostics: [],
      progress: null,
    });

    const output = renderToString(<InteractiveApp snapshot={emptySnapshot} />);
    expect(output).toContain('AOE Session');
    expect(output).toContain('No tasks registered');
  });
});
