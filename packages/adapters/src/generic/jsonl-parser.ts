import { AdapterParsingError } from '../errors/index.js';

export interface JsonlParserOptions {
  maxLineLengthBytes?: number;
  adapterId?: string;
}

const DEFAULT_MAX_LINE_LENGTH = 1024 * 1024; // 1 MB

export class JsonlParser {
  private buffer = '';
  private lineNumber = 0;
  private readonly maxLineLength: number;
  private readonly adapterId: string;

  constructor(options: JsonlParserOptions = {}) {
    this.maxLineLength = options.maxLineLengthBytes ?? DEFAULT_MAX_LINE_LENGTH;
    this.adapterId = options.adapterId ?? 'jsonl';
  }

  /**
   * Appends an incoming text chunk to the parser buffer and extracts complete lines.
   */
  public push(chunk: string): string[] {
    if (!chunk) return [];

    this.buffer += chunk;

    if (this.buffer.length > this.maxLineLength && !this.buffer.includes('\n')) {
      const excess = this.buffer.length;
      this.buffer = '';
      throw new AdapterParsingError(
        `JSONL input line exceeded maximum allowed buffer size of ${this.maxLineLength} bytes (received ${excess} bytes).`,
        { adapterId: this.adapterId, lineNumber: this.lineNumber + 1 },
      );
    }

    const lines: string[] = [];
    let newlineIndex = this.buffer.indexOf('\n');

    while (newlineIndex !== -1) {
      this.lineNumber += 1;
      let line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      // Handle carriage return
      if (line.endsWith('\r')) {
        line = line.slice(0, -1);
      }

      line = line.trim();
      if (line.length > 0) {
        lines.push(line);
      }

      newlineIndex = this.buffer.indexOf('\n');
    }

    return lines;
  }

  /**
   * Flushes any remaining non-empty content in the buffer (e.g. at end of stream).
   */
  public flush(): string[] {
    const lines: string[] = [];
    const remaining = this.buffer.trim();
    this.buffer = '';

    if (remaining.length > 0) {
      this.lineNumber += 1;
      lines.push(remaining);
    }

    return lines;
  }

  /**
   * Resets the parser state and clears all buffered data.
   */
  public reset(): void {
    this.buffer = '';
    this.lineNumber = 0;
  }

  /**
   * Gets the current 1-based line number count.
   */
  public getLineNumber(): number {
    return this.lineNumber;
  }
}
