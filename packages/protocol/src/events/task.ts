import { z } from 'zod';
import { BaseEnvelopeSchema } from '../envelope.js';
import { TASK_STATUSES } from '../constants.js';

export const TaskStartedPayloadSchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
  taskName: z.string().min(1, 'taskName is required'),
  description: z.string().optional(),
  parentTaskId: z.string().optional(),
  depth: z.number().int().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type TaskStartedPayload = z.infer<typeof TaskStartedPayloadSchema>;

export const TaskStartedEventSchema = BaseEnvelopeSchema.extend({
  eventType: z.literal('task.started'),
  payload: TaskStartedPayloadSchema,
});

export type TaskStartedEvent = z.infer<typeof TaskStartedEventSchema>;

export const TaskUpdatedPayloadSchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
  status: z.enum(TASK_STATUSES),
  message: z.string().optional(),
  reason: z.string().optional(),
});

export type TaskUpdatedPayload = z.infer<typeof TaskUpdatedPayloadSchema>;

export const TaskUpdatedEventSchema = BaseEnvelopeSchema.extend({
  eventType: z.literal('task.updated'),
  payload: TaskUpdatedPayloadSchema,
});

export type TaskUpdatedEvent = z.infer<typeof TaskUpdatedEventSchema>;

export const TaskCompletedPayloadSchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
  resultSummary: z.string().min(1, 'resultSummary is required'),
  durationMs: z.number().int().nonnegative().optional(),
  verified: z.boolean(),
  deliverables: z.array(z.string()).optional(),
});

export type TaskCompletedPayload = z.infer<typeof TaskCompletedPayloadSchema>;

export const TaskCompletedEventSchema = BaseEnvelopeSchema.extend({
  eventType: z.literal('task.completed'),
  payload: TaskCompletedPayloadSchema,
});

export type TaskCompletedEvent = z.infer<typeof TaskCompletedEventSchema>;

export const TaskFailedPayloadSchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
  error: z.object({
    code: z.string().min(1, 'error code is required'),
    message: z.string().min(1, 'error message is required'),
    stack: z.string().optional(),
  }),
  durationMs: z.number().int().nonnegative().optional(),
  recoverable: z.boolean().optional(),
});

export type TaskFailedPayload = z.infer<typeof TaskFailedPayloadSchema>;

export const TaskFailedEventSchema = BaseEnvelopeSchema.extend({
  eventType: z.literal('task.failed'),
  payload: TaskFailedPayloadSchema,
});

export type TaskFailedEvent = z.infer<typeof TaskFailedEventSchema>;
