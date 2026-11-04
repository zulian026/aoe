import { AntigravityAdapter } from './adapter.js';
import { UnixSocketIpcClient, resolveSocketPath, type IpcClient } from './ipc-transport.js';
import type { AdapterSession } from '../../contracts/session.js';
import { createAdapterSession } from '../../contracts/session.js';

export interface HookBridgeOptions {
  event?: string;
  socketPath?: string;
  stdinStream?: NodeJS.ReadableStream;
  stdoutStream?: NodeJS.WritableStream;
  stderrStream?: NodeJS.WritableStream;
  timeoutMs?: number;
  adapter?: AntigravityAdapter;
  session?: AdapterSession;
  ipcClient?: IpcClient;
}

export interface HookBridgeResult {
  success: boolean;
  event: string;
  normalizedCount: number;
  forwarded: boolean;
  response: Record<string, unknown>;
  durationMs: number;
}

/**
 * Returns the documented Antigravity response object for each hook event.
 */
export function getAntigravityResponseForEvent(eventName: string): Record<string, unknown> {
  switch (eventName) {
    case 'PreToolUse':
      return { decision: 'allow' };
    case 'PostToolUse':
      return {};
    case 'SessionStart':
      return { injectSteps: [] };
    case 'PreInvocation':
    case 'PostInvocation':
      return { injectSteps: [], terminationBehavior: '' };
    case 'Stop':
      return { decision: '' };
    default:
      return {};
  }
}

/**
 * Reads standard input within a strict timeout to prevent hanging.
 */
async function readStdin(stream: NodeJS.ReadableStream, timeoutMs: number): Promise<string> {
  return new Promise<string>((resolve) => {
    let data = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(data.trim());
      }
    }, timeoutMs);

    stream.setEncoding('utf-8');
    stream.on('data', (chunk) => {
      data += chunk;
    });

    stream.on('end', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(data.trim());
      }
    });

    stream.on('error', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(data.trim());
      }
    });
  });
}

/**
 * Executes the non-blocking Antigravity hook bridge.
 */
export async function runHookBridge(options: HookBridgeOptions = {}): Promise<HookBridgeResult> {
  const start = Date.now();
  const stdinStream = options.stdinStream ?? process.stdin;
  const stdoutStream = options.stdoutStream ?? process.stdout;
  const stderrStream = options.stderrStream ?? process.stderr;
  const timeoutMs = options.timeoutMs ?? 1000;
  const adapter = options.adapter ?? new AntigravityAdapter();

  let rawEventName = options.event;
  let parsedPayload: Record<string, unknown> = {};
  let normalizedCount = 0;
  let forwarded = false;

  try {
    const rawInput = await readStdin(stdinStream, timeoutMs);

    if (rawInput) {
      try {
        parsedPayload = JSON.parse(rawInput) as Record<string, unknown>;
      } catch (parseErr) {
        if (process.env.DEBUG_AOE) {
          stderrStream.write(
            `[aoe-bridge] Warning: Malformed JSON input: ${(parseErr as Error).message}\n`,
          );
        }
      }
    }

    if (!rawEventName) {
      if (typeof parsedPayload.hookEventName === 'string') {
        rawEventName = parsedPayload.hookEventName;
      } else if (typeof parsedPayload.hook_event_name === 'string') {
        rawEventName = parsedPayload.hook_event_name;
      } else if ('terminationReason' in parsedPayload || 'termination_reason' in parsedPayload) {
        rawEventName = 'Stop';
      } else if ('toolCall' in parsedPayload || 'tool_call' in parsedPayload) {
        rawEventName = 'error' in parsedPayload ? 'PostToolUse' : 'PreToolUse';
      } else if ('invocationNum' in parsedPayload || 'invocation_num' in parsedPayload) {
        rawEventName = 'PreInvocation';
      } else {
        rawEventName = 'SessionStart';
      }
    }

    const conversationId = String(
      parsedPayload.conversationId ??
        parsedPayload.conversation_id ??
        options.session?.id ??
        'antigravity-session',
    );

    const session =
      options.session ??
      createAdapterSession({
        sessionId: conversationId,
        adapterId: adapter.id,
        agentName: 'antigravity',
        workingDirectory:
          ((parsedPayload.workspacePaths ?? parsedPayload.workspace_paths) as string[])?.[0] ??
          process.cwd(),
      });

    // Normalize events
    const normalizedEvents = adapter.normalize(parsedPayload, session, rawEventName);
    normalizedCount = normalizedEvents.length;

    // Forward to IPC transport safely without blocking
    if (normalizedCount > 0) {
      const socketPath = options.socketPath ?? resolveSocketPath(conversationId);
      const ipcClient = options.ipcClient ?? new UnixSocketIpcClient(socketPath, 150);
      try {
        forwarded = await ipcClient.send(normalizedEvents);
      } catch {
        // Non-blocking fallback if transport fails
        forwarded = false;
      } finally {
        await ipcClient.close().catch(() => {});
      }
    }
  } catch (err) {
    if (process.env.DEBUG_AOE) {
      stderrStream.write(
        `[aoe-bridge] Error during hook bridge processing: ${(err as Error).message}\n`,
      );
    }
  }

  const effectiveEvent = rawEventName ?? 'unknown';
  const response = getAntigravityResponseForEvent(effectiveEvent);

  // Return the documented Antigravity hook response on stdout without contamination
  const responseJson = JSON.stringify(response);
  stdoutStream.write(`${responseJson}\n`);

  return {
    success: true,
    event: effectiveEvent,
    normalizedCount,
    forwarded,
    response,
    durationMs: Date.now() - start,
  };
}
