import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runCli } from '../program.js';
import { ExitCode } from '../runtime/exit-codes.js';
import { discoverActiveSocket } from '../commands/sidecar.js';
import { createEvent } from '@zyanx04/protocol';

describe('aoe sidecar CLI command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoe-sidecar-cli-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('exits cleanly with code 0 and message when no active session socket exists', async () => {
    let captured = '';
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      captured += chunk.toString();
      return true;
    });

    const exitCode = await runCli(['node', 'aoe', 'sidecar', '--dir', tmpDir]);
    expect(exitCode).toBe(ExitCode.SUCCESS);
    expect(captured).toContain('No active agent session found');

    stdoutSpy.mockRestore();
  });

  it('outputs valid JSON when --json is provided and no session is found', async () => {
    let captured = '';
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      captured += chunk.toString();
      return true;
    });

    const exitCode = await runCli(['node', 'aoe', 'sidecar', '--json', '--dir', tmpDir]);
    expect(exitCode).toBe(ExitCode.SUCCESS);

    const parsed = JSON.parse(captured.trim());
    expect(parsed.status).toBe('no_session');

    stdoutSpy.mockRestore();
  });

  it('discoverActiveSocket discovers the latest active unix domain socket in custom dir', async () => {
    const sockPath = path.join(tmpDir, 'aoe-sess_abc.sock');
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(sockPath, () => resolve()));

    const found = discoverActiveSocket(tmpDir);
    expect(found).toBe(sockPath);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('discoverActiveSocket returns null safely when no socket exists in directory', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoe-empty-dir-'));
    try {
      const found = discoverActiveSocket(emptyDir);
      expect(found).toBeNull();
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('connects to active socket with --once --json and outputs machine-readable JSON snapshot', async () => {
    const sockPath = path.join(tmpDir, 'aoe-test-once-json.sock');
    let clientConn: net.Socket | null = null;
    const server = net.createServer((conn) => {
      clientConn = conn;
      const e0 = createEvent('session.started', {
        sessionId: 'sess_once_json',
        sequence: 0,
        payload: {
          agent: { name: 'antigravity' },
          workingDirectory: '/dir',
        },
      });
      conn.write(JSON.stringify(e0) + '\n');
    });

    await new Promise<void>((resolve) => server.listen(sockPath, () => resolve()));

    let captured = '';
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      captured += chunk.toString();
      return true;
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

    await runCli(['node', 'aoe', 'sidecar', '--socket', sockPath, '--once', '--json']);

    await new Promise((resolve) => setTimeout(resolve, 150));

    stdoutSpy.mockRestore();
    exitSpy.mockRestore();

    if (clientConn) {
      try {
        (clientConn as net.Socket).destroy();
      } catch {}
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(captured).toContain('sess_once_json');
    const parsed = JSON.parse(captured.trim());
    expect(parsed.sessionId).toBe('sess_once_json');
    expect(parsed.status).toBe('active');
  });

  it('connects to active socket with --once and outputs formatted terminal UI presentation', async () => {
    const sockPath = path.join(tmpDir, 'aoe-test-once-formatted.sock');
    let clientConn: net.Socket | null = null;
    const server = net.createServer((conn) => {
      clientConn = conn;
      const e0 = createEvent('session.started', {
        sessionId: 'sess_once_formatted',
        sequence: 0,
        payload: {
          agent: { name: 'antigravity', version: '1.5.0' },
          workingDirectory: '/home/user/project',
        },
      });
      const e1 = createEvent('task.started', {
        sessionId: 'sess_once_formatted',
        sequence: 1,
        payload: { taskId: 't1', taskName: 'Analyze Project' },
      });
      conn.write(JSON.stringify(e0) + '\n' + JSON.stringify(e1) + '\n');
    });

    await new Promise<void>((resolve) => server.listen(sockPath, () => resolve()));

    let captured = '';
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      captured += chunk.toString();
      return true;
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

    await runCli(['node', 'aoe', 'sidecar', '--socket', sockPath, '--once']);

    await new Promise((resolve) => setTimeout(resolve, 150));

    stdoutSpy.mockRestore();
    exitSpy.mockRestore();

    if (clientConn) {
      try {
        (clientConn as net.Socket).destroy();
      } catch {}
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(captured).toContain('AOE SIDECAR');
    expect(captured).toContain('Analyze Project');
    expect(captured).toContain('antigravity');
  });

  it('handles non-TTY / --static stream output without crashing', async () => {
    const sockPath = path.join(tmpDir, 'aoe-test-static.sock');
    let clientConn: net.Socket | null = null;
    const server = net.createServer((conn) => {
      clientConn = conn;
      const e0 = createEvent('session.started', {
        sessionId: 'sess_stream_test',
        sequence: 0,
        payload: { agent: { name: 'antigravity' }, workingDirectory: '/dir' },
      });
      conn.write(JSON.stringify(e0) + '\n');
    });

    await new Promise<void>((resolve) => server.listen(sockPath, () => resolve()));

    let captured = '';
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      captured += chunk.toString();
      return true;
    });

    // Run with --static and mock exit
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

    void runCli(['node', 'aoe', 'sidecar', '--socket', sockPath, '--static']);

    await new Promise((resolve) => setTimeout(resolve, 80));

    // Cleanup server and connection
    if (clientConn) {
      try {
        (clientConn as net.Socket).destroy();
      } catch {}
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));

    stdoutSpy.mockRestore();
    exitSpy.mockRestore();

    expect(captured).toContain('Connecting to socket:');
  });

  it('runs sidecar in listen mode, accepts producer connection with --once, and prints output', async () => {
    const sockPath = path.join(tmpDir, 'aoe-test-listen-mode.sock');

    let captured = '';
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      captured += chunk.toString();
      return true;
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

    // Launch sidecar in listen mode with --once
    const cliPromise = runCli([
      'node',
      'aoe',
      'sidecar',
      '--socket',
      sockPath,
      '--listen',
      '--once',
      '--json',
    ]);

    // Give server 50ms to bind
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fs.existsSync(sockPath)).toBe(true);

    // Producer connects and sends session.started
    const client = net.createConnection(sockPath);
    await new Promise<void>((resolve) => client.once('connect', () => resolve()));

    const e0 = createEvent('session.started', {
      sessionId: 'sess_cli_listen',
      sequence: 0,
      payload: {
        agent: { name: 'antigravity', version: '1.5.0' },
        workingDirectory: '/home/user/app',
      },
    });

    client.write(JSON.stringify(e0) + '\n');
    await cliPromise;

    stdoutSpy.mockRestore();
    exitSpy.mockRestore();

    expect(captured).toContain('sess_cli_listen');
    const parsed = JSON.parse(captured.trim());
    expect(parsed.sessionId).toBe('sess_cli_listen');
  });
});
