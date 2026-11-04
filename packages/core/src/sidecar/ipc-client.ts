import net from 'node:net';
import { EventEmitter } from 'node:events';
import type { IpcClientOptions, SidecarConnectionStatus } from './types.js';

export interface IpcClientEvents {
  connect: () => void;
  data: (chunk: Buffer) => void;
  disconnect: (reason?: string) => void;
  reconnecting: (info: { attempt: number; delayMs: number }) => void;
  error: (err: Error) => void;
  close: () => void;
}

/**
 * Robust Unix Domain Socket client for the AOE Sidecar Consumer.
 * Implements bounded exponential backoff, stream chunk piping, and clean signal teardown.
 */
export class SidecarIpcClient extends EventEmitter {
  public readonly socketPath: string;
  private readonly minBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly backoffFactor: number;
  private readonly maxRetries: number;
  private readonly connectTimeoutMs: number;
  private readonly autoReconnect: boolean;

  private socket: net.Socket | null = null;
  private status: SidecarConnectionStatus = 'idle';
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectTimer: NodeJS.Timeout | null = null;
  private currentAttempt = 0;
  private isExplicitlyClosed = false;

  constructor(options: IpcClientOptions) {
    super();
    this.socketPath = options.socketPath;
    this.minBackoffMs = options.minBackoffMs ?? 100;
    this.maxBackoffMs = options.maxBackoffMs ?? 3000;
    this.backoffFactor = options.backoffFactor ?? 1.5;
    this.maxRetries = options.maxRetries ?? Infinity;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 2000;
    this.autoReconnect = options.autoReconnect ?? true;
  }

  public getStatus(): SidecarConnectionStatus {
    return this.status;
  }

  public isConnected(): boolean {
    return this.status === 'connected';
  }

  /**
   * Initiates connection to the Unix domain socket server.
   */
  public connect(): Promise<void> {
    if (this.status === 'connected') {
      return Promise.resolve();
    }

    this.isExplicitlyClosed = false;
    this.status = this.currentAttempt > 0 ? 'reconnecting' : 'connecting';

    return new Promise<void>((resolve, reject) => {
      let settled = false;

      const cleanupHandlers = () => {
        if (this.connectTimer) {
          clearTimeout(this.connectTimer);
          this.connectTimer = null;
        }
      };

      const socket = net.createConnection({ path: this.socketPath });
      this.socket = socket;

      this.connectTimer = setTimeout(() => {
        if (!settled && this.status !== 'connected') {
          settled = true;
          cleanupHandlers();
          try {
            socket.destroy();
          } catch {}
          const err = new Error(
            `Connection to socket "${this.socketPath}" timed out after ${this.connectTimeoutMs}ms`,
          );
          this.handleConnectionFailure(err);
          reject(err);
        }
      }, this.connectTimeoutMs);

      socket.once('connect', () => {
        if (!settled) {
          settled = true;
          cleanupHandlers();
          this.status = 'connected';
          this.currentAttempt = 0;
          this.emit('connect');
          resolve();
        }
      });

      socket.on('data', (chunk: Buffer) => {
        this.emit('data', chunk);
      });

      socket.on('error', (err: Error) => {
        if (!settled) {
          settled = true;
          cleanupHandlers();
          this.handleConnectionFailure(err);
          reject(err);
        }
        if (this.listenerCount('error') > 0) {
          this.emit('error', err);
        }
      });

      socket.on('close', (hadError: boolean) => {
        cleanupHandlers();
        if (this.socket === socket) {
          this.socket = null;
        }
        if (this.status === 'connected') {
          this.status = 'idle';
          this.emit('disconnect', hadError ? 'socket_error' : 'socket_closed');
          if (!this.isExplicitlyClosed && this.autoReconnect) {
            this.scheduleReconnect();
          }
        }
      });
    });
  }

  private handleConnectionFailure(_err: Error): void {
    if (this.isExplicitlyClosed) {
      return;
    }
    if (this.autoReconnect && this.currentAttempt < this.maxRetries) {
      this.scheduleReconnect();
    } else {
      this.status = 'closed';
      this.emit('close');
    }
  }

  private scheduleReconnect(): void {
    if (this.isExplicitlyClosed || this.reconnectTimer) {
      return;
    }

    this.currentAttempt += 1;
    this.status = 'reconnecting';

    const delay = Math.min(
      this.maxBackoffMs,
      Math.round(this.minBackoffMs * Math.pow(this.backoffFactor, this.currentAttempt - 1)),
    );

    this.emit('reconnecting', { attempt: this.currentAttempt, delayMs: delay });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isExplicitlyClosed) {
        this.connect().catch(() => {
          // Reconnect error handled in handleConnectionFailure
        });
      }
    }, delay);
  }

  /**
   * Gracefully and cleanly disconnects from the socket.
   */
  public disconnect(): Promise<void> {
    this.isExplicitlyClosed = true;
    this.status = 'closed';

    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    return new Promise<void>((resolve) => {
      if (this.socket) {
        const s = this.socket;
        this.socket = null;
        s.removeAllListeners('data');
        s.end(() => {
          try {
            s.destroy();
          } catch {}
          this.emit('close');
          resolve();
        });
      } else {
        this.emit('close');
        resolve();
      }
    });
  }
}
