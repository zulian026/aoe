import {
  PROTOCOL_VERSION,
  createEventId,
  validateEvent,
  type AoeEvent,
  type SessionEndedEvent,
} from '@aoe/protocol';
import type {
  AgentAdapter,
  AdapterContext,
  AdapterDetectionResult,
  AdapterSession,
} from '../contracts/index.js';
import {
  AdapterNotFoundError,
  DuplicateAdapterError,
  AdapterSessionError,
} from '../errors/index.js';
import { JsonlAdapter } from '../generic/jsonl-adapter.js';
import { ClaudeCodeAdapter } from '../agents/claude-code/adapter.js';
import { GeminiCliAdapter } from '../agents/gemini-cli/adapter.js';

export interface RegisterAdapterOptions {
  replace?: boolean;
}

export type EventDispatchListener = (event: AoeEvent) => void;

export class AdapterManager {
  private readonly adapters = new Map<string, AgentAdapter>();
  private readonly sessions = new Map<string, { adapter: AgentAdapter; session: AdapterSession }>();
  private readonly listeners = new Set<EventDispatchListener>();

  /**
   * Registers a new AgentAdapter into the manager.
   * Throws DuplicateAdapterError if an adapter with the same ID exists unless replace=true.
   */
  public register(adapter: AgentAdapter, options: RegisterAdapterOptions = {}): void {
    if (!adapter || !adapter.id) {
      throw new Error('Adapter must provide a valid id.');
    }

    if (this.adapters.has(adapter.id) && !options.replace) {
      throw new DuplicateAdapterError(adapter.id);
    }

    this.adapters.set(adapter.id, adapter);
  }

  /**
   * Unregisters an adapter by ID.
   */
  public unregister(adapterId: string): boolean {
    return this.adapters.delete(adapterId);
  }

  /**
   * Retrieves an adapter by its ID.
   */
  public get(adapterId: string): AgentAdapter | undefined {
    return this.adapters.get(adapterId);
  }

  /**
   * Checks whether an adapter is registered.
   */
  public has(adapterId: string): boolean {
    return this.adapters.has(adapterId);
  }

  /**
   * Lists all registered adapters.
   */
  public list(): AgentAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Evaluates all registered adapters against an execution context and returns detection results.
   */
  public async detect(
    context: AdapterContext,
  ): Promise<Array<{ adapter: AgentAdapter; result: AdapterDetectionResult }>> {
    const results: Array<{ adapter: AgentAdapter; result: AdapterDetectionResult }> = [];

    for (const adapter of this.adapters.values()) {
      try {
        const result = await Promise.resolve(adapter.detect(context));
        results.push({ adapter, result });
      } catch (err) {
        results.push({
          adapter,
          result: {
            detected: false,
            confidence: 'none',
            details: { error: (err as Error).message },
          },
        });
      }
    }

    return results;
  }

  /**
   * Initializes a new session for a specific adapter ID.
   */
  public async createSession(
    adapterId: string,
    context: AdapterContext,
    sessionId?: string,
  ): Promise<AdapterSession> {
    const adapter = this.adapters.get(adapterId);
    if (!adapter) {
      throw new AdapterNotFoundError(adapterId, Array.from(this.adapters.keys()));
    }

    const session = await Promise.resolve(adapter.initialize(context, sessionId));
    this.sessions.set(session.id, { adapter, session });
    return session;
  }

  /**
   * Retrieves an active adapter session by ID.
   */
  public getSession(sessionId: string): AdapterSession | undefined {
    return this.sessions.get(sessionId)?.session;
  }

  /**
   * Lists all currently tracked active adapter sessions.
   */
  public listSessions(): AdapterSession[] {
    return Array.from(this.sessions.values()).map((entry) => entry.session);
  }

  /**
   * Ingests agent telemetry into an active session, normalizes into canonical events,
   * dispatches them to registered listeners, and returns the events.
   */
  public async ingest(sessionId: string, input: unknown): Promise<AoeEvent[]> {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      throw new AdapterSessionError(`Session "${sessionId}" not found or already disposed.`, {
        sessionId,
      });
    }

    const { adapter, session } = entry;

    if (session.status === 'disposed') {
      throw new AdapterSessionError(`Cannot ingest events into disposed session "${sessionId}".`, {
        sessionId,
        adapterId: adapter.id,
      });
    }

    const normalized: AoeEvent[] = await Promise.resolve(adapter.normalize(input, session));

    // Dispatch to registered event listeners
    for (const event of normalized) {
      for (const listener of this.listeners) {
        try {
          listener(event);
        } catch (listenerErr) {
          if (process.env.NODE_ENV !== 'test') {
            console.error('[AdapterManager] Error in event dispatch listener:', listenerErr);
          }
        }
      }
    }

    return normalized;
  }

  /**
   * Subscribes to normalized events emitted across all managed sessions.
   */
  public onEvent(listener: EventDispatchListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Ends an active session, emitting a session.ended event and marking it completed.
   */
  public async endSession(sessionId: string, summary?: string): Promise<AoeEvent | null> {
    const entry = this.sessions.get(sessionId);
    if (!entry) return null;

    const { session } = entry;
    if (session.status === 'completed' || session.status === 'disposed') {
      return null;
    }

    session.status = 'completed';

    const endEvent: SessionEndedEvent = {
      protocolVersion: PROTOCOL_VERSION,
      eventId: createEventId('evt'),
      sessionId: session.id,
      sequence: session.nextSequence(),
      timestamp: new Date().toISOString(),
      eventType: 'session.ended',
      payload: {
        status: 'completed',
        summary: summary ?? 'Session ended via AdapterManager',
      },
    };

    const validated = validateEvent(endEvent);

    for (const listener of this.listeners) {
      try {
        listener(validated);
      } catch {
        // Safe listener dispatch
      }
    }

    return validated;
  }

  /**
   * Disposes a specific session and removes it from active tracking.
   */
  public async disposeSession(sessionId: string): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (!entry) return;

    entry.session.status = 'disposed';
    this.sessions.delete(sessionId);
  }

  /**
   * Disposes all active sessions and registered adapters.
   */
  public async dispose(): Promise<void> {
    // 1. Mark and clear all sessions
    for (const sessionId of Array.from(this.sessions.keys())) {
      await this.disposeSession(sessionId);
    }
    this.sessions.clear();

    // 2. Dispose all registered adapters
    for (const adapter of this.adapters.values()) {
      try {
        await Promise.resolve(adapter.dispose());
      } catch (err) {
        if (process.env.NODE_ENV !== 'test') {
          console.error(`[AdapterManager] Error disposing adapter "${adapter.id}":`, err);
        }
      }
    }

    // 3. Clear listeners
    this.listeners.clear();
  }
}

/**
 * Creates an AdapterManager pre-registered with the default adapters.
 */
export function createDefaultAdapterManager(): AdapterManager {
  const manager = new AdapterManager();
  manager.register(new JsonlAdapter());
  manager.register(new ClaudeCodeAdapter());
  manager.register(new GeminiCliAdapter());
  return manager;
}

export const defaultAdapterManager = createDefaultAdapterManager();
