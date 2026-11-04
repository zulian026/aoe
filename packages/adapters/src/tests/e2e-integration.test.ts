import { describe, it, expect } from 'vitest';
import { Engine } from '@zyanx04/core';
import { StaticRenderer } from '@zyanx04/renderer';
import { createDefaultAdapterManager } from '../index.js';

class MockStream {
  public output = '';
  public write(chunk: string): boolean {
    this.output += chunk;
    return true;
  }
}

describe('M06 End-to-End Integration (Adapter -> Protocol -> Core Engine -> Terminal Renderer)', () => {
  it('processes Claude Code workflow end-to-end to snapshot and rendered output', async () => {
    const manager = createDefaultAdapterManager();
    const engine = new Engine();
    const stream = new MockStream();
    const renderer = new StaticRenderer({ stream: stream as unknown as NodeJS.WritableStream });

    // 1. Create session via adapter
    const adapterSession = await manager.createSession('claude-code', {
      workingDirectory: '/my/repo',
    });

    // 2. Wire manager event dispatch into Engine
    manager.onEvent((event) => {
      engine.processEvent(event);
      const snapshot = engine.getSessionSnapshot(adapterSession.id);
      if (snapshot) {
        renderer.render(snapshot);
      }
    });

    // 3. Ingest Claude Code SessionStart
    await manager.ingest(adapterSession.id, {
      session_id: 'claude_e2e_1',
      hook_event_name: 'SessionStart',
      cwd: '/my/repo',
    });

    let snapshot = engine.getSessionSnapshot(adapterSession.id);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.status).toBe('active');
    expect(snapshot?.agent?.name).toBe('claude-code');

    // 4. Ingest Claude Code PreToolUse (Edit)
    await manager.ingest(adapterSession.id, {
      session_id: 'claude_e2e_1',
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_use_id: 'tool_edit_99',
      tool_input: {
        file_path: 'src/app.ts',
      },
    });

    snapshot = engine.getSessionSnapshot(adapterSession.id);
    expect(snapshot?.tasks.size).toBe(1);
    expect(snapshot?.activeTaskCount).toBe(1);

    // 5. Ingest Claude Code PostToolUse (Edit)
    await manager.ingest(adapterSession.id, {
      session_id: 'claude_e2e_1',
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      tool_use_id: 'tool_edit_99',
      tool_input: {
        file_path: 'src/app.ts',
      },
      tool_response: 'Successfully modified',
    });

    snapshot = engine.getSessionSnapshot(adapterSession.id);
    expect(snapshot?.completedTaskCount).toBe(1);
    expect(snapshot?.fileChanges).toHaveLength(1);
    expect(snapshot?.fileChanges[0].path).toBe('src/app.ts');
    expect(snapshot?.fileChanges[0].action).toBe('MODIFIED');

    // 6. Ingest Claude Code SessionEnd
    await manager.ingest(adapterSession.id, {
      session_id: 'claude_e2e_1',
      hook_event_name: 'SessionEnd',
    });

    snapshot = engine.getSessionSnapshot(adapterSession.id);
    expect(snapshot?.status).toBe('completed');

    // 7. Verify StaticRenderer output captures the session, tasks, and files
    expect(stream.output).toContain('AOE Session');
    expect(stream.output).toContain('[COMPLETED]');
    expect(stream.output).toContain('src/app.ts');
  });

  it('processes Gemini CLI workflow end-to-end to snapshot and renderer', async () => {
    const manager = createDefaultAdapterManager();
    const engine = new Engine();
    const stream = new MockStream();
    const renderer = new StaticRenderer({ stream: stream as unknown as NodeJS.WritableStream });

    const adapterSession = await manager.createSession('gemini-cli', {
      workingDirectory: '/gemini/repo',
    });

    manager.onEvent((event) => {
      engine.processEvent(event);
      const snapshot = engine.getSessionSnapshot(adapterSession.id);
      if (snapshot) {
        renderer.render(snapshot);
      }
    });

    // Ingest SessionStart
    await manager.ingest(adapterSession.id, {
      session_id: 'gemini_e2e_1',
      hook_event_name: 'SessionStart',
      cwd: '/gemini/repo',
    });

    // Ingest BeforeTool write_file
    await manager.ingest(adapterSession.id, {
      session_id: 'gemini_e2e_1',
      hook_event_name: 'BeforeTool',
      tool_name: 'write_file',
      tool_input: { path: 'docs/spec.md' },
    });

    // Ingest AfterTool write_file
    await manager.ingest(adapterSession.id, {
      session_id: 'gemini_e2e_1',
      hook_event_name: 'AfterTool',
      tool_name: 'write_file',
      tool_input: { path: 'docs/spec.md' },
    });

    // End session
    await manager.endSession(adapterSession.id, 'Gemini completed all files');

    const snapshot = engine.getSessionSnapshot(adapterSession.id);
    expect(snapshot?.status).toBe('completed');
    expect(snapshot?.fileChanges).toHaveLength(1);
    expect(snapshot?.fileChanges[0].action).toBe('CREATED');
    expect(stream.output).toContain('docs/spec.md');
  });

  it('maintains isolation across concurrent multi-agent sessions in engine', async () => {
    const manager = createDefaultAdapterManager();
    const engine = new Engine();

    const claudeSession = await manager.createSession('claude-code', {}, 'sess-claude');
    const geminiSession = await manager.createSession('gemini-cli', {}, 'sess-gemini');

    manager.onEvent((event) => {
      engine.processEvent(event);
    });

    await manager.ingest(claudeSession.id, {
      session_id: 'c1',
      hook_event_name: 'SessionStart',
      cwd: '/claude/dir',
    });

    await manager.ingest(geminiSession.id, {
      session_id: 'g1',
      hook_event_name: 'SessionStart',
      cwd: '/gemini/dir',
    });

    const snapClaude = engine.getSessionSnapshot(claudeSession.id);
    const snapGemini = engine.getSessionSnapshot(geminiSession.id);

    expect(snapClaude?.sessionId).toBe('sess-claude');
    expect(snapClaude?.agent?.name).toBe('claude-code');
    expect(snapClaude?.workingDirectory).toBe('/claude/dir');

    expect(snapGemini?.sessionId).toBe('sess-gemini');
    expect(snapGemini?.agent?.name).toBe('gemini-cli');
    expect(snapGemini?.workingDirectory).toBe('/gemini/dir');
  });
});
