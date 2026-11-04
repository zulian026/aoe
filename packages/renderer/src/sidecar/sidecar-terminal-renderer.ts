import React from 'react';
import { render as inkRender, renderToString, type Instance as InkInstance } from 'ink';
import type {
  SidecarConsumer,
  SidecarReadModelSnapshot,
  SidecarConnectionStatus,
} from '@zyanx04/core';
import { defaultRegistry, OBSIDIAN_THEME, type AoeTheme } from '@zyanx04/themes';
import { isInteractiveSuitable } from '../environment.js';
import { SidecarApp } from './SidecarApp.js';

export interface SidecarTerminalRendererOptions {
  consumer: SidecarConsumer;
  theme?: string | AoeTheme;
  stdout?: NodeJS.WriteStream;
  stdin?: NodeJS.ReadStream;
  noColor?: boolean;
  unicode?: boolean;
  onExit?: () => void;
}

export interface RenderToStringOptions {
  snapshot: SidecarReadModelSnapshot;
  connectionStatus?: SidecarConnectionStatus | 'session_ended';
  theme?: string | AoeTheme;
  width?: number;
  noColor?: boolean;
  unicode?: boolean;
}

/**
 * Orchestrates live interactive terminal rendering for the AOE Sidecar.
 */
export class SidecarTerminalRenderer {
  private readonly consumer: SidecarConsumer;
  private readonly theme: AoeTheme;
  private readonly stdout: NodeJS.WriteStream;
  private readonly stdin?: NodeJS.ReadStream;
  private readonly noColor: boolean;
  private readonly unicode: boolean;
  private readonly onExit?: () => void;

  private inkInstance: InkInstance | null = null;
  private isRunning = false;
  private cleanupSignalHandlers: (() => void) | null = null;

  constructor(options: SidecarTerminalRendererOptions) {
    this.consumer = options.consumer;
    this.stdout = options.stdout ?? process.stdout;
    this.stdin = options.stdin ?? (process.stdin as NodeJS.ReadStream);
    this.noColor = Boolean(options.noColor);
    this.unicode = options.unicode ?? true;
    this.onExit = options.onExit;

    if (typeof options.theme === 'string') {
      try {
        this.theme = defaultRegistry.get(options.theme);
      } catch {
        this.theme = OBSIDIAN_THEME;
      }
    } else if (options.theme) {
      this.theme = options.theme;
    } else {
      this.theme = OBSIDIAN_THEME;
    }
  }

  /**
   * Starts live interactive terminal UI.
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Start IPC consumer connection
    await this.consumer.start();

    // Render interactive Ink UI
    const appElement = React.createElement(SidecarApp, {
      consumer: this.consumer,
      theme: this.theme,
      noColor: this.noColor,
      unicode: this.unicode,
    });

    this.inkInstance = inkRender(appElement, {
      stdout: this.stdout,
      stdin: this.stdin,
      exitOnCtrlC: false,
    });

    // Setup signal traps for clean detachment
    const sigintHandler = () => {
      this.stop().catch(() => process.exit(0));
    };
    const sigtermHandler = () => {
      this.stop().catch(() => process.exit(0));
    };

    process.on('SIGINT', sigintHandler);
    process.on('SIGTERM', sigtermHandler);

    this.cleanupSignalHandlers = () => {
      process.off('SIGINT', sigintHandler);
      process.off('SIGTERM', sigtermHandler);
    };
  }

  /**
   * Gracefully tears down interactive sidecar rendering and detaches from socket.
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.cleanupSignalHandlers) {
      this.cleanupSignalHandlers();
      this.cleanupSignalHandlers = null;
    }

    try {
      await this.consumer.stop();
    } catch {}

    if (this.inkInstance) {
      this.inkInstance.unmount();
      this.inkInstance = null;
    }

    if (this.onExit) {
      this.onExit();
    }
  }

  public isInteractive(): boolean {
    return isInteractiveSuitable(this.stdout);
  }
}

/**
 * Synchronously renders a read model snapshot into a formatted string representation.
 */
export function renderToStringSidecarApp(options: RenderToStringOptions): string {
  let themeObj: AoeTheme = OBSIDIAN_THEME;
  if (typeof options.theme === 'string') {
    try {
      themeObj = defaultRegistry.get(options.theme);
    } catch {
      themeObj = OBSIDIAN_THEME;
    }
  } else if (options.theme) {
    themeObj = options.theme;
  }

  const appElement = React.createElement(SidecarApp, {
    snapshot: options.snapshot,
    connectionStatus: options.connectionStatus,
    theme: themeObj,
    noColor: options.noColor,
    unicode: options.unicode ?? true,
    terminalWidth: options.width ?? 80,
  });

  return renderToString(appElement);
}
