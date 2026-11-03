import { describe, it, expect } from 'vitest';
import { renderToString } from 'ink';
import { StatusIndicator, type StatusType } from '../StatusIndicator.js';

describe('StatusIndicator', () => {
  const statuses: StatusType[] = [
    'running',
    'completed',
    'failed',
    'blocked',
    'warning',
    'idle',
    'cancelled',
  ];

  it('renders all canonical statuses in unicode mode', () => {
    for (const status of statuses) {
      const output = renderToString(<StatusIndicator status={status} unicode={true} />);
      expect(output.length).toBeGreaterThan(0);
    }
  });

  it('renders distinct symbols for completed vs failed', () => {
    const okOutput = renderToString(<StatusIndicator status="completed" unicode={true} />);
    const failOutput = renderToString(<StatusIndicator status="failed" unicode={true} />);
    expect(okOutput).toContain('✔');
    expect(failOutput).toContain('✖');
  });

  it('renders plain ASCII fallbacks when unicode is disabled', () => {
    const ok = renderToString(<StatusIndicator status="completed" unicode={false} />);
    const fail = renderToString(<StatusIndicator status="failed" unicode={false} />);
    const run = renderToString(<StatusIndicator status="running" unicode={false} />);
    const blocked = renderToString(<StatusIndicator status="blocked" unicode={false} />);
    const warn = renderToString(<StatusIndicator status="warning" unicode={false} />);
    const idle = renderToString(<StatusIndicator status="idle" unicode={false} />);
    const cancelled = renderToString(<StatusIndicator status="cancelled" unicode={false} />);

    expect(ok).toContain('[OK]');
    expect(fail).toContain('[FAIL]');
    expect(run).toContain('[RUN]');
    expect(blocked).toContain('[BLOCKED]');
    expect(warn).toContain('[WARN]');
    expect(idle).toContain('[IDLE]');
    expect(cancelled).toContain('[CANCELLED]');
  });

  it('renders with label when provided', () => {
    const output = renderToString(
      <StatusIndicator status="running" label="Processing pipeline" unicode={false} />,
    );
    expect(output).toContain('[RUN]');
    expect(output).toContain('Processing pipeline');
  });

  it('supports animated spinner frames for running state', () => {
    const frame0 = renderToString(
      <StatusIndicator status="running" animated={true} spinnerFrame={0} unicode={true} />,
    );
    const frame1 = renderToString(
      <StatusIndicator status="running" animated={true} spinnerFrame={1} unicode={true} />,
    );
    expect(frame0).toContain('⠋');
    expect(frame1).toContain('⠙');
  });

  it('renders without color when noColor is true', () => {
    const output = renderToString(
      <StatusIndicator status="completed" noColor={true} unicode={false} />,
    );
    expect(output).toContain('[OK]');
  });
});
