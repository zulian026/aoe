import { z } from 'zod';
import { PROTOCOL_NAME, PROTOCOL_VERSION } from './constants.js';

export * from './constants.js';
export * from './envelope.js';
export * from './events/index.js';
export * from './serialization.js';
export * from './helpers.js';

// Backwards-compatible legacy envelope schema for M00 callers
export const ProtocolEnvelopeSchema = z.object({
  protocol: z.literal(PROTOCOL_NAME).optional(),
  version: z.literal(PROTOCOL_VERSION).optional(),
  protocolVersion: z.literal(PROTOCOL_VERSION).optional(),
  eventId: z.string().optional(),
  timestamp: z.string(),
  sessionId: z.string(),
  sequence: z.number().int().nonnegative(),
  event: z.string().optional(),
  eventType: z.string().optional(),
  data: z.unknown().optional(),
  payload: z.unknown().optional(),
});

export type ProtocolEnvelope<T = unknown> = {
  protocol?: typeof PROTOCOL_NAME;
  version?: typeof PROTOCOL_VERSION;
  protocolVersion?: typeof PROTOCOL_VERSION;
  eventId?: string;
  timestamp: string;
  sessionId: string;
  sequence: number;
  event?: string;
  eventType?: string;
  data?: T;
  payload?: T;
};
