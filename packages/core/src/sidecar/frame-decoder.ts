import type { FrameDecodeResult } from './types.js';

/**
 * Incremental newline-delimited JSON frame decoder.
 * Buffers partial frames across chunk boundaries and extracts complete lines safely.
 */
export class IncrementalFrameDecoder {
  private buffer = '';
  private maxBufferSize: number;

  constructor(maxBufferSize = 10 * 1024 * 1024) {
    this.maxBufferSize = maxBufferSize;
  }

  /**
   * Pushes a new chunk of data into the decoder buffer and extracts all complete lines.
   */
  public push(chunk: Buffer | string): FrameDecodeResult {
    const chunkStr = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
    this.buffer += chunkStr;

    if (this.buffer.length > this.maxBufferSize) {
      const errorMsg = `Buffer exceeded maximum allowed size of ${this.maxBufferSize} bytes`;
      this.reset();
      return {
        lines: [],
        errors: [{ raw: '', error: errorMsg }],
      };
    }

    const lines: string[] = [];
    const errors: Array<{ raw: string; error: string }> = [];

    // Split on newline characters
    const parts = this.buffer.split('\n');
    // The last element is the un-terminated partial line; keep it in the buffer
    this.buffer = parts.pop() ?? '';

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) {
        continue; // Gracefully ignore empty lines or blank spacing
      }
      lines.push(trimmed);
    }

    return { lines, errors };
  }

  /**
   * Drains any remaining content in the buffer (e.g. on stream EOF).
   */
  public drain(): FrameDecodeResult {
    const lines: string[] = [];
    const trimmed = this.buffer.trim();
    this.buffer = '';

    if (trimmed.length > 0) {
      lines.push(trimmed);
    }

    return { lines, errors: [] };
  }

  /**
   * Resets the internal buffer state.
   */
  public reset(): void {
    this.buffer = '';
  }

  /**
   * Returns the current character size of the un-drained buffer.
   */
  public getBufferSize(): number {
    return this.buffer.length;
  }
}
