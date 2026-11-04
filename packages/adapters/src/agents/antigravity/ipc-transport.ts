import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import type { AoeEvent } from '@zyanx04/protocol';
import { sanitizeSessionId } from './state-store.js';

export interface IpcClient {
  send(events: AoeEvent[]): Promise<boolean>;
  close(): Promise<void>;
}

/**
 * Resolves a secure, platform-portable socket path with strict byte-length bounds.
 */
export function resolveSocketPath(sessionId?: string): string {
  const custom = process.env.AOE_SOCKET_PATH;
  if (custom && custom.trim().length > 0) {
    return custom.trim();
  }

  const safeId = sanitizeSessionId(sessionId);

  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\aoe-${safeId}`;
  }

  const preferredDir =
    process.env.XDG_RUNTIME_DIR && fs.existsSync(process.env.XDG_RUNTIME_DIR)
      ? process.env.XDG_RUNTIME_DIR
      : fs.existsSync('/tmp')
        ? '/tmp'
        : os.tmpdir();

  const candidatePath = path.join(preferredDir, `aoe-${safeId}.sock`);

  // Maximum UNIX domain socket length: 104 bytes on macOS/BSD, 108 bytes on Linux.
  // We enforce a conservative 96-byte ceiling.
  if (Buffer.byteLength(candidatePath, 'utf-8') > 96) {
    const hash = crypto.createHash('sha256').update(safeId).digest('hex').slice(0, 16);
    const shortName = `aoe-${hash}.sock`;
    const fallbackDir = fs.existsSync('/tmp') ? '/tmp' : os.tmpdir();
    return path.join(fallbackDir, shortName);
  }

  return candidatePath;
}

export class UnixSocketIpcClient implements IpcClient {
  private readonly socketPath: string;
  private readonly timeoutMs: number;

  constructor(socketPath?: string, timeoutMs = 150) {
    this.socketPath = socketPath ?? resolveSocketPath();
    this.timeoutMs = timeoutMs;
  }

  public async send(events: AoeEvent[]): Promise<boolean> {
    if (!events.length) return true;

    return new Promise<boolean>((resolve) => {
      let resolved = false;

      const finish = (result: boolean) => {
        if (!resolved) {
          resolved = true;
          try {
            socket.destroy();
          } catch {
            // Ignore socket cleanup error
          }
          resolve(result);
        }
      };

      const socket = net.createConnection(this.socketPath);

      socket.setTimeout(this.timeoutMs, () => {
        finish(false);
      });

      socket.on('error', () => {
        // Safe, non-blocking fallback when IPC consumer is not available
        finish(false);
      });

      socket.on('connect', () => {
        try {
          const payload = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
          socket.write(payload, 'utf-8', () => {
            socket.end(() => {
              finish(true);
            });
          });
        } catch {
          finish(false);
        }
      });
    });
  }

  public async close(): Promise<void> {
    // Stateless per-connection client, nothing persistent
  }
}

export interface IpcServer {
  readonly socketPath: string;
  close(): Promise<void>;
}

export async function createIpcServer(
  socketPath: string,
  onEvent: (event: AoeEvent) => void,
): Promise<IpcServer> {
  // Clean up stale socket file on POSIX
  if (process.platform !== 'win32' && fs.existsSync(socketPath)) {
    try {
      fs.unlinkSync(socketPath);
    } catch {
      // Ignore cleanup error
    }
  }

  const server = net.createServer((socket) => {
    let buffer = '';

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          try {
            const parsed = JSON.parse(trimmed) as AoeEvent;
            onEvent(parsed);
          } catch {
            // Skip invalid protocol line safely
          }
        }
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(socketPath, () => {
      resolve();
    });
  });

  return {
    socketPath,
    async close() {
      await new Promise<void>((resolve) => {
        server.close(() => {
          if (process.platform !== 'win32' && fs.existsSync(socketPath)) {
            try {
              fs.unlinkSync(socketPath);
            } catch {
              // Ignore unlink error
            }
          }
          resolve();
        });
      });
    },
  };
}
