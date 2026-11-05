import { z } from 'zod';
import { BaseEnvelopeSchema } from '../envelope.js';
import { ERROR_SEVERITIES } from '../constants.js';

export const ErrorOccurredPayloadSchema = z.object({
  code: z.string().min(1, 'code is required'),
  message: z.string().min(1, 'message is required'),
  severity: z.enum(ERROR_SEVERITIES),
  details: z.record(z.string(), z.unknown()).optional(),
  stack: z.string().optional(),
  suggestedAction: z.string().optional(),
  taskId: z.string().optional(),
});

export type ErrorOccurredPayload = z.infer<typeof ErrorOccurredPayloadSchema>;

export const ErrorOccurredEventSchema = BaseEnvelopeSchema.extend({
  eventType: z.literal('error.occurred'),
  payload: ErrorOccurredPayloadSchema,
});

export type ErrorOccurredEvent = z.infer<typeof ErrorOccurredEventSchema>;
