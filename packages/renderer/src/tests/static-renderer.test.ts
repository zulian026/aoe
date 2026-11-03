/* eslint-disable no-control-regex */
import { describe, it, expect } from 'vitest';
import { StaticRenderer } from '../static-renderer.js';
import { MockTerminalStream, createMockSnapshot } from './test-utils.js';

describe('StaticRenderer', () => {
  it('renders linear session banner and status', () => {
    const stream = new MockTerminalStream();
    const renderer = new StaticRenderer({ stream, noColor: true });
    const snapshot = createMockSnapshot();

    renderer.render(snapshot);

    expect(stream.output).toContain('AOE Session sess_test_123: [ACTIVE]');
    expect(stream.output).toContain('(agent: Claude-Code)');
    expect(stream.output).toContain('Progress: 50% (2/4) - Running tests');
    expect(stream.output).toContain('File [CREATED]: src/index.ts (+25 -0) [verified]');
    expect(stream.output).toContain('Diagnostic [WARNING] [HYPOTHESIS]: Potential memory leak');
  });

  it('updates when session status changes or new tasks finish', () => {
    const stream = new MockTerminalStream();
    const renderer = new StaticRenderer({ stream, noColor: true });
    const snapshot1 = createMockSnapshot({ status: 'active' });

    renderer.render(snapshot1);
    const initialOutput = stream.output;

    const snapshot2 = createMockSnapshot({
      status: 'completed',
      durationMs: 1200,
    });
    renderer.render(snapshot2);

    expect(stream.output.length).toBeGreaterThan(initialOutput.length);
    expect(stream.output).toContain('[COMPLETED]');
  });

  it('masks secrets in output stream', () => {
    const stream = new MockTerminalStream();
    const renderer = new StaticRenderer({ stream, noColor: true });
    const snapshot = createMockSnapshot({
      diagnostics: [
        {
          severity: 'error',
          message: 'Connection failed with password=superSecretPassword123',
          isHypothesis: false,
          timestamp: '2026-11-03T18:00:00.000Z',
        },
      ],
    });

    renderer.render(snapshot);

    expect(stream.output).toContain('password=******');
    expect(stream.output).not.toContain('superSecretPassword123');
  });

  it('preserves clean text without ANSI escape sequences when noColor is set', () => {
    const stream = new MockTerminalStream();
    const renderer = new StaticRenderer({ stream, noColor: true });
    const snapshot = createMockSnapshot();

    renderer.render(snapshot);

    // No ANSI control escapes (\x1b[)
    expect(stream.output).not.toMatch(/\x1b\[[0-9;]*[a-zA-Z]/);
  });
});
