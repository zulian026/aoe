import { z } from 'zod';
import { BaseEnvelopeSchema } from '../envelope.js';
import { LOG_LEVELS } from '../constants.js';

export const LogEmittedPayloadSchema = z.object({
  level: z.enum(LOG_LEVELS),
  message: z.string(),
  stream: z.enum(['stdout', 'stderr']).optional(),
  source: z.string().optional(),
  taskId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type LogEmittedPayload = z.infer<typeof LogEmittedPayloadSchema>;

export const LogEmittedEventSchema = BaseEnvelopeSchema.extend({
  eventType: z.literal('log.emitted'),
  payload: LogEmittedPayloadSchema,
});

export type LogEmittedEvent = z.infer<typeof LogEmittedEventSchema>;
