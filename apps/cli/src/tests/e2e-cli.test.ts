import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(currentDir, '../../dist/bin.js');

interface RunCliResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runBinary(args: string[], stdinInput?: string): Promise<RunCliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [binPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    if (stdinInput !== undefined) {
      child.stdin.write(stdinInput);
    }
    child.stdin.end();
  });
}

describe('E2E CLI Subprocess Execution', () => {
  it('executes aoe --version with exit code 0', async () => {
    const res = await runBinary(['--version']);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('AOE CLI v0.1.0');
  });

  it('executes aoe --help with exit code 0', async () => {
    const res = await runBinary(['--help']);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('Universal terminal presentation engine');
    expect(res.stdout).toContain('render');
    expect(res.stdout).toContain('pipe');
    expect(res.stdout).toContain('doctor');
  });

  it('executes aoe theme list with exit code 0', async () => {
    const res = await runBinary(['theme', 'list']);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('Available AOE Themes:');
    expect(res.stdout).toContain('obsidian');
  });

  it('executes aoe doctor with exit code 0', async () => {
    const res = await runBinary(['doctor']);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('AOE Doctor');
    expect(res.stdout).toContain('All checks passed');
  });

  it('executes aoe skill show with exit code 0', async () => {
    const res = await runBinary(['skill', 'show']);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('name: aoe');
    expect(res.stdout).toContain('Zero Hallucination');
  });

  it('pipes canonical JSONL to aoe render with exit code 0', async () => {
    const startEvent =
      JSON.stringify({
        protocolVersion: '1.0.0',
        eventId: 'evt_e2e_1',
        sessionId: 'sess_e2e_1',
        sequence: 1,
        timestamp: '2026-11-03T12:00:00.000Z',
        eventType: 'session.started',
        payload: {
          agent: { name: 'e2e-agent' },
          workingDirectory: '/repo',
        },
      }) + '\n';

    const res = await runBinary(['render', '--format', 'static'], startEvent);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('AOE Session sess_e2e_1: [ACTIVE] (agent: e2e-agent)');
  });

  it('fails with exit code 3 when piping invalid protocol JSONL to aoe render', async () => {
    const invalidEvent =
      JSON.stringify({
        protocolVersion: '1.0.0',
        eventId: 'evt_bad',
        sessionId: 'sess_1',
        sequence: 1,
        timestamp: '2026-11-03T12:00:00.000Z',
        eventType: 'session.started',
        payload: {}, // Missing required fields
      }) + '\n';

    const res = await runBinary(['render', '--format', 'static'], invalidEvent);
    expect(res.code).toBe(3);
    expect(res.stderr).toContain('Protocol error');
  });

  it('pipes Claude Code hook to aoe pipe --agent claude-code with exit code 0', async () => {
    const claudePayload =
      JSON.stringify({
        session_id: 'claude_e2e_sub',
        hook_event_name: 'SessionStart',
        cwd: '/workspace/claude',
      }) + '\n';

    const res = await runBinary(
      ['pipe', '--agent', 'claude-code', '--format', 'static'],
      claudePayload,
    );
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('agent: claude-code');
  });

  it('pipes Gemini CLI hook to aoe pipe --agent gemini-cli with exit code 0', async () => {
    const geminiPayload =
      JSON.stringify({
        session_id: 'gemini_e2e_sub',
        hook_event_name: 'SessionStart',
        cwd: '/workspace/gemini',
      }) + '\n';

    const res = await runBinary(
      ['pipe', '--agent', 'gemini-cli', '--format', 'static'],
      geminiPayload,
    );
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('agent: gemini-cli');
  });

  it('pipes Generic JSONL to aoe pipe --agent generic-jsonl with exit code 0', async () => {
    const genericPayload =
      JSON.stringify({
        eventType: 'session.started',
        payload: {
          agent: { name: 'custom-tool' },
          workingDirectory: '/repo',
        },
      }) + '\n';

    const res = await runBinary(
      ['pipe', '--agent', 'generic-jsonl', '--format', 'static'],
      genericPayload,
    );
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('agent: custom-tool');
  });
});
