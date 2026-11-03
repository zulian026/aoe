import { describe, it, expect } from 'vitest';
import { BaseEnvelopeSchema, PROTOCOL_VERSION } from '../index.js';

describe('Envelope Schema Validation', () => {
  const validEnvelope = {
    protocolVersion: PROTOCOL_VERSION,
    eventId: 'evt_01h9x7b6',
    sessionId: 'sess_dev_123',
    sequence: 0,
    timestamp: '2026-11-03T10:00:00.000Z',
  };

  it('validates a compliant base envelope', () => {
    const parsed = BaseEnvelopeSchema.safeParse(validEnvelope);
    expect(parsed.success).toBe(true);
  });

  it('rejects unsupported protocolVersion', () => {
    const parsed = BaseEnvelopeSchema.safeParse({
      ...validEnvelope,
      protocolVersion: '2.0.0',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects negative sequence numbers', () => {
    const parsed = BaseEnvelopeSchema.safeParse({
      ...validEnvelope,
      sequence: -1,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects fractional sequence numbers', () => {
    const parsed = BaseEnvelopeSchema.safeParse({
      ...validEnvelope,
      sequence: 1.5,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid timestamp format', () => {
    const parsed = BaseEnvelopeSchema.safeParse({
      ...validEnvelope,
      timestamp: 'invalid-date-string',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects empty eventId or sessionId', () => {
    expect(BaseEnvelopeSchema.safeParse({ ...validEnvelope, eventId: '' }).success).toBe(false);
    expect(BaseEnvelopeSchema.safeParse({ ...validEnvelope, sessionId: '' }).success).toBe(false);
  });
});
