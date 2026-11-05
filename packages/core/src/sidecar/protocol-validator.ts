import { validateEvent, type AoeEvent, PROTOCOL_VERSION } from '@zyanx04/protocol';

export type ValidationOutcome =
  { valid: true; event: AoeEvent } | { valid: false; error: string; raw: unknown };

/**
 * Validates raw data or JSON strings against canonical AOE Protocol v1.0.0.
 */
export function validateCanonicalEvent(input: string | unknown): ValidationOutcome {
  let parsed: unknown = input;

  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch (err) {
      return {
        valid: false,
        error: `JSON parse error: ${(err as Error).message}`,
        raw: input,
      };
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      valid: false,
      error: 'Event payload must be a non-null JSON object',
      raw: parsed,
    };
  }

  const rec = parsed as Record<string, unknown>;
  if (rec.protocolVersion !== PROTOCOL_VERSION) {
    return {
      valid: false,
      error: `Unsupported protocol version "${String(rec.protocolVersion)}". Expected "${PROTOCOL_VERSION}"`,
      raw: parsed,
    };
  }

  try {
    const validEvent = validateEvent(parsed);
    return { valid: true, event: validEvent };
  } catch (err) {
    return {
      valid: false,
      error: (err as Error).message,
      raw: parsed,
    };
  }
}
