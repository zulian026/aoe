import { AntigravityAdapter } from './adapter.js';
import { UnixSocketIpcClient, resolveSocketPath, type IpcClient } from './ipc-transport.js';
import { AntigravitySessionStore } from './state-store.js';
import { ALLOWED_HOOK_EVENTS, type AntigravityHookEventName } from './mapper.js';
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
  store?: AntigravitySessionStore;
}

export interface HookBridgeResult {
  success: boolean;
  event: string;
  normalizedCount: number;
  forwarded: boolean;
  response: Record<string, unknown>;
  durationMs: number;
  error?: string;
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

    const cleanup = () => {
      stream.removeListener('data', onData);
      stream.removeListener('end', onEnd);
      stream.removeListener('error', onError);
    };

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(data.trim());
      }
    }, timeoutMs);

    const onData = (chunk: Buffer | string) => {
      data += chunk.toString();
    };

    const onEnd = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        cleanup();
        resolve(data.trim());
      }
    };

    const onError = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        cleanup();
        resolve(data.trim());
      }
    };

    stream.on('data', onData);
    stream.on('end', onEnd);
    stream.on('error', onError);

    // Resume stream if paused
    if (typeof (stream as { resume?: () => void }).resume === 'function') {
      (stream as { resume: () => void }).resume();
    }
  });
}

/**
 * Executes the stateful non-blocking Antigravity hook bridge.
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
  let bridgeError: string | undefined;

  try {
    const rawInput = await readStdin(stdinStream, timeoutMs);

    if (rawInput) {
      try {
        parsedPayload = JSON.parse(rawInput) as Record<string, unknown>;
      } catch (parseErr) {
        bridgeError = `Malformed JSON input: ${(parseErr as Error).message}`;
        stderrStream.write(`[aoe-bridge] Warning: ${bridgeError}\n`);
      }
    }

    if (!rawEventName) {
      if (typeof parsedPayload.hookEventName === 'string') {
        rawEventName = parsedPayload.hookEventName;
      } else if (typeof parsedPayload.hook_event_name === 'string') {
        rawEventName = parsedPayload.hook_event_name;
      }
    }

    // Phase 3: Validate event explicitly
    if (!rawEventName) {
      bridgeError =
        'Missing explicit hook event name. Please specify --event <SessionStart|PreInvocation|PreToolUse|PostToolUse|Stop>.';
      stderrStream.write(`[aoe-bridge] Error: ${bridgeError}\n`);
    } else if (!ALLOWED_HOOK_EVENTS.includes(rawEventName as AntigravityHookEventName)) {
      bridgeError = `Unknown hook event "${rawEventName}". Allowed: ${ALLOWED_HOOK_EVENTS.join(', ')}`;
      stderrStream.write(`[aoe-bridge] Error: ${bridgeError}\n`);
    }

    const conversationId = String(
      parsedPayload.conversationId ??
        parsedPayload.conversation_id ??
        options.session?.id ??
        'default',
    );

    // Phase 1: Stateful Session Authority
    const store = options.store ?? new AntigravitySessionStore(conversationId);

    const session =
      options.session ??
      createAdapterSession({
        sessionId: conversationId,
        adapterId: adapter.id,
        agentName: 'antigravity',
        workingDirectory:
          ((parsedPayload.workspacePaths ?? parsedPayload.workspace_paths) as string[])?.[0] ??
          process.cwd(),
        metadata: { sessionStore: store },
      });

    // Normalize events if event name is valid
    if (rawEventName && ALLOWED_HOOK_EVENTS.includes(rawEventName as AntigravityHookEventName)) {
      const normalizedEvents = adapter.normalize(parsedPayload, session, rawEventName, store);
      normalizedCount = normalizedEvents.length;

      // Forward to IPC transport safely without blocking
      if (normalizedCount > 0) {
        const socketPath = options.socketPath ?? resolveSocketPath(conversationId);
        const ipcClient = options.ipcClient ?? new UnixSocketIpcClient(socketPath, 150);
        try {
          forwarded = await ipcClient.send(normalizedEvents);
        } catch {
          forwarded = false;
        } finally {
          await ipcClient.close().catch(() => {});
        }
      }
    }
  } catch (err) {
    bridgeError = (err as Error).message;
    stderrStream.write(`[aoe-bridge] Error during hook bridge processing: ${bridgeError}\n`);
  }

  const effectiveEvent = rawEventName ?? 'unknown';
  const response = getAntigravityResponseForEvent(effectiveEvent);

  // Return the documented Antigravity hook response on stdout without contamination
  const responseJson = JSON.stringify(response);
  await new Promise<void>((resolve) => {
    stdoutStream.write(`${responseJson}\n`, 'utf-8', () => {
      resolve();
    });
  });

  return {
    success: bridgeError === undefined,
    event: effectiveEvent,
    normalizedCount,
    forwarded,
    response,
    durationMs: Date.now() - start,
    error: bridgeError,
  };
}
