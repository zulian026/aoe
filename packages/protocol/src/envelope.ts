import { z } from 'zod';
import { PROTOCOL_VERSION } from './constants.js';

export const EventIdSchema = z
  .string()
  .min(1, 'eventId cannot be empty')
  .max(128, 'eventId cannot exceed 128 characters');

export const SessionIdSchema = z
  .string()
  .min(1, 'sessionId cannot be empty')
  .max(128, 'sessionId cannot exceed 128 characters');

export const SequenceSchema = z
  .number()
  .int('sequence must be an integer')
  .nonnegative('sequence must be non-negative');

export const TimestampSchema = z
  .string()
  .datetime({ message: 'timestamp must be an ISO 8601 UTC string' });

export const BaseEnvelopeSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  eventId: EventIdSchema,
  sessionId: SessionIdSchema,
  sequence: SequenceSchema,
  timestamp: TimestampSchema,
});

export type BaseEnvelope = z.infer<typeof BaseEnvelopeSchema>;
