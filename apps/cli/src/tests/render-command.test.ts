import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import { executeRender } from '../commands/render.js';
import { ExitCode } from '../runtime/exit-codes.js';
import { CliError } from '../utils/errors.js';

function createMockStream(chunks: string[]): NodeJS.ReadableStream {
  return Readable.from(chunks);
}

describe('aoe render command', () => {
  const validSessionStart = JSON.stringify({
    protocolVersion: '1.0.0',
    eventId: 'evt_1',
    sessionId: 'sess_render_1',
    sequence: 1,
    timestamp: '2026-11-03T12:00:00.000Z',
    eventType: 'session.started',
    payload: {
      agent: { name: 'test-agent' },
      workingDirectory: '/test/dir',
    },
  });

  const validTaskStart = JSON.stringify({
    protocolVersion: '1.0.0',
    eventId: 'evt_2',
    sessionId: 'sess_render_1',
    sequence: 2,
    timestamp: '2026-11-03T12:00:01.000Z',
    eventType: 'task.started',
    payload: {
      taskId: 'task_1',
      taskName: 'Run Typecheck',
    },
  });

  const validTaskComplete = JSON.stringify({
    protocolVersion: '1.0.0',
    eventId: 'evt_3',
    sessionId: 'sess_render_1',
    sequence: 3,
    timestamp: '2026-11-03T12:00:02.000Z',
    eventType: 'task.completed',
    payload: {
      taskId: 'task_1',
      resultSummary: 'Typecheck succeeded without errors',
      verified: true,
    },
  });

  it('renders valid canonical JSONL stream in static mode', async () => {
    const input = `${validSessionStart}\n${validTaskStart}\n${validTaskComplete}\n`;
    const stream = createMockStream([input]);

    await expect(
      executeRender({ format: 'static', theme: 'obsidian' }, stream),
    ).resolves.toBeUndefined();
  });

  it('handles partial chunks across stream boundaries', async () => {
    // Split the input across arbitrary chunk boundaries
    const chunk1 = validSessionStart.slice(0, 50);
    const chunk2 = validSessionStart.slice(50) + '\n' + validTaskStart.slice(0, 30);
    const chunk3 = validTaskStart.slice(30) + '\n';

    const stream = createMockStream([chunk1, chunk2, chunk3]);

    await expect(
      executeRender({ format: 'static', theme: 'light' }, stream),
    ).resolves.toBeUndefined();
  });

  it('correctly handles final record without trailing newline', async () => {
    const stream = createMockStream([validSessionStart]); // no trailing \n

    await expect(executeRender({ format: 'static' }, stream)).resolves.toBeUndefined();
  });

  it('fails with PROTOCOL_ERROR (3) on malformed JSON line', async () => {
    const malformed = `{"protocolVersion": "1.0.0", invalid_json}\n`;
    const stream = createMockStream([malformed]);

    try {
      await executeRender({ format: 'static' }, stream);
      expect.fail('Expected error to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CliError);
      expect((err as CliError).exitCode).toBe(ExitCode.PROTOCOL_ERROR);
      expect((err as CliError).message).toContain('Protocol error');
    }
  });

  it('fails with PROTOCOL_ERROR (3) on schema validation failure', async () => {
    // Missing required payload.workingDirectory
    const invalidSchema =
      JSON.stringify({
        protocolVersion: '1.0.0',
        eventId: 'evt_1',
        sessionId: 'sess_1',
        sequence: 1,
        timestamp: '2026-11-03T12:00:00.000Z',
        eventType: 'session.started',
        payload: {
          agent: { name: 'test' },
        },
      }) + '\n';

    const stream = createMockStream([invalidSchema]);

    try {
      await executeRender({ format: 'static' }, stream);
      expect.fail('Expected error to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CliError);
      expect((err as CliError).exitCode).toBe(ExitCode.PROTOCOL_ERROR);
      expect((err as CliError).message).toContain('Event schema validation failed');
    }
  });

  it('rejects invalid render mode with INVALID_ARGUMENTS (2)', async () => {
    const stream = createMockStream([validSessionStart + '\n']);

    await expect(executeRender({ format: 'unsupported-mode' }, stream)).rejects.toThrow(
      'Invalid render mode "unsupported-mode"',
    );
  });

  it('handles empty input stream cleanly', async () => {
    const stream = createMockStream([]);

    await expect(executeRender({ format: 'static' }, stream)).resolves.toBeUndefined();
  });
});
