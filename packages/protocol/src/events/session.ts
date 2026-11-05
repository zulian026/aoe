import { z } from 'zod';
import { BaseEnvelopeSchema } from '../envelope.js';
import { SESSION_STATUSES } from '../constants.js';

export const SessionStartedPayloadSchema = z.object({
  agent: z.object({
    name: z.string().min(1, 'Agent name is required'),
    version: z.string().optional(),
    environment: z.string().optional(),
  }),
  workingDirectory: z.string().min(1, 'workingDirectory is required'),
  parentSessionId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type SessionStartedPayload = z.infer<typeof SessionStartedPayloadSchema>;

export const SessionStartedEventSchema = BaseEnvelopeSchema.extend({
  eventType: z.literal('session.started'),
  payload: SessionStartedPayloadSchema,
});

export type SessionStartedEvent = z.infer<typeof SessionStartedEventSchema>;

export const SessionEndedPayloadSchema = z.object({
  status: z.enum(SESSION_STATUSES),
  exitCode: z.number().int().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  summary: z.string().optional(),
  stats: z
    .object({
      tasksTotal: z.number().int().nonnegative().optional(),
      tasksCompleted: z.number().int().nonnegative().optional(),
      tasksFailed: z.number().int().nonnegative().optional(),
      filesChanged: z.number().int().nonnegative().optional(),
      errorsCount: z.number().int().nonnegative().optional(),
      warningsCount: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export type SessionEndedPayload = z.infer<typeof SessionEndedPayloadSchema>;

export const SessionEndedEventSchema = BaseEnvelopeSchema.extend({
  eventType: z.literal('session.ended'),
  payload: SessionEndedPayloadSchema,
});

export type SessionEndedEvent = z.infer<typeof SessionEndedEventSchema>;
