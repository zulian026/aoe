import net from 'node:net';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import type { SidecarConnectionStatus } from './types.js';

export interface IpcServerOptions {
  socketPath: string;
}

/**
 * High-performance Unix Domain Socket server for AOE Sidecar.
 * Listens for incoming connections from ephemeral hook bridge producers,
 * ingests streamed JSONL chunks, and manages client connections cleanly.
 */
export class SidecarIpcServer extends EventEmitter {
  public readonly socketPath: string;
  private server: net.Server | null = null;
  private activeClients = new Set<net.Socket>();
  private status: SidecarConnectionStatus = 'idle';

  constructor(options: IpcServerOptions) {
    super();
    this.socketPath = options.socketPath;
  }

  public getStatus(): SidecarConnectionStatus {
    return this.status;
  }

  public isListening(): boolean {
    return this.status === 'connected';
  }

  /**
   * Starts listening on the designated Unix domain socket.
   */
  public async start(): Promise<void> {
    if (this.status === 'connected') return;

    // Clean up stale socket file on POSIX systems
    if (process.platform !== 'win32' && fs.existsSync(this.socketPath)) {
      try {
        fs.unlinkSync(this.socketPath);
      } catch {
        // Ignore unlink failure
      }
    }

    this.status = 'connecting';

    return new Promise<void>((resolve, reject) => {
      const server = net.createServer((socket) => {
        this.activeClients.add(socket);
        this.emit('connection', socket);

        socket.on('data', (chunk: Buffer) => {
          this.emit('data', chunk);
        });

        socket.on('error', (err) => {
          this.emit('clientError', err);
        });

        socket.on('close', () => {
          this.activeClients.delete(socket);
        });
      });

      server.once('error', (err) => {
        this.status = 'closed';
        reject(err);
      });

      server.listen(this.socketPath, () => {
        this.server = server;
        this.status = 'connected';

        // Security invariant: Restrict socket permissions to current user only (0600)
        if (process.platform !== 'win32') {
          try {
            fs.chmodSync(this.socketPath, 0o600);
          } catch {
            // Ignore chmod failure if filesystem does not support POSIX perms
          }
        }

        this.emit('listen');
        this.emit('status', this.status);
        resolve();
      });
    });
  }

  /**
   * Gracefully shuts down the socket server, terminates active clients, and unlinks socket.
   */
  public async stop(): Promise<void> {
    this.status = 'closed';

    for (const client of this.activeClients) {
      try {
        client.destroy();
      } catch {
        // Ignore destroy error
      }
    }
    this.activeClients.clear();

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server?.close(() => resolve());
      });
      this.server = null;
    }

    if (process.platform !== 'win32' && fs.existsSync(this.socketPath)) {
      try {
        fs.unlinkSync(this.socketPath);
      } catch {
        // Ignore unlink error
      }
    }

    this.emit('close');
    this.emit('status', this.status);
  }
}
