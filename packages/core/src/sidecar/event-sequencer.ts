import type { AoeEvent } from '@zyanx04/protocol';
import type { SequenceCheckResult, SidecarDiagnostic } from './types.js';

/**
 * Monitors and enforces monotonic sequence constraints for the sidecar consumer.
 * Detects duplicates, sequence gaps, and out-of-order events without reordering or fabricating.
 */
export class SidecarEventSequencer {
  private expectedSequence = 0;
  private processedEventIds = new Set<string>();
  private processedSequences = new Set<number>();
  private lastSequence = -1;
  private totalReceived = 0;
  private duplicateCount = 0;
  private gapCount = 0;
  private outOfOrderCount = 0;

  /**
   * Evaluates an incoming event's sequence and identity against historical state.
   */
  public evaluate(event: AoeEvent): SequenceCheckResult {
    this.totalReceived += 1;

    // 1. Duplicate check (by eventId or sequence already seen)
    if (this.processedEventIds.has(event.eventId)) {
      this.duplicateCount += 1;
      const diag: SidecarDiagnostic = {
        level: 'warning',
        code: 'DUPLICATE_EVENT_ID',
        message: `Duplicate event ID received: ${event.eventId} (seq ${event.sequence})`,
        timestamp: new Date().toISOString(),
        details: { eventId: event.eventId, sequence: event.sequence },
      };
      return { accepted: false, anomaly: 'duplicate', diagnostic: diag };
    }

    if (this.processedSequences.has(event.sequence)) {
      this.duplicateCount += 1;
      const diag: SidecarDiagnostic = {
        level: 'warning',
        code: 'DUPLICATE_SEQUENCE',
        message: `Duplicate sequence number received: ${event.sequence} (eventId: ${event.eventId})`,
        timestamp: new Date().toISOString(),
        details: { eventId: event.eventId, sequence: event.sequence },
      };
      return { accepted: false, anomaly: 'duplicate', diagnostic: diag };
    }

    // Record as seen
    this.processedEventIds.add(event.eventId);
    this.processedSequences.add(event.sequence);

    // 2. Out-of-order check (sequence is strictly lower than expected)
    if (event.sequence < this.expectedSequence) {
      this.outOfOrderCount += 1;
      const diag: SidecarDiagnostic = {
        level: 'warning',
        code: 'OUT_OF_ORDER_SEQUENCE',
        message: `Out-of-order event received: expected sequence ${this.expectedSequence}, received ${event.sequence}`,
        timestamp: new Date().toISOString(),
        details: { expected: this.expectedSequence, received: event.sequence },
      };
      // Invariant: Do not silently reorder. Deliver as accepted with an anomaly diagnosis.
      this.lastSequence = Math.max(this.lastSequence, event.sequence);
      return { accepted: true, anomaly: 'out_of_order', diagnostic: diag };
    }

    // 3. Sequence gap check (sequence is strictly higher than expected)
    if (event.sequence > this.expectedSequence) {
      this.gapCount += 1;
      const missingRange = `${this.expectedSequence}..${event.sequence - 1}`;
      const diag: SidecarDiagnostic = {
        level: 'warning',
        code: 'SEQUENCE_GAP',
        message: `Sequence gap detected: missing sequences ${missingRange}, received ${event.sequence}`,
        timestamp: new Date().toISOString(),
        details: { expected: this.expectedSequence, received: event.sequence, missingRange },
      };
      // Invariant: Do not fabricate missing events. Update expected sequence to next after received.
      this.lastSequence = event.sequence;
      this.expectedSequence = event.sequence + 1;
      return { accepted: true, anomaly: 'sequence_gap', diagnostic: diag };
    }

    // 4. Exact expected monotonic sequence
    this.lastSequence = event.sequence;
    this.expectedSequence = event.sequence + 1;
    return { accepted: true };
  }

  public getExpectedSequence(): number {
    return this.expectedSequence;
  }

  public getLastSequence(): number {
    return this.lastSequence;
  }

  public getStats() {
    return {
      lastSequence: this.lastSequence,
      totalEventsReceived: this.totalReceived,
      duplicateCount: this.duplicateCount,
      gapCount: this.gapCount,
      outOfOrderCount: this.outOfOrderCount,
    };
  }

  public reset(): void {
    this.expectedSequence = 0;
    this.processedEventIds.clear();
    this.processedSequences.clear();
    this.lastSequence = -1;
    this.totalReceived = 0;
    this.duplicateCount = 0;
    this.gapCount = 0;
    this.outOfOrderCount = 0;
  }
}
