import { describe, it, expect } from 'vitest';
import { validateCanonicalEvent } from '../sidecar/protocol-validator.js';
import { createEvent, PROTOCOL_VERSION } from '@zyanx04/protocol';

describe('validateCanonicalEvent', () => {
  it('validates a valid canonical session.started event object', () => {
    const event = createEvent('session.started', {
      sessionId: 'sess_123',
      sequence: 0,
      payload: {
        agent: { name: 'antigravity', version: '1.5.0' },
        workingDirectory: '/home/user/project',
      },
    });

    const res = validateCanonicalEvent(event);
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.event.eventType).toBe('session.started');
      expect(res.event.sessionId).toBe('sess_123');
      expect(res.event.sequence).toBe(0);
    }
  });

  it('validates a valid JSON string of a canonical event', () => {
    const raw = JSON.stringify({
      protocolVersion: PROTOCOL_VERSION,
      eventId: 'evt_abc',
      sessionId: 'sess_abc',
      sequence: 1,
      timestamp: new Date().toISOString(),
      eventType: 'task.started',
      payload: {
        taskId: 'task_1',
        taskName: 'Initial Task',
      },
    });

    const res = validateCanonicalEvent(raw);
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.event.eventType).toBe('task.started');
      expect((res.event.payload as { taskId: string; taskName: string }).taskId).toBe('task_1');
    }
  });

  it('fails on malformed JSON string', () => {
    const res = validateCanonicalEvent('{"protocolVersion":');
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toContain('JSON parse error');
    }
  });

  it('fails on non-object JSON values (string, number, array, null)', () => {
    expect(validateCanonicalEvent('123').valid).toBe(false);
    expect(validateCanonicalEvent('"hello"').valid).toBe(false);
    expect(validateCanonicalEvent('null').valid).toBe(false);
    expect(validateCanonicalEvent('[]').valid).toBe(false);
    expect(validateCanonicalEvent(null).valid).toBe(false);
    expect(validateCanonicalEvent(42).valid).toBe(false);
  });

  it('fails when protocolVersion does not match 1.0.0', () => {
    const raw = {
      protocolVersion: '2.0.0',
      eventId: 'evt_1',
      sessionId: 'sess_1',
      sequence: 0,
      timestamp: new Date().toISOString(),
      eventType: 'session.started',
      payload: { agent: { name: 'test' } },
    };

    const res = validateCanonicalEvent(raw);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toContain('Unsupported protocol version');
    }
  });

  it('fails when required envelope fields are missing', () => {
    const missingSession = {
      protocolVersion: PROTOCOL_VERSION,
      eventId: 'evt_1',
      sequence: 0,
      timestamp: new Date().toISOString(),
      eventType: 'session.started',
      payload: { agent: { name: 'test' } },
    };

    const res = validateCanonicalEvent(missingSession);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toBeDefined();
    }
  });

  it('fails when payload is invalid for event type', () => {
    const invalidTaskStarted = {
      protocolVersion: PROTOCOL_VERSION,
      eventId: 'evt_1',
      sessionId: 'sess_1',
      sequence: 0,
      timestamp: new Date().toISOString(),
      eventType: 'task.started',
      payload: {
        // missing taskId and title
      },
    };

    const res = validateCanonicalEvent(invalidTaskStarted);
    expect(res.valid).toBe(false);
  });
});
