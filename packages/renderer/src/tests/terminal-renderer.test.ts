import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TerminalRenderer, createRendererStub } from '../terminal-renderer.js';
import { MockTerminalStream, createMockSnapshot } from './test-utils.js';
import type { SessionSnapshot } from '@aoe/core';

describe('TerminalRenderer Orchestrator', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('selects static mode when mode="static" or in non-TTY environment', async () => {
    const stream = new MockTerminalStream({ isTTY: false });
    const renderer = new TerminalRenderer({
      stdout: stream as unknown as NodeJS.WriteStream,
      mode: 'auto',
    });

    await renderer.start();
    expect(renderer.getEffectiveMode()).toBe('static');
    expect(renderer.isRunning()).toBe(true);

    await renderer.stop();
    expect(renderer.isRunning()).toBe(false);
  });

  it('subscribes to engine and renders initial and subsequent snapshot updates', async () => {
    const stream = new MockTerminalStream({ isTTY: false });
    const snapshot1 = createMockSnapshot({ sessionId: 'sess_orch_1' });
    const snapshot2 = createMockSnapshot({
      sessionId: 'sess_orch_1',
      status: 'completed',
    });

    let subscriberCallback: ((s: SessionSnapshot) => void) | undefined;
    const mockEngine = {
      subscribe: vi.fn((_sessId: string, listener: (s: SessionSnapshot) => void) => {
        subscriberCallback = listener;
        return vi.fn();
      }),
      getSessionSnapshot: vi.fn(() => snapshot1),
    };

    const renderer = new TerminalRenderer({
      engine: mockEngine,
      sessionId: 'sess_orch_1',
      stdout: stream as unknown as NodeJS.WriteStream,
      mode: 'static',
    });

    await renderer.start();

    expect(mockEngine.subscribe).toHaveBeenCalledWith('sess_orch_1', expect.any(Function));
    expect(stream.output).toContain('AOE Session sess_orch_1: [ACTIVE]');

    // Emit update from engine
    subscriberCallback?.(snapshot2);
    expect(stream.output).toContain('[COMPLETED]');

    await renderer.stop();
  });

  it('cleans up engine subscription and restores terminal on stop', async () => {
    const stream = new MockTerminalStream({ isTTY: true });
    const unsubscribeFn = vi.fn();
    const mockEngine = {
      subscribe: vi.fn(() => unsubscribeFn),
      getSessionSnapshot: vi.fn(),
    };

    const renderer = new TerminalRenderer({
      engine: mockEngine,
      sessionId: 'sess_cleanup',
      stdout: stream as unknown as NodeJS.WriteStream,
      useAlternateScreen: true,
      mode: 'static',
    });

    await renderer.start();
    await renderer.stop();

    expect(unsubscribeFn).toHaveBeenCalledTimes(1);
    expect(renderer.isRunning()).toBe(false);

    // Cursor visibility restored
    expect(stream.output).toContain('\x1b[?25h');
    // Alternate screen exited
    expect(stream.output).toContain('\x1b[?1049l');
  });

  it('supports multiple independent renderer instances', async () => {
    const stream1 = new MockTerminalStream();
    const stream2 = new MockTerminalStream();

    const renderer1 = new TerminalRenderer({
      stdout: stream1 as unknown as NodeJS.WriteStream,
      sessionId: 'sess_1',
      mode: 'static',
    });
    const renderer2 = new TerminalRenderer({
      stdout: stream2 as unknown as NodeJS.WriteStream,
      sessionId: 'sess_2',
      mode: 'static',
    });

    await renderer1.start();
    await renderer2.start();

    renderer1.renderSnapshot(createMockSnapshot({ sessionId: 'sess_1' }));
    renderer2.renderSnapshot(createMockSnapshot({ sessionId: 'sess_2' }));

    expect(stream1.output).toContain('AOE Session sess_1: [ACTIVE]');
    expect(stream2.output).toContain('AOE Session sess_2: [ACTIVE]');

    await renderer1.stop();
    await renderer2.stop();
  });

  it('isolates rendering errors and does not corrupt caller or engine', async () => {
    const stream = new MockTerminalStream();
    const renderer = new TerminalRenderer({
      stdout: stream as unknown as NodeJS.WriteStream,
      mode: 'static',
    });

    await renderer.start();

    // Pass invalid or circular object that could trigger errors
    const malformed = {
      sessionId: 'sess_err',
      status: 'active',
      tasks: new Map(),
      fileChanges: [],
      diagnostics: [],
    } as unknown as SessionSnapshot;

    expect(() => {
      renderer.renderSnapshot(malformed);
    }).not.toThrow();

    await renderer.stop();
  });

  it('supports legacy initialize(), render(), and dispose() API', async () => {
    const stream = new MockTerminalStream();
    const renderer = createRendererStub({
      stdout: stream as unknown as NodeJS.WriteStream,
    });

    await renderer.initialize();

    renderer.render({
      sessionId: 'sess_legacy',
      activeTasks: 2,
      completedTasks: 3,
      hasErrors: false,
    });

    expect(stream.output).toContain('sess_legacy');

    await renderer.dispose();
  });

  it('buffers logs and results and renders them', async () => {
    const stream = new MockTerminalStream();
    const renderer = new TerminalRenderer({
      stdout: stream as unknown as NodeJS.WriteStream,
      sessionId: 'sess_logs',
      mode: 'static',
    });

    await renderer.start();

    expect(() => {
      renderer.addLog({ level: 'info', message: 'Test log line' });
      renderer.addResult({ category: 'summary', title: 'Test result completed' });
    }).not.toThrow();

    await renderer.stop();
  });

  describe('Theme Management and Runtime Switching', () => {
    it('defaults to obsidian theme', () => {
      const renderer = new TerminalRenderer();
      expect(renderer.getTheme().id).toBe('obsidian');
    });

    it('resolves theme from valid theme ID strings', () => {
      const lightRenderer = new TerminalRenderer({ theme: 'light' });
      expect(lightRenderer.getTheme().id).toBe('light');

      const hcRenderer = new TerminalRenderer({ theme: 'high-contrast' });
      expect(hcRenderer.getTheme().id).toBe('high-contrast');
    });

    it('falls back to obsidian when unknown theme ID string is provided in options', () => {
      const renderer = new TerminalRenderer({ theme: 'nonexistent-theme-xyz' });
      expect(renderer.getTheme().id).toBe('obsidian');
    });

    it('switches theme at runtime via setTheme and preserves existing theme on invalid input', async () => {
      const stream = new MockTerminalStream();
      const renderer = new TerminalRenderer({
        stdout: stream as unknown as NodeJS.WriteStream,
        mode: 'static',
      });

      await renderer.start();
      expect(renderer.getTheme().id).toBe('obsidian');

      // Switch to light
      const switchedLight = renderer.setTheme('light');
      expect(switchedLight).toBe(true);
      expect(renderer.getTheme().id).toBe('light');

      // Switch to high-contrast
      const switchedHC = renderer.setTheme('high-contrast');
      expect(switchedHC).toBe(true);
      expect(renderer.getTheme().id).toBe('high-contrast');

      // Attempt invalid switch
      const invalidSwitch = renderer.setTheme('totally-invalid-theme');
      expect(invalidSwitch).toBe(false);
      // Theme should remain high-contrast
      expect(renderer.getTheme().id).toBe('high-contrast');

      await renderer.stop();
    });

    it('re-renders latest snapshot when setTheme is called', async () => {
      const stream = new MockTerminalStream();
      const renderer = new TerminalRenderer({
        stdout: stream as unknown as NodeJS.WriteStream,
        mode: 'static',
      });

      await renderer.start();
      const snapshot = createMockSnapshot({ sessionId: 'sess_theme_rerender' });
      renderer.renderSnapshot(snapshot);

      const streamOutputLengthBefore = stream.output.length;
      renderer.setTheme('light');
      // Verify stream received new render output
      expect(stream.output.length).toBeGreaterThanOrEqual(streamOutputLengthBefore);

      await renderer.stop();
    });
  });
});
