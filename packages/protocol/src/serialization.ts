import { AoeEventSchema, type AoeEvent } from './events/index.js';

export interface SerializeOptions {
  newline?: boolean;
  validate?: boolean;
}

export class ProtocolError extends Error {
  public readonly code:
    'JSON_SYNTAX_ERROR' | 'VALIDATION_ERROR' | 'EMPTY_LINE_ERROR' | 'BUFFER_OVERFLOW';
  public readonly details?: unknown;
  public readonly rawInput?: string;

  constructor(
    code: 'JSON_SYNTAX_ERROR' | 'VALIDATION_ERROR' | 'EMPTY_LINE_ERROR' | 'BUFFER_OVERFLOW',
    message: string,
    options?: { details?: unknown; rawInput?: string; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'ProtocolError';
    this.code = code;
    this.details = options?.details;
    this.rawInput = options?.rawInput;
  }
}

/**
 * Deterministically sorts object keys for reproducible JSON stringification.
 */
function deterministicSort(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(deterministicSort);
  }
  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const result: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    result[key] = deterministicSort(record[key]);
  }
  return result;
}

/**
 * Validates an unknown object against the canonical AoeEvent schema.
 */
export function validateEvent(data: unknown): AoeEvent {
  const result = AoeEventSchema.safeParse(data);
  if (!result.success) {
    throw new ProtocolError(
      'VALIDATION_ERROR',
      `Event validation failed: ${result.error.issues.map((i) => `[${i.path.join('.')}] ${i.message}`).join(', ')}`,
      { details: result.error.issues },
    );
  }
  return result.data as AoeEvent;
}

/**
 * Serializes a validated AOE event into a single-line JSON string (JSONL format).
 */
export function serializeEvent(event: AoeEvent, options: SerializeOptions = {}): string {
  const shouldValidate = options.validate ?? true;
  const shouldAppendNewline = options.newline ?? true;

  const validEvent = shouldValidate ? validateEvent(event) : event;
  const sorted = deterministicSort(validEvent);
  const json = JSON.stringify(sorted);

  return shouldAppendNewline ? `${json}\n` : json;
}

export type ParseResult<T> = { success: true; data: T } | { success: false; error: ProtocolError };

/**
 * Safely parses a single JSONL line into a validated AOE event without throwing.
 */
export function safeParseEvent(line: string): ParseResult<AoeEvent> {
  const trimmed = line.trim();
  if (!trimmed) {
    return {
      success: false,
      error: new ProtocolError('EMPTY_LINE_ERROR', 'Cannot parse empty line', { rawInput: line }),
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(trimmed);
  } catch (err) {
    return {
      success: false,
      error: new ProtocolError('JSON_SYNTAX_ERROR', 'Malformed JSON in event line', {
        rawInput: line,
        cause: err,
      }),
    };
  }

  const validationResult = AoeEventSchema.safeParse(parsedJson);
  if (!validationResult.success) {
    return {
      success: false,
      error: new ProtocolError(
        'VALIDATION_ERROR',
        `Event schema validation failed: ${validationResult.error.issues.map((i) => `[${i.path.join('.')}] ${i.message}`).join(', ')}`,
        { details: validationResult.error.issues, rawInput: line },
      ),
    };
  }

  return { success: true, data: validationResult.data as AoeEvent };
}

/**
 * Parses a single JSONL line into a validated AOE event. Throws ProtocolError on failure.
 */
export function parseEvent(line: string): AoeEvent {
  const result = safeParseEvent(line);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

export interface ParseStreamOptions {
  onError?: (error: ProtocolError, rawLine: string) => void;
  skipMalformed?: boolean;
  maxLineLengthBytes?: number;
}

const DEFAULT_MAX_RECORD_BYTES = 5 * 1024 * 1024; // 5 MB per record

/**
 * Asynchronously parses a stream of string chunks into validated AOE events,
 * correctly buffering incomplete lines across chunk boundaries.
 */
export async function* parseEventStream(
  chunks: AsyncIterable<string> | Iterable<string>,
  options: ParseStreamOptions = {},
): AsyncGenerator<AoeEvent, void, unknown> {
  const maxLineLength = options.maxLineLengthBytes ?? DEFAULT_MAX_RECORD_BYTES;
  let buffer = '';

  for await (const chunk of chunks) {
    buffer += chunk;

    if (buffer.length > maxLineLength && !buffer.includes('\n')) {
      const excess = buffer.length;
      buffer = '';
      const err = new ProtocolError(
        'BUFFER_OVERFLOW',
        `Event line exceeded maximum allowed record size of ${maxLineLength} bytes (received ${excess} bytes without newline).`,
        { rawInput: `[${excess} bytes omitted]` },
      );
      if (options.onError) {
        options.onError(err, `[${excess} bytes omitted]`);
      }
      if (!options.skipMalformed) {
        throw err;
      }
      continue;
    }

    const lines = buffer.split('\n');
    // The last element is either an incomplete line or empty string if chunk ended with \n
    buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        continue; // Skip empty whitespace lines
      }

      const parseResult = safeParseEvent(rawLine);
      if (parseResult.success) {
        yield parseResult.data;
      } else {
        if (options.onError) {
          options.onError(parseResult.error, rawLine);
        }
        if (!options.skipMalformed) {
          throw parseResult.error;
        }
      }
    }
  }

  // Process any residual content in buffer after stream ends
  const remaining = buffer.trim();
  if (remaining) {
    const parseResult = safeParseEvent(remaining);
    if (parseResult.success) {
      yield parseResult.data;
    } else {
      if (options.onError) {
        options.onError(parseResult.error, remaining);
      }
      if (!options.skipMalformed) {
        throw parseResult.error;
      }
    }
  }
}
