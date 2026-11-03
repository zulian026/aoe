import { describe, it, expect } from 'vitest';
import { AoeEventSchema, createEvent, PROTOCOL_VERSION } from '../index.js';

describe('Event Schemas & Discriminated Union', () => {
  const baseMeta = {
    protocolVersion: PROTOCOL_VERSION,
    eventId: 'evt_test_1',
    sessionId: 'sess_test_1',
    sequence: 0,
    timestamp: '2026-11-03T10:00:00.000Z',
  };

  it('validates session.started event', () => {
    const event = {
      ...baseMeta,
      eventType: 'session.started',
      payload: {
        agent: { name: 'claude-code', version: '1.2.0' },
        workingDirectory: '/home/dev/project',
      },
    };
    const parsed = AoeEventSchema.safeParse(event);
    expect(parsed.success).toBe(true);
  });

  it('validates session.ended event', () => {
    const event = {
      ...baseMeta,
      sequence: 10,
      eventType: 'session.ended',
      payload: {
        status: 'completed',
        durationMs: 1250,
        stats: { tasksTotal: 3, tasksCompleted: 3 },
      },
    };
    const parsed = AoeEventSchema.safeParse(event);
    expect(parsed.success).toBe(true);
  });

  it('validates task.started event', () => {
    const event = {
      ...baseMeta,
      eventType: 'task.started',
      payload: {
        taskId: 'task_001',
        taskName: 'Refactor Auth',
        description: 'Migrating legacy auth tokens',
      },
    };
    const parsed = AoeEventSchema.safeParse(event);
    expect(parsed.success).toBe(true);
  });

  it('validates task.updated event', () => {
    const event = {
      ...baseMeta,
      eventType: 'task.updated',
      payload: {
        taskId: 'task_001',
        status: 'running',
        message: 'Writing token verification tests',
      },
    };
    const parsed = AoeEventSchema.safeParse(event);
    expect(parsed.success).toBe(true);
  });

  it('validates task.completed event with verification flag', () => {
    const event = {
      ...baseMeta,
      eventType: 'task.completed',
      payload: {
        taskId: 'task_001',
        resultSummary: '12 unit tests passing',
        verified: true,
      },
    };
    const parsed = AoeEventSchema.safeParse(event);
    expect(parsed.success).toBe(true);
  });

  it('validates task.failed event', () => {
    const event = {
      ...baseMeta,
      eventType: 'task.failed',
      payload: {
        taskId: 'task_001',
        error: { code: 'ERR_TIMEOUT', message: 'Database connection timed out' },
        recoverable: true,
      },
    };
    const parsed = AoeEventSchema.safeParse(event);
    expect(parsed.success).toBe(true);
  });

  it('validates log.emitted event', () => {
    const event = {
      ...baseMeta,
      eventType: 'log.emitted',
      payload: {
        level: 'info',
        message: 'Server listening on port 3000',
        stream: 'stdout',
      },
    };
    const parsed = AoeEventSchema.safeParse(event);
    expect(parsed.success).toBe(true);
  });

  it('validates diagnostic.emitted event with hypothesis flag', () => {
    const event = {
      ...baseMeta,
      eventType: 'diagnostic.emitted',
      payload: {
        severity: 'warning',
        message: 'Potential memory leak in unclosed cursor',
        isHypothesis: true,
        location: { path: 'src/db.ts', line: 42 },
        suggestedRemediation: 'Ensure cursor.close() is called in finally block',
      },
    };
    const parsed = AoeEventSchema.safeParse(event);
    expect(parsed.success).toBe(true);
  });

  it('validates result.produced event', () => {
    const event = {
      ...baseMeta,
      eventType: 'result.produced',
      payload: {
        category: 'test_results',
        title: 'Unit Test Results',
        data: { passed: 42, failed: 0, durationMs: 650 },
      },
    };
    const parsed = AoeEventSchema.safeParse(event);
    expect(parsed.success).toBe(true);
  });

  it('validates error.occurred event', () => {
    const event = {
      ...baseMeta,
      eventType: 'error.occurred',
      payload: {
        code: 'ERR_DISK_FULL',
        message: 'No space left on device',
        severity: 'fatal',
      },
    };
    const parsed = AoeEventSchema.safeParse(event);
    expect(parsed.success).toBe(true);
  });

  it('rejects an unlisted eventType', () => {
    const event = {
      ...baseMeta,
      eventType: 'unsupported.magic_event',
      payload: {},
    };
    const parsed = AoeEventSchema.safeParse(event);
    expect(parsed.success).toBe(false);
  });

  it('creates valid events using createEvent helper', () => {
    const event = createEvent('task.started', {
      sessionId: 'sess_123',
      sequence: 1,
      payload: {
        taskId: 'task_abc',
        taskName: 'Build CLI',
      },
    });

    expect(event.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(event.sessionId).toBe('sess_123');
    expect(event.sequence).toBe(1);
    expect(event.eventType).toBe('task.started');
    expect(event.eventId).toMatch(/^evt_/);

    const parsed = AoeEventSchema.safeParse(event);
    expect(parsed.success).toBe(true);
  });
});
