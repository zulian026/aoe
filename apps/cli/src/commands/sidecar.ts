import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Command } from 'commander';
import { SidecarConsumer } from '@zyanx04/core';
import { resolveSocketPath } from '@zyanx04/adapters';
import {
  SidecarTerminalRenderer,
  renderToStringSidecarApp,
  isInteractiveSuitable,
} from '@zyanx04/renderer';
import { ExitCode } from '../runtime/exit-codes.js';
import { loadConfig } from '../config/index.js';

export interface SidecarCommandOptions {
  socket?: string;
  session?: string;
  dir?: string;
  theme?: string;
  once?: boolean;
  json?: boolean;
  static?: boolean;
  listen?: boolean;
}

/**
 * Searches for active AOE Unix Domain Sockets in designated runtime directories.
 * Implements cross-platform safety for Windows named pipes and POSIX sockets.
 */
export function discoverActiveSocket(customDir?: string): string | null {
  if (process.platform === 'win32') {
    // Windows named pipes (\\.\pipe\*) cannot be enumerated via fs.readdirSync.
    // If a custom directory is specified, search it safely. Otherwise return null.
    if (!customDir || !fs.existsSync(customDir)) {
      return null;
    }
  }

  const candidates: string[] = [];
  if (customDir && fs.existsSync(customDir)) {
    candidates.push(customDir);
  }
  if (process.env.AOE_SESSION_DIR && fs.existsSync(process.env.AOE_SESSION_DIR)) {
    candidates.push(process.env.AOE_SESSION_DIR);
  }
  if (process.env.XDG_RUNTIME_DIR && fs.existsSync(process.env.XDG_RUNTIME_DIR)) {
    candidates.push(process.env.XDG_RUNTIME_DIR);
  }
  if (process.platform !== 'win32' && fs.existsSync('/tmp')) {
    candidates.push('/tmp');
  }
  try {
    const tmp = os.tmpdir();
    if (fs.existsSync(tmp)) {
      candidates.push(tmp);
    }
  } catch {}

  const foundSockets: Array<{ path: string; mtimeMs: number }> = [];

  for (const dir of candidates) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.startsWith('aoe-') && (file.endsWith('.sock') || file.endsWith('.ipc'))) {
          const fullPath = path.join(dir, file);
          try {
            const stat = fs.statSync(fullPath);
            if (typeof stat.isSocket === 'function' ? stat.isSocket() : true) {
              foundSockets.push({ path: fullPath, mtimeMs: stat.mtimeMs });
            }
          } catch {}
        }
      }
    } catch {}
  }

  if (foundSockets.length === 0) {
    return null;
  }

  // Sort by most recently modified
  foundSockets.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return foundSockets[0].path;
}

export function registerSidecarCommand(program: Command): void {
  program
    .command('sidecar')
    .description(
      'Attach an independent terminal sidecar presentation layer to an active AOE session',
    )
    .option('-s, --socket <path>', 'Explicit Unix Domain Socket path for IPC')
    .option('--session <id>', 'Attach to session by conversation ID')
    .option('--dir <path>', 'Custom directory to search for session sockets')
    .option('-t, --theme <name>', 'Theme identifier for terminal presentation')
    .option('--once', 'Connect, snapshot current state, and exit cleanly')
    .option('--json', 'Format output snapshot as JSON')
    .option('--static', 'Render static non-interactive view without TTY loop')
    .option('-l, --listen', 'Listen as IPC server on socket path instead of connecting')
    .action(async (options: SidecarCommandOptions) => {
      await executeSidecar(options);
    });
}

export async function executeSidecar(
  options: SidecarCommandOptions = {},
  customStdout: NodeJS.WriteStream = process.stdout,
  customStdin?: NodeJS.ReadStream,
): Promise<number> {
  const { config } = loadConfig();
  const theme = options.theme ?? config.theme ?? 'obsidian';

  let socketPath: string | null = null;

  if (options.socket) {
    socketPath = path.resolve(options.socket);
  } else if (options.session) {
    socketPath = resolveSocketPath(options.session);
  } else if (options.listen) {
    socketPath = resolveSocketPath('default');
  } else {
    socketPath = discoverActiveSocket(options.dir);
  }

  if (!socketPath || (!fs.existsSync(socketPath) && !options.socket && !options.listen)) {
    if (options.json) {
      customStdout.write(
        JSON.stringify({ status: 'no_session', message: 'No active session found' }) + '\n',
      );
    } else {
      customStdout.write('[AOE Sidecar] No active agent session found.\n');
      customStdout.write(
        'No active socket detected. Start an AI agent session with AOE enabled, or specify --socket <path> / --listen.\n',
      );
    }
    return ExitCode.SUCCESS;
  }

  const isInteractive =
    !options.json && !options.once && !options.static && isInteractiveSuitable(customStdout);

  const mode = options.listen ? 'server' : 'client';
  const consumer = new SidecarConsumer({
    socketPath,
    mode,
    autoReconnect: !options.once && isInteractive && mode === 'client',
    connectTimeoutMs: 2500,
  });

  // Handle --once mode
  if (options.once) {
    return new Promise<number>((resolve) => {
      let resolved = false;
      const finish = async () => {
        if (resolved) return;
        resolved = true;
        try {
          await consumer.stop();
        } catch {}
        resolve(ExitCode.SUCCESS);
      };

      let debounceTimer: NodeJS.Timeout | null = null;
      const triggerOutput = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (resolved) return;
          if (options.json) {
            customStdout.write(JSON.stringify(consumer.getSnapshot(), null, 2) + '\n');
          } else {
            const rendered = renderToStringSidecarApp({
              snapshot: consumer.getSnapshot(),
              connectionStatus: consumer.getStatus(),
              theme,
              width: customStdout.columns ?? 80,
            });
            customStdout.write(rendered + '\n');
          }
          finish().catch(() => resolve(ExitCode.SUCCESS));
        }, 50);
      };

      consumer.on('event', triggerOutput);

      consumer.start().catch((err) => {
        if (options.json) {
          customStdout.write(
            JSON.stringify({ status: 'error', error: (err as Error).message }) + '\n',
          );
        } else {
          customStdout.write(`[AOE Sidecar] Connection error: ${(err as Error).message}\n`);
        }
        finish().catch(() => resolve(ExitCode.SUCCESS));
      });

      // Fallback timeout for --once if socket emits no immediate event
      setTimeout(() => {
        if (!resolved) {
          triggerOutput();
        }
      }, 350);
    });
  }

  // Interactive TTY mode: Start live Ink presentation
  if (isInteractive) {
    const renderer = new SidecarTerminalRenderer({
      consumer,
      theme,
      stdout: customStdout,
      stdin: customStdin,
      onExit: () => {
        customStdout.write('\n[AOE Sidecar] Detached cleanly from session.\n');
      },
    });

    try {
      await renderer.start();
    } catch (err) {
      customStdout.write(`[AOE Sidecar] Failed to start sidecar: ${(err as Error).message}\n`);
      return ExitCode.SUCCESS;
    }

    return ExitCode.SUCCESS;
  }

  // Non-Interactive / Non-TTY stream fallback
  return new Promise<number>((resolve) => {
    let isCleanedUp = false;
    const cleanup = async () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      try {
        await consumer.stop();
      } catch {}
      if (!options.json) {
        customStdout.write('\n[AOE Sidecar] Disconnected from session.\n');
      }
      resolve(ExitCode.SUCCESS);
    };

    process.on('SIGINT', () => cleanup());
    process.on('SIGTERM', () => cleanup());

    if (!options.json) {
      customStdout.write(`[AOE Sidecar] Connecting to socket: ${socketPath}\n`);
    }

    consumer.on('connect', () => {
      if (!options.json) {
        customStdout.write('[AOE Sidecar] Connected to active session.\n');
        customStdout.write('[AOE Sidecar] Monitoring event stream...\n');
      }
    });

    consumer.on('event', (event) => {
      if (options.json) {
        customStdout.write(JSON.stringify(event) + '\n');
      } else {
        customStdout.write(
          `[Event] ${event.eventType.padEnd(16)} (seq: ${String(event.sequence).padStart(3)}) | task: ${
            (event.payload as { taskId?: string }).taskId ?? '-'
          }\n`,
        );
      }
    });

    consumer.on('diagnostic', (diag) => {
      if (!options.json && diag.level !== 'info') {
        process.stderr.write(`[Sidecar ${diag.level.toUpperCase()}] ${diag.message}\n`);
      }
    });

    consumer.start().catch((err) => {
      if (options.json) {
        customStdout.write(
          JSON.stringify({ status: 'error', error: (err as Error).message }) + '\n',
        );
      } else {
        process.stderr.write(`[AOE Sidecar] Connection error: ${(err as Error).message}\n`);
      }
      cleanup();
    });
  });
}
