import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import { executePipe } from '../commands/pipe.js';
import { ExitCode } from '../runtime/exit-codes.js';
import { CliError } from '../utils/errors.js';

function createMockStream(chunks: string[]): NodeJS.ReadableStream {
  return Readable.from(chunks);
}

describe('aoe pipe command', () => {
  it('processes Claude Code hook payloads with explicit --agent claude-code', async () => {
    const claudePayloads =
      [
        JSON.stringify({
          session_id: 'claude_sess_1',
          hook_event_name: 'SessionStart',
          cwd: '/project/claude',
        }),
        JSON.stringify({
          session_id: 'claude_sess_1',
          hook_event_name: 'PreToolUse',
          tool_name: 'Write',
          tool_use_id: 'tool_w1',
          tool_input: { file_path: 'src/index.ts', content: 'console.log("hi");' },
        }),
        JSON.stringify({
          session_id: 'claude_sess_1',
          hook_event_name: 'PostToolUse',
          tool_name: 'Write',
          tool_use_id: 'tool_w1',
          tool_input: { file_path: 'src/index.ts' },
          tool_response: 'Successfully wrote src/index.ts',
        }),
      ].join('\n') + '\n';

    const stream = createMockStream([claudePayloads]);

    await expect(
      executePipe({ agent: 'claude-code', format: 'static' }, stream),
    ).resolves.toBeUndefined();
  });

  it('processes Gemini CLI hook payloads with explicit --agent gemini-cli', async () => {
    const geminiPayloads =
      [
        JSON.stringify({
          session_id: 'gemini_sess_1',
          hook_event_name: 'SessionStart',
          cwd: '/project/gemini',
        }),
        JSON.stringify({
          session_id: 'gemini_sess_1',
          hook_event_name: 'BeforeTool',
          tool_name: 'write_file',
          tool_input: { path: 'README.md' },
        }),
        JSON.stringify({
          session_id: 'gemini_sess_1',
          hook_event_name: 'AfterTool',
          tool_name: 'write_file',
          tool_input: { path: 'README.md' },
        }),
      ].join('\n') + '\n';

    const stream = createMockStream([geminiPayloads]);

    await expect(
      executePipe({ agent: 'gemini-cli', format: 'static' }, stream),
    ).resolves.toBeUndefined();
  });

  it('processes Antigravity hook payloads with explicit --agent antigravity', async () => {
    const antigravityPayloads =
      [
        JSON.stringify({
          conversationId: 'ag_sess_1',
          hookEventName: 'SessionStart',
          workspacePaths: ['/project/antigravity'],
        }),
        JSON.stringify({
          conversationId: 'ag_sess_1',
          hookEventName: 'PreInvocation',
          invocationNum: 1,
          lastUserInput: 'Build features',
        }),
        JSON.stringify({
          conversationId: 'ag_sess_1',
          hookEventName: 'PreToolUse',
          toolCall: { name: 'write_file', args: { Path: 'src/main.ts' } },
        }),
        JSON.stringify({
          conversationId: 'ag_sess_1',
          hookEventName: 'PostToolUse',
          toolCall: { name: 'write_file', args: { Path: 'src/main.ts' } },
        }),
        JSON.stringify({
          conversationId: 'ag_sess_1',
          hookEventName: 'Stop',
          terminationReason: 'NO_TOOL_CALL',
        }),
      ].join('\n') + '\n';

    const stream = createMockStream([antigravityPayloads]);

    await expect(
      executePipe({ agent: 'antigravity', format: 'static' }, stream),
    ).resolves.toBeUndefined();
  });

  it('processes Generic JSONL stream with explicit --agent generic-jsonl', async () => {
    const genericEvents =
      [
        JSON.stringify({
          eventType: 'session.started',
          payload: { agent: { name: 'custom-ci' }, workingDirectory: '/repo' },
        }),
        JSON.stringify({
          eventType: 'task.started',
          payload: { taskId: 'build', taskName: 'Building project' },
        }),
        JSON.stringify({
          eventType: 'file.changed',
          payload: { path: 'dist/app.js', action: 'CREATED', evidence: { verifiedOnDisk: true } },
        }),
        JSON.stringify({
          eventType: 'task.completed',
          payload: { taskId: 'build', resultSummary: 'Build complete', verified: true },
        }),
        JSON.stringify({
          eventType: 'session.ended',
          payload: { status: 'completed', summary: 'All tasks completed' },
        }),
      ].join('\n') + '\n';

    const stream = createMockStream([genericEvents]);

    await expect(
      executePipe({ agent: 'generic-jsonl', format: 'static' }, stream),
    ).resolves.toBeUndefined();
  });

  it('fails with ADAPTER_ERROR (4) for unknown agent adapter', async () => {
    const stream = createMockStream(['{"data": 1}\n']);

    try {
      await executePipe({ agent: 'non-existent-agent', format: 'static' }, stream);
      expect.fail('Expected error to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CliError);
      expect((err as CliError).exitCode).toBe(ExitCode.ADAPTER_ERROR);
      expect((err as CliError).message).toContain('Unknown agent adapter "non-existent-agent"');
    }
  });

  it('auto-detects agent when environment variable matches', async () => {
    const originalEnv = process.env.CLAUDE_PROJECT_ROOT;
    try {
      process.env.CLAUDE_PROJECT_ROOT = '/workspace/test';

      const payload =
        JSON.stringify({
          session_id: 'c1',
          hook_event_name: 'SessionStart',
          cwd: '/workspace/test',
        }) + '\n';

      const stream = createMockStream([payload]);

      await expect(
        executePipe({ agent: 'auto', format: 'static' }, stream),
      ).resolves.toBeUndefined();
    } finally {
      process.env.CLAUDE_PROJECT_ROOT = originalEnv;
    }
  });

  it('fails with ADAPTER_ERROR (4) when auto-detection cannot resolve agent with required confidence', async () => {
    // Ensure ambient environment variables are not set
    const origClaude = process.env.CLAUDE_PROJECT_ROOT;
    const origGemini = process.env.GEMINI_CLI_HOME;
    const origAgAppData = process.env.ANTIGRAVITY_APP_DATA_DIR;
    const origAgLog = process.env.ANTIGRAVITY_CLI_LOG_FILE;
    delete process.env.CLAUDE_PROJECT_ROOT;
    delete process.env.GEMINI_CLI_HOME;
    delete process.env.ANTIGRAVITY_APP_DATA_DIR;
    delete process.env.ANTIGRAVITY_CLI_LOG_FILE;

    try {
      const stream = createMockStream(['{"ambiguous": true}\n']);

      await expect(executePipe({ agent: 'auto', format: 'static' }, stream)).rejects.toThrow(
        'Unable to auto-detect agent with required confidence',
      );
    } finally {
      if (origClaude) process.env.CLAUDE_PROJECT_ROOT = origClaude;
      if (origGemini) process.env.GEMINI_CLI_HOME = origGemini;
      if (origAgAppData) process.env.ANTIGRAVITY_APP_DATA_DIR = origAgAppData;
      if (origAgLog) process.env.ANTIGRAVITY_CLI_LOG_FILE = origAgLog;
    }
  });
});
