import { Writable } from 'node:stream';
import type { SessionSnapshot } from '@zyanx04/core';

export class MockTerminalStream extends Writable {
  public output = '';
  public isTTY: boolean;
  public columns: number;
  public rows: number;

  constructor(options: { isTTY?: boolean; columns?: number; rows?: number } = {}) {
    super();
    this.isTTY = options.isTTY ?? false;
    this.columns = options.columns ?? 80;
    this.rows = options.rows ?? 24;
  }

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.output += chunk.toString();
    callback();
  }

  public clear(): void {
    this.output = '';
  }

  public getColorDepth(): number {
    return this.isTTY ? 8 : 1;
  }
}

export function createMockSnapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  const tasksMap = new Map();
  return {
    sessionId: 'sess_test_123',
    status: 'active',
    agent: { name: 'Claude-Code', version: '1.0.0' },
    workingDirectory: '/home/user/project',
    startedAt: '2026-11-03T18:00:00.000Z',
    durationMs: 450,
    lastSequence: 5,
    totalEvents: 5,
    tasks: tasksMap,
    rootTaskIds: [],
    activeTaskCount: 1,
    completedTaskCount: 2,
    failedTaskCount: 0,
    progress: {
      completedWork: 2,
      totalWork: 4,
      verifiedWork: 2,
      isEstimate: false,
      percentage: 50,
      unit: 'tasks',
      description: 'Running tests',
    },
    fileChanges: [
      {
        action: 'CREATED',
        path: 'src/index.ts',
        lineDelta: { added: 25, removed: 0 },
        evidence: { verifiedOnDisk: true },
        timestamp: '2026-11-03T18:00:01.000Z',
      },
    ],
    diagnostics: [
      {
        severity: 'warning',
        message: 'Potential memory leak',
        isHypothesis: true,
        timestamp: '2026-11-03T18:00:02.000Z',
      },
    ],
    stats: {
      tasksTotal: 4,
      tasksCompleted: 2,
      tasksFailed: 0,
      filesChanged: 1,
      errorsCount: 0,
      warningsCount: 1,
      durationMs: 450,
    },
    ...overrides,
  };
}
