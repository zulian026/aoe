import type { AoeEvent } from '@zyanx04/protocol';
import { ConflictingEventIdError } from './errors.js';

interface SeenEventRecord {
  readonly sequence: number;
  readonly eventType: string;
  readonly contentHash: string;
}

/**
 * Generates a simple, deterministic content hash from the event payload and type.
 */
function computeContentHash(event: AoeEvent): string {
  return `${event.eventType}:${JSON.stringify(event.payload)}`;
}

export class DeduplicationStore {
  private readonly records: Map<string, SeenEventRecord> = new Map();
  public readonly sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Checks if an event has already been seen in this session.
   * Throws ConflictingEventIdError if the ID was reused with different content.
   */
  public check(event: AoeEvent): { isDuplicate: boolean; sequence?: number } {
    const existing = this.records.get(event.eventId);
    if (!existing) {
      return { isDuplicate: false };
    }

    const currentHash = computeContentHash(event);
    if (existing.contentHash !== currentHash) {
      throw new ConflictingEventIdError(event.eventId, this.sessionId);
    }

    return { isDuplicate: true, sequence: existing.sequence };
  }

  /**
   * Registers a successfully processed event in the deduplication store.
   */
  public record(event: AoeEvent): void {
    const contentHash = computeContentHash(event);
    this.records.set(event.eventId, {
      sequence: event.sequence,
      eventType: event.eventType,
      contentHash,
    });
  }

  public has(eventId: string): boolean {
    return this.records.has(eventId);
  }

  public clear(): void {
    this.records.clear();
  }

  public get size(): number {
    return this.records.size;
  }
}
