import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SidecarConsumer } from '../sidecar/sidecar-consumer.js';
import { createEvent } from '@zyanx04/protocol';

describe('Sidecar IPC Consumer Integration', () => {
  let socketPath: string;
  let server: net.Server | null = null;
  let activeClients: net.Socket[] = [];

  beforeEach(() => {
    socketPath = path.join(
      os.tmpdir(),
      `aoe-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.sock`,
    );
    activeClients = [];
  });

  afterEach(async () => {
    for (const client of activeClients) {
      try {
        client.destroy();
      } catch {}
    }
    activeClients = [];

    if (server) {
      await new Promise<void>((resolve) => {
        server?.close(() => resolve());
      });
      server = null;
    }

    try {
      if (fs.existsSync(socketPath)) {
        fs.unlinkSync(socketPath);
      }
    } catch {}
  });

  function startServer(): Promise<net.Server> {
    return new Promise((resolve, reject) => {
      const s = net.createServer((conn) => {
        activeClients.push(conn);
      });
      s.listen(socketPath, () => {
        server = s;
        resolve(s);
      });
      s.on('error', reject);
    });
  }

  function broadcast(data: string | Buffer): void {
    for (const client of activeClients) {
      client.write(data);
    }
  }

  it('connects to real Unix domain socket and ingests canonical events', async () => {
    await startServer();

    const consumer = new SidecarConsumer({
      socketPath,
      autoReconnect: false,
    });

    const receivedEvents: string[] = [];
    consumer.on('event', (evt) => {
      receivedEvents.push(evt.eventType);
    });

    await consumer.start();
    expect(consumer.isConnected()).toBe(true);

    const e0 = createEvent('session.started', {
      sessionId: 'sess_live',
      sequence: 0,
      payload: {
        agent: { name: 'antigravity', version: '1.5.0' },
        workingDirectory: '/home/user/app',
      },
    });

    broadcast(JSON.stringify(e0) + '\n');

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(receivedEvents).toEqual(['session.started']);
    const snap = consumer.getSnapshot();
    expect(snap.sessionId).toBe('sess_live');
    expect(snap.status).toBe('active');

    await consumer.stop();
    expect(consumer.isConnected()).toBe(false);
  });

  it('handles partial frames fragmented across multiple TCP/socket chunks', async () => {
    await startServer();

    const consumer = new SidecarConsumer({
      socketPath,
      autoReconnect: false,
    });

    const events: string[] = [];
    consumer.on('event', (evt) => events.push(evt.eventType));

    await consumer.start();

    const e0 = createEvent('session.started', {
      sessionId: 'sess_chunked',
      sequence: 0,
      payload: { agent: { name: 'test' }, workingDirectory: '/dir' },
    });
    const fullLine = JSON.stringify(e0) + '\n';
    const splitIndex = Math.floor(fullLine.length / 2);
    const chunk1 = fullLine.slice(0, splitIndex);
    const chunk2 = fullLine.slice(splitIndex);

    // Write chunk 1
    broadcast(chunk1);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(events).toHaveLength(0); // Nothing complete yet

    // Write chunk 2
    broadcast(chunk2);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(events).toEqual(['session.started']);

    await consumer.stop();
  });

  it('processes multiple events received within a single socket chunk', async () => {
    await startServer();

    const consumer = new SidecarConsumer({
      socketPath,
      autoReconnect: false,
    });

    const sequences: number[] = [];
    consumer.on('event', (evt) => sequences.push(evt.sequence));

    await consumer.start();

    const e0 = createEvent('session.started', {
      sessionId: 'sess_multi',
      sequence: 0,
      payload: { agent: { name: 'test' }, workingDirectory: '/dir' },
    });
    const e1 = createEvent('task.started', {
      sessionId: 'sess_multi',
      sequence: 1,
      payload: { taskId: 't1', taskName: 'Task 1' },
    });
    const e2 = createEvent('task.completed', {
      sessionId: 'sess_multi',
      sequence: 2,
      payload: { taskId: 't1', resultSummary: 'Task 1 done', verified: true },
    });

    const combinedChunk = `${JSON.stringify(e0)}\n${JSON.stringify(e1)}\n${JSON.stringify(e2)}\n`;
    broadcast(combinedChunk);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(sequences).toEqual([0, 1, 2]);
    const snap = consumer.getSnapshot();
    expect(snap.tasks['t1'].status).toBe('completed');

    await consumer.stop();
  });

  it('recovers from malformed JSON and rejects bad frames without crashing', async () => {
    await startServer();

    const consumer = new SidecarConsumer({
      socketPath,
      autoReconnect: false,
    });

    const diagnostics: string[] = [];
    consumer.on('diagnostic', (d) => diagnostics.push(d.code ?? d.message));

    await consumer.start();

    // Send malformed JSON line
    broadcast('{"corrupt": true\n');
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Followed by valid canonical event
    const validEvent = createEvent('session.started', {
      sessionId: 'sess_recover',
      sequence: 0,
      payload: { agent: { name: 'test' }, workingDirectory: '/dir' },
    });
    broadcast(JSON.stringify(validEvent) + '\n');
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(consumer.getSnapshot().sessionId).toBe('sess_recover');
    expect(diagnostics.some((d) => d.includes('INVALID_PROTOCOL_EVENT'))).toBe(true);

    await consumer.stop();
  });

  it('detects sequence anomalies and ignores duplicate events over live IPC', async () => {
    await startServer();

    const consumer = new SidecarConsumer({
      socketPath,
      autoReconnect: false,
    });

    const anomalies: string[] = [];
    consumer.on('anomaly', ({ anomaly }) => anomalies.push(anomaly));

    await consumer.start();

    const e0 = createEvent('session.started', {
      sessionId: 'sess_seq',
      sequence: 0,
      payload: { agent: { name: 'test' }, workingDirectory: '/dir' },
    });
    broadcast(JSON.stringify(e0) + '\n');

    // Duplicate e0
    broadcast(JSON.stringify(e0) + '\n');

    // Sequence gap: skip seq 1, send seq 2
    const e2 = createEvent('task.started', {
      sessionId: 'sess_seq',
      sequence: 2,
      payload: { taskId: 't2', taskName: 'Task 2' },
    });
    broadcast(JSON.stringify(e2) + '\n');

    await new Promise((resolve) => setTimeout(resolve, 50));

    const snap = consumer.getSnapshot();
    expect(snap.sequenceStats.duplicateCount).toBe(1);
    expect(snap.sequenceStats.gapCount).toBe(1);
    expect(anomalies).toContain('sequence_gap');

    await consumer.stop();
  });

  it('reconciles terminal session state and lingering active tasks on session.ended', async () => {
    await startServer();

    const consumer = new SidecarConsumer({
      socketPath,
      autoReconnect: false,
    });

    await consumer.start();

    const e0 = createEvent('session.started', {
      sessionId: 'sess_term',
      sequence: 0,
      payload: { agent: { name: 'test' }, workingDirectory: '/dir' },
    });
    const e1 = createEvent('task.started', {
      sessionId: 'sess_term',
      sequence: 1,
      payload: { taskId: 'task_running', taskName: 'Running Task' },
    });
    broadcast(JSON.stringify(e0) + '\n' + JSON.stringify(e1) + '\n');
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(consumer.getSnapshot().activeTaskId).toBe('task_running');

    // Producer emits session.ended while task_running is still uncompleted
    const e2 = createEvent('session.ended', {
      sessionId: 'sess_term',
      sequence: 2,
      payload: {
        status: 'completed',
        summary: 'Agent run finished',
      },
    });
    broadcast(JSON.stringify(e2) + '\n');
    await new Promise((resolve) => setTimeout(resolve, 50));

    const snap = consumer.getSnapshot();
    expect(snap.isTerminated).toBe(true);
    expect(snap.status).toBe('completed');
    expect(snap.terminationReason).toBe('Agent run finished');
    expect(snap.activeTaskId).toBeUndefined();
    expect(snap.tasks['task_running'].status).toBe('completed');

    await consumer.stop();
  });

  it('handles unavailable socket gracefully without unhandled crashes', async () => {
    const nonexistentSocket = path.join(os.tmpdir(), `nonexistent-${Date.now()}.sock`);

    const consumer = new SidecarConsumer({
      socketPath: nonexistentSocket,
      autoReconnect: false,
      connectTimeoutMs: 200,
    });

    await expect(consumer.start()).rejects.toThrow();
    expect(consumer.isConnected()).toBe(false);

    await consumer.stop();
  });

  it('automatically reconnects when connection is dropped by producer', async () => {
    await startServer();

    const consumer = new SidecarConsumer({
      socketPath,
      autoReconnect: true,
      minBackoffMs: 50,
      maxBackoffMs: 100,
      connectTimeoutMs: 500,
    });

    let reconnected = false;
    let disconnectCount = 0;

    consumer.on('disconnect', () => {
      disconnectCount += 1;
    });

    await consumer.start();
    expect(consumer.isConnected()).toBe(true);

    // Producer closes client socket
    for (const c of activeClients) {
      c.destroy();
    }
    activeClients = [];

    // Wait for reconnection
    await new Promise<void>((resolve) => {
      consumer.on('connect', () => {
        reconnected = true;
        resolve();
      });
      // Fallback timer
      setTimeout(resolve, 400);
    });

    expect(disconnectCount).toBeGreaterThanOrEqual(1);
    expect(reconnected).toBe(true);
    expect(consumer.isConnected()).toBe(true);

    await consumer.stop();
  });

  it('operates in server mode, listening on socket, receiving client connections, and reducing events', async () => {
    const serverConsumer = new SidecarConsumer({
      socketPath,
      mode: 'server',
    });

    await serverConsumer.start();
    expect(serverConsumer.isConnected()).toBe(true);
    expect(fs.existsSync(socketPath)).toBe(true);

    // Verify socket permissions (0600)
    if (process.platform !== 'win32') {
      const stat = fs.statSync(socketPath);
      // Mask mode with 0777 to check file permissions
      const mode = stat.mode & 0o777;
      expect(mode).toBe(0o600);
    }

    // Connect a mock producer client
    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', () => resolve()));

    const e0 = createEvent('session.started', {
      sessionId: 'sess_server_mode',
      sequence: 0,
      payload: {
        agent: { name: 'antigravity', version: '1.5.0' },
        workingDirectory: '/home/user/app',
      },
    });

    client.write(JSON.stringify(e0) + '\n');
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(serverConsumer.getSnapshot().sessionId).toBe('sess_server_mode');
    expect(serverConsumer.getSnapshot().status).toBe('active');

    client.destroy();
    await serverConsumer.stop();
    expect(fs.existsSync(socketPath)).toBe(false);
  });
});
