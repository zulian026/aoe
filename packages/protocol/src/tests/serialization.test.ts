import { describe, it, expect } from 'vitest';
import {
  serializeEvent,
  parseEvent,
  safeParseEvent,
  validateEvent,
  parseEventStream,
  createEvent,
  ProtocolError,
  type AoeEvent,
} from '../index.js';

describe('JSONL Serialization & Stream Parsing', () => {
  const sampleEvent: AoeEvent = createEvent('session.started', {
    sessionId: 'sess_123',
    sequence: 0,
    payload: {
      agent: { name: 'codex' },
      workingDirectory: '/home/dev',
    },
  });

  it('serializes event to deterministic single-line JSON with trailing newline', () => {
    const line = serializeEvent(sampleEvent);
    expect(line.endsWith('\n')).toBe(true);
    expect(line.trim()).not.toContain('\n');

    // Deterministic sorting test
    const keys = Object.keys(JSON.parse(line));
    expect(keys).toEqual([...keys].sort());
  });

  it('serializes event without newline when option specified', () => {
    const line = serializeEvent(sampleEvent, { newline: false });
    expect(line.endsWith('\n')).toBe(false);
  });

  it('parses valid serialized event line back into identical typed event', () => {
    const line = serializeEvent(sampleEvent);
    const parsed = parseEvent(line);
    expect(parsed.sessionId).toBe(sampleEvent.sessionId);
    expect(parsed.sequence).toBe(sampleEvent.sequence);
    expect(parsed.eventType).toBe('session.started');
    if (parsed.eventType === 'session.started') {
      expect(parsed.payload.agent.name).toBe('codex');
    }
  });

  it('handles safeParseEvent without throwing on malformed JSON', () => {
    const result = safeParseEvent('{ this is not json }');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ProtocolError);
      expect(result.error.code).toBe('JSON_SYNTAX_ERROR');
    }
  });

  it('handles safeParseEvent on empty or whitespace line', () => {
    const result = safeParseEvent('   \n');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('EMPTY_LINE_ERROR');
    }
  });

  it('handles safeParseEvent on invalid schema', () => {
    const badEvent = {
      protocolVersion: '1.0.0',
      eventId: 'evt_1',
      sessionId: 'sess_1',
      sequence: 0,
      timestamp: '2026-11-03T10:00:00.000Z',
      eventType: 'session.started',
      payload: {
        // missing required workingDirectory
        agent: { name: 'claude' },
      },
    };
    const result = safeParseEvent(JSON.stringify(badEvent));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('validates in-memory objects via validateEvent', () => {
    expect(() => validateEvent(sampleEvent)).not.toThrow();
    expect(() => validateEvent({ foo: 'bar' })).toThrow(ProtocolError);
  });

  it('correctly buffers and parses split lines across chunked streams', async () => {
    const event1 = createEvent('task.started', {
      sessionId: 'sess_1',
      sequence: 1,
      payload: { taskId: 't1', taskName: 'Task 1' },
    });
    const event2 = createEvent('task.completed', {
      sessionId: 'sess_1',
      sequence: 2,
      payload: { taskId: 't1', resultSummary: 'Done', verified: true },
    });

    const serialized1 = serializeEvent(event1);
    const serialized2 = serializeEvent(event2);

    const fullStream = serialized1 + serialized2;

    // Split stream unnaturally across arbitrary character chunks to test buffering
    const chunk1 = fullStream.slice(0, 35);
    const chunk2 = fullStream.slice(35, 120);
    const chunk3 = fullStream.slice(120);

    const chunks = [chunk1, chunk2, chunk3];
    const events: AoeEvent[] = [];

    for await (const event of parseEventStream(chunks)) {
      events.push(event);
    }

    expect(events.length).toBe(2);
    expect(events[0].eventType).toBe('task.started');
    expect(events[1].eventType).toBe('task.completed');
  });

  it('invokes onError callback on malformed stream line when skipMalformed is true', async () => {
    const validLine = serializeEvent(sampleEvent);
    const malformedLine = '{"bad": "json" missing comma}\n';
    const chunks = [validLine + malformedLine + validLine];

    const errors: ProtocolError[] = [];
    const events: AoeEvent[] = [];

    for await (const event of parseEventStream(chunks, {
      skipMalformed: true,
      onError: (err) => errors.push(err),
    })) {
      events.push(event);
    }

    expect(events.length).toBe(2);
    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe('JSON_SYNTAX_ERROR');
  });
});
