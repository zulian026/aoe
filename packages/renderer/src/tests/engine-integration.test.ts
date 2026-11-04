import { describe, it, expect } from 'vitest';
import { Engine } from '@zyanx04/core';
import { createEvent } from '@zyanx04/protocol';
import { TerminalRenderer } from '../terminal-renderer.js';
import { MockTerminalStream } from './test-utils.js';

describe('Engine to TerminalRenderer Live Integration', () => {
  it('receives state updates from Engine and formats live progress in real time', async () => {
    const engine = new Engine();
    const stream = new MockTerminalStream({ isTTY: false });

    const sessionId = 'sess_live_integration_01';

    // 1. Ingest session.started event (sequence: 0)
    const sessionStartEvent = createEvent('session.started', {
      sessionId,
      sequence: 0,
      payload: {
        agent: { name: 'Claude-3.7-Sonnet', version: '2026.1' },
        workingDirectory: '/home/user/project',
      },
    });
    engine.processEvent(sessionStartEvent);

    // 2. Attach TerminalRenderer to Engine
    const renderer = new TerminalRenderer({
      engine,
      sessionId,
      stdout: stream as unknown as NodeJS.WriteStream,
      mode: 'static',
      noColor: true,
    });

    await renderer.start();

    // Verify initial render on start
    expect(stream.output).toContain('AOE Session sess_live_integration_01: [ACTIVE]');
    expect(stream.output).toContain('(agent: Claude-3.7-Sonnet)');

    // 3. Ingest task.started event (sequence: 1)
    const taskStartEvent = createEvent('task.started', {
      sessionId,
      sequence: 1,
      payload: {
        taskId: 'task_compile',
        taskName: 'Compile project code',
      },
    });
    engine.processEvent(taskStartEvent);

    // 4. Ingest file.changed event (sequence: 2)
    const fileEvent = createEvent('file.changed', {
      sessionId,
      sequence: 2,
      payload: {
        action: 'CREATED',
        path: 'src/main.ts',
        lineDelta: { added: 40, removed: 0 },
        evidence: { verifiedOnDisk: true },
      },
    });
    engine.processEvent(fileEvent);

    expect(stream.output).toContain('File [CREATED]: src/main.ts (+40 -0) [verified]');

    // 5. Ingest progress.updated event (sequence: 3)
    const progressEvent = createEvent('progress.updated', {
      sessionId,
      sequence: 3,
      payload: {
        completedWork: 1,
        totalWork: 2,
        isEstimate: false,
        unit: 'tasks',
        description: 'Halfway through pipeline',
      },
    });
    engine.processEvent(progressEvent);

    expect(stream.output).toContain('Progress: 50% (1/2) - Halfway through pipeline');

    // 6. Ingest task.completed event (sequence: 4)
    const taskCompleteEvent = createEvent('task.completed', {
      sessionId,
      sequence: 4,
      payload: {
        taskId: 'task_compile',
        verified: true,
        resultSummary: 'TypeScript compilation successful',
      },
    });
    engine.processEvent(taskCompleteEvent);

    expect(stream.output).toContain('Compile project code [COMPLETED]');
    expect(stream.output).toContain('TypeScript compilation successful');

    // 7. Ingest session.ended event (sequence: 5)
    const sessionEndEvent = createEvent('session.ended', {
      sessionId,
      sequence: 5,
      payload: {
        status: 'completed',
        summary: 'All tasks completed successfully',
      },
    });
    engine.processEvent(sessionEndEvent);

    expect(stream.output).toContain('[COMPLETED]');

    // 8. Stop renderer
    await renderer.stop();
  });
});
