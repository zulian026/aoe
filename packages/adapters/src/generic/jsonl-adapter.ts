import {
  validateEvent,
  PROTOCOL_VERSION,
  type AoeEvent,
  type ProtocolEnvelope,
} from '@aoe/protocol';
import type {
  AgentAdapter,
  AgentKind,
  AdapterContext,
  AdapterDetectionResult,
  AdapterSession,
} from '../contracts/index.js';
import { createAdapterSession } from '../contracts/session.js';
import { AdapterParsingError, AdapterValidationError } from '../errors/index.js';
import { JsonlParser } from './jsonl-parser.js';
import { sanitizePayload } from '../utils/sanitizer.js';

export interface JsonlAdapterOptions {
  id?: string;
  maxLineLengthBytes?: number;
}

export class JsonlAdapter implements AgentAdapter {
  public readonly id: string;
  public readonly name = 'Generic JSONL Adapter';
  public readonly version = '1.0.0';
  public readonly kind: AgentKind = 'generic';
  public readonly supportedCategories = [
    'session',
    'task',
    'progress',
    'log',
    'file',
    'diagnostic',
    'result',
    'error',
  ] as const;

  private readonly parser: JsonlParser;

  constructor(options: JsonlAdapterOptions = {}) {
    this.id = options.id ?? 'jsonl';
    this.parser = new JsonlParser({
      maxLineLengthBytes: options.maxLineLengthBytes,
      adapterId: this.id,
    });
  }

  public detect(context: AdapterContext): AdapterDetectionResult {
    const metaFormat = context.metadata?.format;
    const isJsonlFormat = metaFormat === 'jsonl' || metaFormat === 'json-lines';
    const filePath =
      typeof context.metadata?.filePath === 'string' ? context.metadata.filePath : '';

    if (isJsonlFormat || filePath.endsWith('.jsonl')) {
      return {
        detected: true,
        confidence: 'high',
        agentName: 'generic-jsonl',
        evidence: ['format=jsonl metadata or .jsonl extension detected'],
      };
    }

    return {
      detected: true,
      confidence: 'low',
      agentName: 'generic-jsonl',
      evidence: ['Default universal fallback adapter'],
    };
  }

  public initialize(context: AdapterContext, sessionId?: string): AdapterSession {
    this.parser.reset();
    return createAdapterSession({
      sessionId,
      adapterId: this.id,
      agentName: 'generic-jsonl',
      workingDirectory: context.workingDirectory,
      metadata: context.metadata,
    });
  }

  public normalize(input: unknown, session: AdapterSession): AoeEvent[] {
    const rawLines: string[] = [];

    if (typeof input === 'string') {
      rawLines.push(...this.parser.push(input));
    } else if (Array.isArray(input)) {
      for (const item of input) {
        if (typeof item === 'string') {
          rawLines.push(...this.parser.push(item));
        } else if (item && typeof item === 'object') {
          // Object passed directly
          return [this.validateAndCorrelate(item, session)];
        }
      }
    } else if (input && typeof input === 'object') {
      return [this.validateAndCorrelate(input, session)];
    } else {
      throw new AdapterParsingError(
        'Invalid input type provided to JsonlAdapter. Expected string, array, or object.',
        {
          adapterId: this.id,
          rawInput: String(input),
        },
      );
    }

    const events: AoeEvent[] = [];

    for (const line of rawLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch (err) {
        throw new AdapterParsingError(
          `Malformed JSON record on line ${this.parser.getLineNumber()}: ${(err as Error).message}`,
          {
            adapterId: this.id,
            rawInput: trimmed,
            lineNumber: this.parser.getLineNumber(),
            cause: err,
          },
        );
      }

      events.push(this.validateAndCorrelate(parsed, session, trimmed));
    }

    return events;
  }

  /**
   * Flushes any remaining buffered lines and normalizes them.
   */
  public flush(session: AdapterSession): AoeEvent[] {
    const remainingLines = this.parser.flush();
    const events: AoeEvent[] = [];

    for (const line of remainingLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch (err) {
        throw new AdapterParsingError(
          `Malformed JSON record at end of stream: ${(err as Error).message}`,
          {
            adapterId: this.id,
            rawInput: trimmed,
            lineNumber: this.parser.getLineNumber(),
            cause: err,
          },
        );
      }

      events.push(this.validateAndCorrelate(parsed, session, trimmed));
    }

    return events;
  }

  public dispose(): void {
    this.parser.reset();
  }

  private validateAndCorrelate(
    rawEvent: unknown,
    session: AdapterSession,
    rawInput?: string,
  ): AoeEvent {
    if (!rawEvent || typeof rawEvent !== 'object') {
      throw new AdapterParsingError(
        'JSON record must be an object representing an AOE protocol event.',
        {
          adapterId: this.id,
          rawInput,
        },
      );
    }

    const eventRecord = rawEvent as Record<string, unknown>;

    // Ensure session correlation:
    // If incoming event specifies a sessionId and sequence, preserve them.
    // If missing, correlate to the active session.
    const resolvedSessionId =
      typeof eventRecord.sessionId === 'string' && eventRecord.sessionId.length > 0
        ? eventRecord.sessionId
        : session.id;

    const resolvedSequence =
      typeof eventRecord.sequence === 'number' &&
      Number.isInteger(eventRecord.sequence) &&
      eventRecord.sequence >= 0
        ? eventRecord.sequence
        : session.nextSequence();

    const resolvedEventType = (eventRecord.eventType ?? eventRecord.type) as string;

    // If payload is not an explicit object, package residual fields as payload
    let resolvedPayload = eventRecord.payload;
    if (!resolvedPayload || typeof resolvedPayload !== 'object') {
      const {
        protocolVersion: _pv,
        eventId: _ei,
        sessionId: _si,
        sequence: _seq,
        timestamp: _ts,
        eventType: _et,
        type: _t,
        ...rest
      } = eventRecord;
      resolvedPayload = rest;
    }

    const candidate: Record<string, unknown> = {
      protocolVersion: PROTOCOL_VERSION,
      ...eventRecord,
      eventType: resolvedEventType,
      payload: resolvedPayload,
      sessionId: resolvedSessionId,
      sequence: resolvedSequence,
    };

    // Ensure eventId and timestamp exist
    if (!candidate.eventId || typeof candidate.eventId !== 'string') {
      candidate.eventId = `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    }
    if (!candidate.timestamp || typeof candidate.timestamp !== 'string') {
      candidate.timestamp = new Date().toISOString();
    }

    // Sanitize secrets and private reasoning from payload
    const sanitizedCandidate = sanitizePayload(candidate);

    try {
      return validateEvent(sanitizedCandidate);
    } catch (err) {
      throw new AdapterValidationError(
        `Event failed canonical AOE protocol validation: ${(err as Error).message}`,
        {
          adapterId: this.id,
          cause: err,
        },
      );
    }
  }

  // --- Legacy M00 compatibility ---

  public canHandle(_input: unknown): boolean {
    return this.detect({ metadata: { format: 'jsonl' } }).detected;
  }

  public transform(rawChunk: string): ProtocolEnvelope[] {
    const session = createAdapterSession({ adapterId: this.id, agentName: 'generic' });
    const events = this.normalize(rawChunk, session);
    return events.map((e) => ({
      protocolVersion: e.protocolVersion,
      eventId: e.eventId,
      sessionId: e.sessionId,
      sequence: e.sequence,
      timestamp: e.timestamp,
      eventType: e.eventType,
      payload: e.payload,
    }));
  }
}
