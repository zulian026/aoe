import { z } from 'zod';
import { BaseEnvelopeSchema } from '../envelope.js';
import { RESULT_CATEGORIES } from '../constants.js';

export const ResultProducedPayloadSchema = z.object({
  category: z.enum(RESULT_CATEGORIES),
  title: z.string().min(1, 'title is required'),
  data: z.record(z.string(), z.unknown()),
  artifactPath: z.string().optional(),
  taskId: z.string().optional(),
});

export type ResultProducedPayload = z.infer<typeof ResultProducedPayloadSchema>;

export const ResultProducedEventSchema = BaseEnvelopeSchema.extend({
  eventType: z.literal('result.produced'),
  payload: ResultProducedPayloadSchema,
});

export type ResultProducedEvent = z.infer<typeof ResultProducedEventSchema>;
