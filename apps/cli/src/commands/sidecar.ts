import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Command } from 'commander';
import { SidecarConsumer } from '@zyanx04/core';
import { resolveSocketPath } from '@zyanx04/adapters';
import { ExitCode } from '../runtime/exit-codes.js';

export interface SidecarCommandOptions {
  socket?: string;
  session?: string;
  dir?: string;
  once?: boolean;
  json?: boolean;
}

/**
 * Searches for active AOE Unix Domain Sockets in designated runtime directories.
 */
export function discoverActiveSocket(customDir?: string): string | null {
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
  if (fs.existsSync('/tmp')) {
    candidates.push('/tmp');
  }
  candidates.push(os.tmpdir());

  const foundSockets: Array<{ path: string; mtimeMs: number }> = [];

  for (const dir of candidates) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.startsWith('aoe-') && file.endsWith('.sock')) {
          const fullPath = path.join(dir, file);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isSocket()) {
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
    .description('Attach an independent terminal sidecar consumer to an active AOE session')
    .option('-s, --socket <path>', 'Explicit Unix Domain Socket path for IPC')
    .option('--session <id>', 'Attach to session by conversation ID')
    .option('--dir <path>', 'Custom directory to search for session sockets')
    .option('--once', 'Connect, snapshot current state, and exit cleanly')
    .option('--json', 'Format output snapshot as JSON')
    .action(async (options: SidecarCommandOptions) => {
      let socketPath: string | null = null;

      if (options.socket) {
        socketPath = path.resolve(options.socket);
      } else if (options.session) {
        socketPath = resolveSocketPath(options.session);
      } else {
        socketPath = discoverActiveSocket(options.dir);
      }

      if (!socketPath || (!fs.existsSync(socketPath) && !options.socket)) {
        if (options.json) {
          process.stdout.write(
            JSON.stringify({ status: 'no_session', message: 'No active session found' }) + '\n',
          );
        } else {
          process.stdout.write('[AOE Sidecar] No active agent session found.\n');
          process.stdout.write(
            'No active socket detected. Start an AI agent session with AOE enabled, or specify --socket <path>.\n',
          );
        }
        process.exitCode = ExitCode.SUCCESS;
        return;
      }

      const consumer = new SidecarConsumer({
        socketPath,
        autoReconnect: !options.once,
        connectTimeoutMs: 2500,
      });

      let isCleanedUp = false;
      const cleanup = async () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        try {
          await consumer.stop();
        } catch {}
        if (!options.json) {
          process.stdout.write('\n[AOE Sidecar] Disconnected from session.\n');
        }
        process.exit(ExitCode.SUCCESS);
      };

      process.on('SIGINT', () => {
        cleanup().catch(() => process.exit(0));
      });
      process.on('SIGTERM', () => {
        cleanup().catch(() => process.exit(0));
      });

      if (!options.json) {
        process.stdout.write(`[AOE Sidecar] Connecting to socket: ${socketPath}\n`);
      }

      consumer.on('connect', () => {
        if (!options.json) {
          process.stdout.write('[AOE Sidecar] Connected to active session.\n');
          process.stdout.write('[AOE Sidecar] Monitoring event stream (Ctrl+C to detach)...\n');
        }
      });

      consumer.on('event', (event) => {
        if (options.once) {
          if (options.json) {
            process.stdout.write(JSON.stringify(consumer.getSnapshot(), null, 2) + '\n');
          } else {
            process.stdout.write(`[Snapshot] Last event: ${event.eventType} (seq ${event.sequence})\n`);
          }
          cleanup().catch(() => process.exit(0));
          return;
        }

        if (!options.json) {
          process.stdout.write(
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

      try {
        await consumer.start();
      } catch (err) {
        if (options.json) {
          process.stdout.write(
            JSON.stringify({ status: 'error', error: (err as Error).message }) + '\n',
          );
        } else {
          process.stderr.write(`[AOE Sidecar] Connection error: ${(err as Error).message}\n`);
        }
        process.exitCode = ExitCode.SUCCESS;
      }
    });
}
