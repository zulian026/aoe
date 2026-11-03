import type { AoeEvent } from '@aoe/protocol';
import type { TerminalRenderer } from '@aoe/renderer';
import type {
  EngineConfig,
  EventProcessingResult,
  SessionSnapshot,
  StateListener,
  UnsubscribeFn,
} from './types.js';
import { SessionManager, type CreateSessionOptions } from './session-manager.js';
import { EventStore, type EventQueryOptions } from './event-store.js';
import { StateDispatcher } from './state-dispatcher.js';
import { EventProcessor } from './event-processor.js';

export interface EngineOptions extends EngineConfig {
  renderer?: TerminalRenderer;
}

export class Engine {
  private readonly sessionManager: SessionManager;
  private readonly eventStore: EventStore;
  private readonly dispatcher: StateDispatcher;
  private readonly processor: EventProcessor;
  private readonly renderer?: TerminalRenderer;
  private lastSessionId: string | null = null;

  constructor(options: EngineOptions = {}) {
    this.renderer = options.renderer;
    this.sessionManager = new SessionManager(options.maxBufferSize ?? 100);
    this.eventStore = new EventStore(options.maxEventsPerSession ?? 10000);
    this.dispatcher = new StateDispatcher(options.coalesceUpdates ?? false);
    this.processor = new EventProcessor({
      sessionManager: this.sessionManager,
      eventStore: this.eventStore,
      dispatcher: this.dispatcher,
    });
  }

  public getRenderer(): TerminalRenderer | undefined {
    return this.renderer;
  }

  /**
   * Explicitly registers a new session in the engine.
   */
  public createSession(options: CreateSessionOptions): SessionSnapshot {
    const container = this.sessionManager.createSession(options);
    this.lastSessionId = options.sessionId;
    return container.toSnapshot(0);
  }

  /**
   * Processes an incoming event through the atomic engine pipeline.
   * Supports both canonical AoeEvent objects and legacy envelopes.
   */
  public processEvent(event: AoeEvent | Record<string, unknown>): EventProcessingResult {
    // Normalization for legacy M00 event mocks if present
    const normalized = this.normalizeLegacyEvent(event);

    const result = this.processor.process(normalized);
    if (result.status === 'accepted') {
      this.lastSessionId = result.event.sessionId;
    }
    return result;
  }

  /**
   * Retrieves an immutable state snapshot for a given session.
   */
  public getSessionSnapshot(sessionId: string): SessionSnapshot | null {
    const container = this.sessionManager.getSession(sessionId);
    if (!container) {
      return null;
    }
    return container.toSnapshot(this.eventStore.getSessionEventCount(sessionId));
  }

  /**
   * Retrieves the most recent session or a specific session.
   * Maintained for backwards compatibility with M00 tests.
   */
  public getSession(sessionId?: string): {
    id: string;
    startedAt: string;
    status: 'active' | 'paused' | 'completed' | 'failed';
    eventsProcessed: number;
  } | null {
    const targetId = sessionId ?? this.lastSessionId;
    if (!targetId) {
      return null;
    }
    const container = this.sessionManager.getSession(targetId);
    if (!container) {
      return null;
    }
    const eventCount = this.eventStore.getSessionEventCount(targetId);
    return {
      id: container.sessionId,
      startedAt: container.startedAt,
      status:
        container.status === 'completed'
          ? 'completed'
          : container.status === 'failed'
            ? 'failed'
            : 'active',
      eventsProcessed: eventCount,
    };
  }

  /**
   * Lists state snapshots for all registered sessions.
   */
  public listSessions(): SessionSnapshot[] {
    return this.sessionManager
      .listSessions()
      .map((container) =>
        container.toSnapshot(this.eventStore.getSessionEventCount(container.sessionId)),
      );
  }

  /**
   * Queries stored events for a session.
   */
  public getEvents(sessionId: string, options?: EventQueryOptions): readonly AoeEvent[] {
    return this.eventStore.query(sessionId, options);
  }

  /**
   * Subscribes a listener to state updates for a specific session.
   */
  public subscribe(sessionId: string, listener: StateListener): UnsubscribeFn {
    return this.dispatcher.subscribe(sessionId, listener);
  }

  /**
   * Subscribes a listener to state updates across all sessions.
   */
  public subscribeAll(listener: StateListener): UnsubscribeFn {
    return this.dispatcher.subscribeAll(listener);
  }

  /**
   * Disposes the engine and frees all session resources.
   */
  public dispose(): void {
    this.sessionManager.clear();
    this.eventStore.clearAll();
    this.dispatcher.clear();
    this.lastSessionId = null;
  }

  /**
   * Normalizes legacy M00 event envelope shapes into canonical AoeEvent shapes.
   */
  private normalizeLegacyEvent(raw: unknown): unknown {
    if (raw && typeof raw === 'object') {
      const record = raw as Record<string, unknown>;
      if (!record.eventType && record.event) {
        return {
          protocolVersion: '1.0.0',
          eventId: (record.eventId as string) || `evt_legacy_${Date.now()}`,
          sessionId: record.sessionId,
          sequence: record.sequence ?? 0,
          timestamp: record.timestamp || new Date().toISOString(),
          eventType: 'session.started',
          payload: {
            agent: { name: 'legacy-agent' },
            workingDirectory: (record.workingDirectory as string) || process.cwd(),
          },
        };
      }
    }
    return raw;
  }
}
