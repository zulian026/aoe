import React from 'react';
import { render as inkRender, type Instance as InkInstance } from 'ink';
import type { SessionSnapshot } from '@zyanx04/core';
import {
  OBSIDIAN_THEME,
  defaultRegistry,
  validateTheme,
  type AoeTheme,
  type ThemeDefinition,
} from '@zyanx04/themes';
import type { LogItem, ResultItem } from '@zyanx04/components';
import {
  isInteractiveSuitable,
  isNoColor,
  getTerminalDimensions,
  type TerminalDimensions,
} from './environment.js';
import { StaticRenderer } from './static-renderer.js';
import { InteractiveApp } from './interactive-app.js';

export type RendererMode = 'auto' | 'interactive' | 'static';

export interface EngineLike {
  subscribe(sessionId: string, listener: (snapshot: SessionSnapshot) => void): () => void;
  getSessionSnapshot?(sessionId: string): SessionSnapshot | null | undefined;
}

export interface TerminalRendererOptions {
  engine?: EngineLike;
  sessionId?: string;
  mode?: RendererMode;
  theme?: string | AoeTheme | ThemeDefinition;
  stdout?: NodeJS.WriteStream;
  stdin?: NodeJS.ReadStream;
  useAlternateScreen?: boolean;
  animated?: boolean;
  noColor?: boolean;
  unicode?: boolean;
  maxLogLines?: number;
}

export interface RenderState {
  sessionId: string;
  activeTasks: number;
  completedTasks: number;
  hasErrors: boolean;
}

export class TerminalRenderer {
  private readonly engine?: EngineLike;
  private readonly sessionId?: string;
  private readonly requestedMode: RendererMode;
  private theme: AoeTheme;
  private readonly stdout: NodeJS.WriteStream;
  private readonly stdin?: NodeJS.ReadStream;
  private readonly useAlternateScreen: boolean;
  private readonly animated: boolean;
  private readonly noColor: boolean;
  private readonly unicode: boolean;

  private effectiveMode: 'interactive' | 'static' = 'static';
  private running = false;
  private unsubscribe?: () => void;
  private inkInstance?: InkInstance;
  private staticRenderer?: StaticRenderer;
  private latestSnapshot?: SessionSnapshot;
  private dimensions: TerminalDimensions;

  // Buffered logs & results if provided
  private bufferedLogs: LogItem[] = [];
  private bufferedResults: ResultItem[] = [];

  // Signal and resize handler references for clean removal
  private boundResizeHandler?: () => void;
  private boundSigintHandler?: () => void;
  private boundSigtermHandler?: () => void;

  constructor(options: TerminalRendererOptions = {}) {
    this.engine = options.engine;
    this.sessionId = options.sessionId;
    this.requestedMode = options.mode ?? 'auto';
    this.theme = this.resolveThemeInput(options.theme);
    this.stdout = options.stdout ?? process.stdout;
    this.stdin = options.stdin ?? process.stdin;
    this.useAlternateScreen = options.useAlternateScreen ?? false;
    this.animated = options.animated ?? false;
    this.noColor = options.noColor ?? isNoColor();
    this.unicode = options.unicode ?? true;
    this.dimensions = getTerminalDimensions(this.stdout);
  }

  /**
   * Resolves theme input from ID or theme object with obsidian fallback.
   */
  private resolveThemeInput(themeInput?: string | AoeTheme | ThemeDefinition): AoeTheme {
    if (!themeInput) return OBSIDIAN_THEME;
    if (typeof themeInput === 'string') {
      try {
        return defaultRegistry.get(themeInput);
      } catch (err) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn(
            `[TerminalRenderer] Unknown theme id "${themeInput}", falling back to obsidian: ${(err as Error).message}`,
          );
        }
        return OBSIDIAN_THEME;
      }
    }
    try {
      return validateTheme(themeInput);
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(
          `[TerminalRenderer] Invalid theme object, falling back to obsidian: ${(err as Error).message}`,
        );
      }
      return OBSIDIAN_THEME;
    }
  }

  /**
   * Gets the currently active theme.
   */
  public getTheme(): AoeTheme {
    return this.theme;
  }

  /**
   * Switches theme at runtime and re-renders active snapshot immediately without restarting subscriptions.
   */
  public setTheme(themeInput: string | AoeTheme | ThemeDefinition): boolean {
    if (!themeInput) return false;
    let resolved: AoeTheme;
    try {
      if (typeof themeInput === 'string') {
        resolved = defaultRegistry.get(themeInput);
      } else {
        resolved = validateTheme(themeInput);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[TerminalRenderer] Failed to set theme: ${(err as Error).message}`);
      }
      return false;
    }

    this.theme = resolved;
    if (this.staticRenderer) {
      this.staticRenderer.setTheme(resolved);
    }
    if (this.latestSnapshot) {
      this.renderSnapshot(this.latestSnapshot);
    }
    return true;
  }

  /**
   * Starts the renderer, resolves mode, hooks engine and terminal lifecycle.
   */
  public async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Resolve mode
    if (this.requestedMode === 'interactive') {
      this.effectiveMode = 'interactive';
    } else if (this.requestedMode === 'static') {
      this.effectiveMode = 'static';
    } else {
      // Auto detection
      this.effectiveMode = isInteractiveSuitable(this.stdout) ? 'interactive' : 'static';
    }

    // Initialize the appropriate renderer engine
    if (this.effectiveMode === 'static') {
      this.staticRenderer = new StaticRenderer({
        stream: this.stdout,
        theme: this.theme,
        noColor: this.noColor,
      });
    } else {
      // Alternate screen buffer
      if (this.useAlternateScreen) {
        this.stdout.write('\x1b[?1049h');
      }
    }

    // Register terminal resize handler
    this.boundResizeHandler = () => this.handleResize();
    if (typeof this.stdout.on === 'function') {
      this.stdout.on('resize', this.boundResizeHandler);
    }

    // Register process termination handlers for graceful cleanup
    this.boundSigintHandler = () => {
      void this.stop().then(() => {
        process.exit(130);
      });
    };
    this.boundSigtermHandler = () => {
      void this.stop().then(() => {
        process.exit(143);
      });
    };

    if (typeof process.on === 'function') {
      process.on('SIGINT', this.boundSigintHandler);
      process.on('SIGTERM', this.boundSigtermHandler);
    }

    // Subscribe to engine if provided
    if (this.engine && this.sessionId) {
      this.unsubscribe = this.engine.subscribe(this.sessionId, (snapshot) => {
        this.renderSnapshot(snapshot);
      });

      // Render initial snapshot if already present
      if (typeof this.engine.getSessionSnapshot === 'function') {
        const initial = this.engine.getSessionSnapshot(this.sessionId);
        if (initial) {
          this.renderSnapshot(initial);
        }
      }
    }
  }

  /**
   * Renders or updates a SessionSnapshot.
   */
  public renderSnapshot(snapshot: SessionSnapshot): void {
    if (!this.running) return;
    this.latestSnapshot = snapshot;

    try {
      if (this.effectiveMode === 'static') {
        this.staticRenderer?.render(snapshot);
      } else {
        const element = React.createElement(InteractiveApp, {
          snapshot,
          theme: this.theme,
          noColor: this.noColor,
          unicode: this.unicode,
          animated: this.animated,
          width: this.dimensions.columns,
          logs: this.bufferedLogs,
          results: this.bufferedResults,
        });

        if (!this.inkInstance) {
          this.inkInstance = inkRender(element, {
            stdout: this.stdout,
            stdin: this.stdin,
            patchConsole: false,
          });
        } else {
          this.inkInstance.rerender(element);
        }
      }
    } catch (err) {
      // Guard Core Engine from rendering errors
      if (process.env.NODE_ENV !== 'test') {
        console.error('[TerminalRenderer] Rendering error:', err);
      }
    }
  }

  /**
   * Appends execution log entries.
   */
  public addLog(log: LogItem): void {
    this.bufferedLogs.push(log);
    if (this.latestSnapshot) {
      this.renderSnapshot(this.latestSnapshot);
    }
  }

  /**
   * Appends result item.
   */
  public addResult(result: ResultItem): void {
    this.bufferedResults.push(result);
    if (this.latestSnapshot) {
      this.renderSnapshot(this.latestSnapshot);
    }
  }

  /**
   * Terminal resize handler.
   */
  private handleResize(): void {
    this.dimensions = getTerminalDimensions(this.stdout);
    if (this.latestSnapshot) {
      this.renderSnapshot(this.latestSnapshot);
    }
  }

  /**
   * Stops rendering, restores terminal state, and unmounts listeners.
   */
  public async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    // Unsubscribe from engine
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }

    // Remove resize listeners
    if (this.boundResizeHandler && typeof this.stdout.removeListener === 'function') {
      this.stdout.removeListener('resize', this.boundResizeHandler);
      this.boundResizeHandler = undefined;
    }

    // Remove signal handlers
    if (typeof process.removeListener === 'function') {
      if (this.boundSigintHandler) {
        process.removeListener('SIGINT', this.boundSigintHandler);
        this.boundSigintHandler = undefined;
      }
      if (this.boundSigtermHandler) {
        process.removeListener('SIGTERM', this.boundSigtermHandler);
        this.boundSigtermHandler = undefined;
      }
    }

    // Unmount Ink app
    if (this.inkInstance) {
      this.inkInstance.unmount();
      this.inkInstance = undefined;
    }

    // Restore terminal screen, cursor, and input raw mode
    try {
      if (this.useAlternateScreen) {
        this.stdout.write('\x1b[?1049l');
      }
      // Ensure cursor is visible
      this.stdout.write('\x1b[?25h');

      const stdinAny = this.stdin as unknown as {
        isRaw?: boolean;
        setRawMode?: (mode: boolean) => void;
      };
      if (stdinAny && typeof stdinAny.setRawMode === 'function' && stdinAny.isRaw) {
        stdinAny.setRawMode(false);
      }
    } catch {
      // Stream may be closed
    }
  }

  // --- Backward Compatibility API ---

  public async initialize(): Promise<void> {
    await this.start();
  }

  public render(state: RenderState | SessionSnapshot): void {
    if ('sessionId' in state && 'tasks' in state) {
      this.renderSnapshot(state as SessionSnapshot);
    } else {
      // Synthesize minimal SessionSnapshot from legacy RenderState
      const legacyState = state as RenderState;
      const syntheticSnapshot: SessionSnapshot = {
        sessionId: legacyState.sessionId,
        status: legacyState.hasErrors ? 'failed' : 'active',
        agent: { name: 'aoe-agent' },
        workingDirectory: typeof process !== 'undefined' ? process.cwd() : '/',
        startedAt: new Date().toISOString(),
        lastSequence: 0,
        totalEvents: 0,
        tasks: new Map(),
        rootTaskIds: [],
        activeTaskCount: legacyState.activeTasks,
        completedTaskCount: legacyState.completedTasks,
        failedTaskCount: legacyState.hasErrors ? 1 : 0,
        progress: null,
        fileChanges: [],
        diagnostics: [],
        stats: {
          tasksTotal: legacyState.activeTasks + legacyState.completedTasks,
          tasksCompleted: legacyState.completedTasks,
          tasksFailed: legacyState.hasErrors ? 1 : 0,
          filesChanged: 0,
          errorsCount: legacyState.hasErrors ? 1 : 0,
          warningsCount: 0,
        },
      };
      this.renderSnapshot(syntheticSnapshot);
    }
  }

  public async dispose(): Promise<void> {
    await this.stop();
  }

  public getEffectiveMode(): 'interactive' | 'static' {
    return this.effectiveMode;
  }

  public isRunning(): boolean {
    return this.running;
  }
}

/**
 * Creates a backward-compatible renderer instance.
 */
export const createRendererStub = (options: TerminalRendererOptions = {}): TerminalRenderer => {
  return new TerminalRenderer({
    ...options,
    mode: 'static',
  });
};
