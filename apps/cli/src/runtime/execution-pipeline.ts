import { Engine, type SessionSnapshot } from '@zyanx04/core';
import {
  TerminalRenderer,
  StaticRenderer,
  isInteractiveSuitable,
  type RendererMode,
} from '@zyanx04/renderer';
import { defaultRegistry, type AoeTheme } from '@zyanx04/themes';
import { CliError } from '../utils/errors.js';
import { ExitCode } from './exit-codes.js';
import { signalHandler } from './signal-handler.js';
import type { AoeEvent } from '@zyanx04/protocol';

export interface ExecutionPipelineOptions {
  mode?: RendererMode;
  theme?: string;
  stdout?: NodeJS.WriteStream;
  stdin?: NodeJS.ReadStream;
  noColor?: boolean;
}

export class ExecutionPipeline {
  public readonly engine: Engine;
  private readonly theme: AoeTheme;
  private readonly requestedMode: RendererMode;
  private readonly stdout: NodeJS.WriteStream;
  private readonly stdin?: NodeJS.ReadStream;
  private readonly noColor?: boolean;

  private renderer?: TerminalRenderer | StaticRenderer;
  private isInteractive = false;
  private running = false;
  private activeSubscriptions = new Map<string, () => void>();
  private unregisterSignal?: () => void;

  constructor(options: ExecutionPipelineOptions = {}) {
    this.engine = new Engine();
    this.requestedMode = options.mode ?? 'auto';
    this.stdout = options.stdout ?? process.stdout;
    this.stdin = options.stdin ?? (process.stdin as NodeJS.ReadStream);
    this.noColor = options.noColor;

    // Resolve theme
    const themeName = options.theme ?? 'obsidian';
    try {
      this.theme = defaultRegistry.get(themeName);
    } catch {
      throw new CliError(`Unknown theme "${themeName}"`, {
        exitCode: ExitCode.INVALID_ARGUMENTS,
        hint: `Available themes: ${defaultRegistry
          .list()
          .map((t) => t.id)
          .join(', ')}`,
      });
    }
  }

  /**
   * Initializes the pipeline and starts the appropriate renderer.
   */
  public async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Determine effective mode
    if (this.requestedMode === 'static') {
      this.isInteractive = false;
    } else if (this.requestedMode === 'interactive') {
      this.isInteractive = true;
    } else {
      // Auto: interactive only if stdout is TTY and not CI
      this.isInteractive = isInteractiveSuitable(this.stdout);
    }

    if (this.isInteractive) {
      const termRenderer = new TerminalRenderer({
        theme: this.theme,
        stdout: this.stdout,
        stdin: this.stdin,
        mode: 'interactive',
        animated: true,
        noColor: this.noColor,
      });
      await termRenderer.start();
      this.renderer = termRenderer;
    } else {
      this.renderer = new StaticRenderer({
        stream: this.stdout,
        theme: this.theme,
        noColor: this.noColor,
      });
    }

    // Register graceful signal teardown
    this.unregisterSignal = signalHandler.register(async () => {
      await this.stop();
    });
  }

  /**
   * Dispatches a canonical event into the engine and updates renderer.
   */
  public processEvent(event: AoeEvent): void {
    if (!this.running) return;

    // Track new sessions and subscribe to snapshot changes
    if (!this.activeSubscriptions.has(event.sessionId)) {
      const unsub = this.engine.subscribe(event.sessionId, (snapshot: SessionSnapshot) => {
        this.renderSnapshot(snapshot);
      });
      this.activeSubscriptions.set(event.sessionId, unsub);
    }

    // Feed into core engine
    this.engine.processEvent(event);

    // Ensure initial or intermediate snapshot is rendered
    const snapshot = this.engine.getSessionSnapshot(event.sessionId);
    if (snapshot) {
      this.renderSnapshot(snapshot);
    }
  }

  private renderSnapshot(snapshot: SessionSnapshot): void {
    if (!this.renderer) return;

    if (this.renderer instanceof TerminalRenderer) {
      this.renderer.renderSnapshot(snapshot);
    } else if (this.renderer instanceof StaticRenderer) {
      this.renderer.render(snapshot);
    }
  }

  /**
   * Stops the execution pipeline and releases resources.
   */
  public async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    // Unsubscribe from engine sessions
    for (const unsub of this.activeSubscriptions.values()) {
      try {
        unsub();
      } catch {
        // Safe unsubscribe
      }
    }
    this.activeSubscriptions.clear();

    // Stop renderer
    if (this.renderer && this.renderer instanceof TerminalRenderer) {
      await this.renderer.stop();
    }

    if (this.unregisterSignal) {
      this.unregisterSignal();
      this.unregisterSignal = undefined;
    }
  }
}
