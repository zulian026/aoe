import type { AoeEvent } from '@aoe/protocol';
import { BufferOverflowError } from './errors.js';

export type SequenceEvaluation =
  | { readonly kind: 'next'; readonly sequence: number }
  | { readonly kind: 'duplicate'; readonly sequence: number; readonly expected: number }
  | { readonly kind: 'out_of_order'; readonly sequence: number; readonly expected: number };

export class SequenceTracker {
  private expectedSequence = 0;
  private readonly buffer: Map<number, AoeEvent> = new Map();
  public readonly maxBufferSize: number;
  public readonly sessionId: string;

  constructor(sessionId: string, maxBufferSize = 100) {
    this.sessionId = sessionId;
    this.maxBufferSize = maxBufferSize;
  }

  public getExpectedSequence(): number {
    return this.expectedSequence;
  }

  public getLastAcceptedSequence(): number {
    return Math.max(0, this.expectedSequence - 1);
  }

  public getBufferSize(): number {
    return this.buffer.size;
  }

  /**
   * Evaluates the sequence number of an incoming event.
   */
  public evaluate(sequence: number): SequenceEvaluation {
    if (sequence === this.expectedSequence) {
      return { kind: 'next', sequence };
    }
    if (sequence < this.expectedSequence) {
      return { kind: 'duplicate', sequence, expected: this.expectedSequence };
    }
    return { kind: 'out_of_order', sequence, expected: this.expectedSequence };
  }

  /**
   * Advances the expected sequence number after an event is successfully processed.
   */
  public advance(): void {
    this.expectedSequence += 1;
  }

  /**
   * Buffers an out-of-order event for later re-processing.
   */
  public bufferEvent(event: AoeEvent): void {
    if (this.buffer.size >= this.maxBufferSize) {
      throw new BufferOverflowError(this.sessionId, this.maxBufferSize);
    }
    this.buffer.set(event.sequence, event);
  }

  /**
   * Checks if an event is currently held in the out-of-order buffer.
   */
  public isBuffered(sequence: number): boolean {
    return this.buffer.has(sequence);
  }

  /**
   * Drains consecutive buffered events starting from the current expectedSequence.
   * Returns the list of sequentially contiguous events in order.
   */
  public drainContiguous(): AoeEvent[] {
    const contiguous: AoeEvent[] = [];
    while (this.buffer.has(this.expectedSequence)) {
      const nextEvent = this.buffer.get(this.expectedSequence)!;
      this.buffer.delete(this.expectedSequence);
      contiguous.push(nextEvent);
      this.expectedSequence += 1;
    }
    return contiguous;
  }

  /**
   * Reports missing sequence ranges if gaps exist in the buffer.
   */
  public getMissingRanges(): Array<[number, number]> {
    if (this.buffer.size === 0) {
      return [];
    }
    const sequences = Array.from(this.buffer.keys()).sort((a, b) => a - b);
    const ranges: Array<[number, number]> = [];

    let currentExpected = this.expectedSequence;
    for (const seq of sequences) {
      if (seq > currentExpected) {
        ranges.push([currentExpected, seq - 1]);
      }
      currentExpected = seq + 1;
    }
    return ranges;
  }

  public clear(): void {
    this.buffer.clear();
  }
}
