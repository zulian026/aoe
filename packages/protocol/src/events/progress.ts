import { z } from 'zod';
import { BaseEnvelopeSchema } from '../envelope.js';

export const ProgressUpdatedPayloadSchema = z
  .object({
    taskId: z.string().optional(),
    completedWork: z.number().nonnegative('completedWork must be non-negative'),
    totalWork: z.number().positive('totalWork must be positive').optional(),
    currentWork: z.string().optional(),
    isEstimate: z.boolean(),
    verifiedWork: z.number().nonnegative('verifiedWork must be non-negative').optional(),
    unit: z.string().optional(),
    description: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.totalWork !== undefined && !data.isEstimate) {
        return data.completedWork <= data.totalWork;
      }
      return true;
    },
    {
      message: 'completedWork cannot exceed totalWork for non-estimated progress',
      path: ['completedWork'],
    },
  )
  .refine(
    (data) => {
      if (data.verifiedWork !== undefined) {
        return data.verifiedWork <= data.completedWork;
      }
      return true;
    },
    {
      message: 'verifiedWork cannot exceed completedWork',
      path: ['verifiedWork'],
    },
  );

export type ProgressUpdatedPayload = z.infer<typeof ProgressUpdatedPayloadSchema>;

export const ProgressUpdatedEventSchema = BaseEnvelopeSchema.extend({
  eventType: z.literal('progress.updated'),
  payload: ProgressUpdatedPayloadSchema,
});

export type ProgressUpdatedEvent = z.infer<typeof ProgressUpdatedEventSchema>;
