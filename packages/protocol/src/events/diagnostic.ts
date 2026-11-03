import { z } from 'zod';
import { BaseEnvelopeSchema } from '../envelope.js';
import { DIAGNOSTIC_SEVERITIES } from '../constants.js';

export const DiagnosticLocationSchema = z.object({
  path: z.string().min(1, 'location path is required'),
  line: z.number().int('line must be an integer').positive('line must be a positive integer'),
  column: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  endColumn: z.number().int().positive().optional(),
});

export type DiagnosticLocation = z.infer<typeof DiagnosticLocationSchema>;

export const DiagnosticEmittedPayloadSchema = z.object({
  severity: z.enum(DIAGNOSTIC_SEVERITIES),
  message: z.string().min(1, 'message is required'),
  code: z.string().optional(),
  location: DiagnosticLocationSchema.optional(),
  isHypothesis: z.boolean(),
  rootCause: z.string().optional(),
  suggestedRemediation: z.string().optional(),
  taskId: z.string().optional(),
});

export type DiagnosticEmittedPayload = z.infer<typeof DiagnosticEmittedPayloadSchema>;

export const DiagnosticEmittedEventSchema = BaseEnvelopeSchema.extend({
  eventType: z.literal('diagnostic.emitted'),
  payload: DiagnosticEmittedPayloadSchema,
});

export type DiagnosticEmittedEvent = z.infer<typeof DiagnosticEmittedEventSchema>;
