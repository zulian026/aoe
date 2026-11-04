import { EventEmitter } from 'node:events';
import type { AoeEvent } from '@zyanx04/protocol';
import type {
  IpcClientOptions,
  SidecarConnectionStatus,
  SidecarDiagnostic,
  SidecarReadModelSnapshot,
} from './types.js';
import { IncrementalFrameDecoder } from './frame-decoder.js';
import { validateCanonicalEvent } from './protocol-validator.js';
import { SidecarEventSequencer } from './event-sequencer.js';
import { SidecarReadModel } from './read-model.js';
import { SidecarIpcClient } from './ipc-client.js';
import { SidecarIpcServer } from './ipc-server.js';

export interface SidecarConsumerOptions extends Partial<IpcClientOptions> {
  socketPath: string;
  autoStart?: boolean;
  mode?: 'client' | 'server';
}

/**
 * High-level AOE Sidecar Consumer.
 * Orchestrates Unix domain socket connection / server hosting, incremental framing,
 * protocol envelope validation, monotonic sequence checking, and read-model state reduction.
 */
export class SidecarConsumer extends EventEmitter {
  public readonly mode: 'client' | 'server';
  public readonly client: SidecarIpcClient;
  public readonly server?: SidecarIpcServer;
  public readonly decoder: IncrementalFrameDecoder;
  public readonly sequencer: SidecarEventSequencer;
  public readonly readModel: SidecarReadModel;

  constructor(options: SidecarConsumerOptions) {
    super();
    this.mode = options.mode ?? 'client';
    this.client = new SidecarIpcClient(options);
    this.decoder = new IncrementalFrameDecoder();
    this.sequencer = new SidecarEventSequencer();
    this.readModel = new SidecarReadModel();

    if (this.mode === 'server') {
      this.server = new SidecarIpcServer({ socketPath: options.socketPath });
      this.wireServerEvents();
    } else {
      this.wireClientEvents();
    }
  }

  private wireServerEvents(): void {
    if (!this.server) return;

    this.server.on('listen', () => {
      this.decoder.reset();
      this.emit('connect');
      this.emit('status', 'connected');
    });

    this.server.on('data', (chunk: Buffer) => {
      this.ingest(chunk);
    });

    this.server.on('status', (status: SidecarConnectionStatus) => {
      this.emit('status', status);
    });

    this.server.on('clientError', (err: Error) => {
      this.readModel.addDiagnostic({
        level: 'warning',
        code: 'IPC_CLIENT_ERROR',
        message: `Client error: ${err.message}`,
        timestamp: new Date().toISOString(),
      });
    });

    this.server.on('close', () => {
      this.emit('disconnect', 'Server closed');
      this.emit('status', 'closed');
    });
  }

  private wireClientEvents(): void {
    this.client.on('connect', () => {
      this.decoder.reset();
      this.emit('connect');
      this.emit('status', this.client.getStatus());
    });

    this.client.on('disconnect', (reason) => {
      this.readModel.addDiagnostic({
        level: 'info',
        code: 'IPC_DISCONNECTED',
        message: `Socket disconnected: ${reason}`,
        timestamp: new Date().toISOString(),
      });
      this.emit('disconnect', reason);
      this.emit('status', this.client.getStatus());
    });

    this.client.on('reconnecting', (info) => {
      this.readModel.addDiagnostic({
        level: 'info',
        code: 'IPC_RECONNECTING',
        message: `Reconnecting to socket (attempt ${info.attempt}, delay ${info.delayMs}ms)`,
        timestamp: new Date().toISOString(),
      });
      this.emit('reconnecting', info);
      this.emit('status', this.client.getStatus());
    });

    this.client.on('error', (err) => {
      this.readModel.addDiagnostic({
        level: 'warning',
        code: 'IPC_SOCKET_ERROR',
        message: `Socket communication error: ${err.message}`,
        timestamp: new Date().toISOString(),
        details: err,
      });
      if (this.listenerCount('error') > 0) {
        this.emit('error', err);
      }
    });

    this.client.on('data', (chunk: Buffer) => {
      this.ingest(chunk);
    });
  }

  /**
   * Ingests a raw data chunk (from socket or direct testing stream),
   * extracts frames incrementally, and processes each complete JSON line.
   */
  public ingest(chunk: Buffer | string): void {
    const { lines, errors } = this.decoder.push(chunk);

    for (const err of errors) {
      const diag: SidecarDiagnostic = {
        level: 'error',
        code: 'FRAME_BUFFER_OVERFLOW',
        message: err.error,
        timestamp: new Date().toISOString(),
      };
      this.readModel.addDiagnostic(diag);
      this.emit('diagnostic', diag);
    }

    for (const line of lines) {
      this.processLine(line);
    }
  }

  /**
   * Processes a single complete line from the stream.
   */
  public processLine(line: string): void {
    const validation = validateCanonicalEvent(line);

    if (!validation.valid) {
      const diag: SidecarDiagnostic = {
        level: 'warning',
        code: 'INVALID_PROTOCOL_EVENT',
        message: `Malformed event rejected: ${validation.error}`,
        timestamp: new Date().toISOString(),
        details: { raw: validation.raw },
      };
      this.readModel.addDiagnostic(diag);
      this.emit('diagnostic', diag);
      return;
    }

    const event: AoeEvent = validation.event;
    const seqResult = this.sequencer.evaluate(event);

    if (seqResult.diagnostic) {
      this.readModel.addDiagnostic(seqResult.diagnostic);
      this.emit('diagnostic', seqResult.diagnostic);
      if (seqResult.anomaly) {
        this.emit('anomaly', { event, anomaly: seqResult.anomaly });
      }
    }

    // If duplicate, do not reduce into state model
    if (!seqResult.accepted) {
      return;
    }

    // Reduce into normalized state read model
    this.readModel.reduce(event);
    this.readModel.updateSequenceStats(this.sequencer.getStats());

    this.emit('event', event);
    this.emit('state', this.readModel.getSnapshot());
  }

  /**
   * Starts connection to the socket or begins listening on server socket.
   */
  public async start(): Promise<void> {
    if (this.mode === 'server') {
      await this.server?.start();
    } else {
      await this.client.connect();
    }
  }

  /**
   * Stops the consumer, draining remaining buffer and closing socket or server.
   */
  public async stop(): Promise<void> {
    const drained = this.decoder.drain();
    for (const line of drained.lines) {
      this.processLine(line);
    }
    if (this.mode === 'server') {
      await this.server?.stop();
    } else {
      await this.client.disconnect();
    }
  }

  public getStatus(): SidecarConnectionStatus {
    if (this.mode === 'server') {
      return this.server?.getStatus() ?? 'idle';
    }
    return this.client.getStatus();
  }

  public isConnected(): boolean {
    if (this.mode === 'server') {
      return this.server?.isListening() ?? false;
    }
    return this.client.isConnected();
  }

  public getSnapshot(): SidecarReadModelSnapshot {
    return this.readModel.getSnapshot();
  }

  public getState(): SidecarReadModel {
    return this.readModel;
  }
}
