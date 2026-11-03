import { z } from 'zod';

export const PROTOCOL_NAME = 'aoe';
export const PROTOCOL_VERSION = '1.0.0';

export const ProtocolEnvelopeSchema = z.object({
  protocol: z.literal(PROTOCOL_NAME),
  version: z.literal(PROTOCOL_VERSION),
  timestamp: z.string().datetime(),
  sessionId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  event: z.string().min(1),
  data: z.unknown(),
});

export type ProtocolEnvelope<T = unknown> = {
  protocol: typeof PROTOCOL_NAME;
  version: typeof PROTOCOL_VERSION;
  timestamp: string;
  sessionId: string;
  sequence: number;
  event: string;
  data: T;
};
