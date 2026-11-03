import { z } from 'zod';
import { BaseEnvelopeSchema } from '../envelope.js';
import { FILE_ACTIONS } from '../constants.js';

export const LineDeltaSchema = z.object({
  added: z
    .number()
    .int('added lines must be an integer')
    .nonnegative('added lines must be non-negative'),
  removed: z
    .number()
    .int('removed lines must be an integer')
    .nonnegative('removed lines must be non-negative'),
});

export type LineDelta = z.infer<typeof LineDeltaSchema>;

export const FileEvidenceSchema = z.object({
  verifiedOnDisk: z.boolean(),
  hash: z.string().optional(),
  sizeBytes: z.number().int().nonnegative('sizeBytes must be non-negative').optional(),
});

export type FileEvidence = z.infer<typeof FileEvidenceSchema>;

export const FileChangedPayloadSchema = z
  .object({
    action: z.enum(FILE_ACTIONS),
    path: z.string().min(1, 'path is required'),
    oldPath: z.string().min(1, 'oldPath cannot be empty if provided').optional(),
    lineDelta: LineDeltaSchema.optional(),
    evidence: FileEvidenceSchema,
    description: z.string().optional(),
    taskId: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.action === 'RENAMED') {
        return typeof data.oldPath === 'string' && data.oldPath.trim().length > 0;
      }
      return true;
    },
    {
      message: 'oldPath is required when action is RENAMED',
      path: ['oldPath'],
    },
  );

export type FileChangedPayload = z.infer<typeof FileChangedPayloadSchema>;

export const FileChangedEventSchema = BaseEnvelopeSchema.extend({
  eventType: z.literal('file.changed'),
  payload: FileChangedPayloadSchema,
});

export type FileChangedEvent = z.infer<typeof FileChangedEventSchema>;
