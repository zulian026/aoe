import { describe, it, expect } from 'vitest';
import { PROTOCOL_NAME, PROTOCOL_VERSION, ProtocolEnvelopeSchema } from './index.js';

describe('@aoe/protocol', () => {
  it('exports expected protocol name and version', () => {
    expect(PROTOCOL_NAME).toBe('aoe');
    expect(PROTOCOL_VERSION).toBe('1.0.0');
  });

  it('validates a valid envelope', () => {
    const validEnvelope = {
      protocol: 'aoe',
      version: '1.0.0',
      timestamp: '2026-11-03T10:00:00.000Z',
      sessionId: 'sess_123',
      sequence: 0,
      event: 'session.start',
      data: { agent: 'claude-code' },
    };

    const parsed = ProtocolEnvelopeSchema.safeParse(validEnvelope);
    expect(parsed.success).toBe(true);
  });

  it('rejects an envelope with invalid protocol name or missing fields', () => {
    const invalidEnvelope = {
      protocol: 'wrong',
      version: '1.0.0',
    };

    const parsed = ProtocolEnvelopeSchema.safeParse(invalidEnvelope);
    expect(parsed.success).toBe(false);
  });
});
