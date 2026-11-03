import type { AoeEvent, AoeEventType } from '@aoe/protocol';

export interface EventQueryOptions {
  limit?: number;
  offset?: number;
  eventType?: AoeEventType;
  taskId?: string;
}

export class EventStore {
  private readonly eventsBySession: Map<string, AoeEvent[]> = new Map();
  private readonly eventsById: Map<string, AoeEvent> = new Map();
  public readonly maxEventsPerSession: number;

  constructor(maxEventsPerSession = 10000) {
    this.maxEventsPerSession = maxEventsPerSession;
  }

  /**
   * Commits an accepted event to the in-memory store.
   */
  public commit(event: AoeEvent): void {
    let sessionEvents = this.eventsBySession.get(event.sessionId);
    if (!sessionEvents) {
      sessionEvents = [];
      this.eventsBySession.set(event.sessionId, sessionEvents);
    }

    // Check storage limits and apply FIFO eviction if necessary
    if (sessionEvents.length >= this.maxEventsPerSession) {
      const evicted = sessionEvents.shift();
      if (evicted) {
        this.eventsById.delete(evicted.eventId);
      }
    }

    sessionEvents.push(event);
    this.eventsById.set(event.eventId, event);
  }

  /**
   * Retrieves an event by its unique ID.
   */
  public getById(eventId: string): AoeEvent | undefined {
    return this.eventsById.get(eventId);
  }

  /**
   * Retrieves events for a session matching optional query filters.
   */
  public query(sessionId: string, options: EventQueryOptions = {}): readonly AoeEvent[] {
    const sessionEvents = this.eventsBySession.get(sessionId);
    if (!sessionEvents || sessionEvents.length === 0) {
      return [];
    }

    let filtered = sessionEvents;

    if (options.eventType) {
      filtered = filtered.filter((e) => e.eventType === options.eventType);
    }

    if (options.taskId) {
      filtered = filtered.filter((e) => {
        const payload = e.payload as { taskId?: string };
        return payload?.taskId === options.taskId;
      });
    }

    const offset = options.offset ?? 0;
    const limit = options.limit ?? filtered.length;

    return filtered.slice(offset, offset + limit);
  }

  public getSessionEventCount(sessionId: string): number {
    return this.eventsBySession.get(sessionId)?.length ?? 0;
  }

  public clearSession(sessionId: string): void {
    const events = this.eventsBySession.get(sessionId);
    if (events) {
      for (const e of events) {
        this.eventsById.delete(e.eventId);
      }
      this.eventsBySession.delete(sessionId);
    }
  }

  public clearAll(): void {
    this.eventsBySession.clear();
    this.eventsById.clear();
  }
}
