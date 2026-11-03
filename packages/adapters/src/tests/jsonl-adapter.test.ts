import { describe, it, expect, beforeEach } from 'vitest';
import {
  JsonlAdapter,
  JsonlParser,
  AdapterParsingError,
  AdapterValidationError,
} from '../index.js';

describe('JsonlParser', () => {
  let parser: JsonlParser;

  beforeEach(() => {
    parser = new JsonlParser();
  });

  it('parses single line', () => {
    const lines = parser.push('{"a":1}\n');
    expect(lines).toEqual(['{"a":1}']);
  });

  it('parses multiple lines in a single chunk', () => {
    const chunk = '{"line":1}\n{"line":2}\r\n{"line":3}\n';
    const lines = parser.push(chunk);
    expect(lines).toEqual(['{"line":1}', '{"line":2}', '{"line":3}']);
  });

  it('handles chunked input split across calls', () => {
    const chunk1 = '{"chunk":';
    const chunk2 = '1}\n{"chunk":2';
    const chunk3 = '}\n';

    expect(parser.push(chunk1)).toEqual([]);
    expect(parser.push(chunk2)).toEqual(['{"chunk":1}']);
    expect(parser.push(chunk3)).toEqual(['{"chunk":2}']);
  });

  it('flushes partial content at end of stream', () => {
    parser.push('{"last":true}');
    const flushed = parser.flush();
    expect(flushed).toEqual(['{"last":true}']);
    expect(parser.flush()).toEqual([]);
  });

  it('enforces maximum line length to prevent unbounded buffer growth', () => {
    const limitedParser = new JsonlParser({ maxLineLengthBytes: 50 });
    const hugeChunk = 'a'.repeat(60);

    expect(() => {
      limitedParser.push(hugeChunk);
    }).toThrow(AdapterParsingError);
  });
});

describe('JsonlAdapter', () => {
  let adapter: JsonlAdapter;

  beforeEach(() => {
    adapter = new JsonlAdapter();
  });

  it('detects jsonl metadata or file extension', () => {
    expect(adapter.detect({ metadata: { format: 'jsonl' } }).detected).toBe(true);
    expect(adapter.detect({ metadata: { filePath: 'events.jsonl' } }).detected).toBe(true);
    // Universal fallback
    expect(adapter.detect({}).detected).toBe(true);
  });

  it('normalizes valid single JSONL event line', () => {
    const session = adapter.initialize({});
    const jsonLine =
      JSON.stringify({
        protocolVersion: '1.0.0',
        eventId: 'evt-custom-1',
        sessionId: session.id,
        sequence: 0,
        timestamp: '2026-11-03T10:00:00.000Z',
        eventType: 'session.started',
        payload: {
          agent: { name: 'test-agent' },
          workingDirectory: '/test',
        },
      }) + '\n';

    const events = adapter.normalize(jsonLine, session);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('session.started');
    expect(events[0].eventId).toBe('evt-custom-1');
  });

  it('normalizes multiple events in stream with automatic sequence assignment if missing', () => {
    const session = adapter.initialize({}, 'sess-assigned');
    const line1 = JSON.stringify({
      eventType: 'task.started',
      payload: { taskId: 'task-1', taskName: 'Task 1' },
    });
    const line2 = JSON.stringify({
      eventType: 'task.completed',
      payload: { taskId: 'task-1', resultSummary: 'Finished', verified: true },
    });

    const events = adapter.normalize(`${line1}\n${line2}\n`, session);
    expect(events).toHaveLength(2);
    expect(events[0].sessionId).toBe('sess-assigned');
    expect(events[0].sequence).toBe(0);
    expect(events[1].sequence).toBe(1);
  });

  it('rejects malformed JSON syntax with AdapterParsingError', () => {
    const session = adapter.initialize({});
    expect(() => {
      adapter.normalize('{"broken json\n', session);
    }).toThrow(AdapterParsingError);
  });

  it('rejects invalid protocol event schemas with AdapterValidationError', () => {
    const session = adapter.initialize({});
    const invalidEvent =
      JSON.stringify({
        eventType: 'unknown.nonexistent.event',
        payload: {},
      }) + '\n';

    expect(() => {
      adapter.normalize(invalidEvent, session);
    }).toThrow(AdapterValidationError);
  });

  it('masks sensitive credentials present in log messages and payloads', () => {
    const session = adapter.initialize({});
    const secretLine =
      JSON.stringify({
        eventType: 'log.emitted',
        payload: {
          level: 'info',
          message: 'Connected with Bearer secret-token-123456 and password=supersecret',
        },
      }) + '\n';

    const events = adapter.normalize(secretLine, session);
    expect(events).toHaveLength(1);
    const msg = (events[0].payload as { message: string }).message;
    expect(msg).toContain('Bearer [REDACTED]');
    expect(msg).toContain('password=[REDACTED]');
    expect(msg).not.toContain('secret-token-123456');
    expect(msg).not.toContain('supersecret');
  });

  it('filters private reasoning and scratchpads from event data', () => {
    const session = adapter.initialize({});
    const thoughtLine =
      JSON.stringify({
        eventType: 'log.emitted',
        payload: {
          level: 'info',
          message: '<thought>Internal hidden agent planning</thought>Public log message',
        },
      }) + '\n';

    const events = adapter.normalize(thoughtLine, session);
    expect(events).toHaveLength(1);
    const msg = (events[0].payload as { message: string }).message;
    expect(msg).toBe('Public log message');
    expect(msg).not.toContain('Internal hidden agent planning');
  });

  it('supports legacy M00 canHandle and transform methods', () => {
    expect(adapter.canHandle('some text')).toBe(true);

    const validLine =
      JSON.stringify({
        eventType: 'log.emitted',
        payload: { level: 'info', message: 'Legacy test' },
      }) + '\n';

    const envelopes = adapter.transform(validLine);
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0].eventType).toBe('log.emitted');
  });
});
