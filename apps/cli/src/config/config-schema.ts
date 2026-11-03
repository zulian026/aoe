import { z } from 'zod';

export const OutputConfigSchema = z.object({
  mode: z.enum(['auto', 'interactive', 'static']).default('auto'),
  showTimestamps: z.boolean().default(false),
});

export type OutputConfig = z.infer<typeof OutputConfigSchema>;

export const AdaptersConfigSchema = z.object({
  autoDetect: z.boolean().default(true),
  minimumConfidence: z.enum(['exact', 'high', 'medium', 'low']).default('high'),
});

export type AdaptersConfig = z.infer<typeof AdaptersConfigSchema>;

export const AoeConfigSchema = z.object({
  version: z.literal(1).default(1),
  theme: z.string().min(1).default('obsidian'),
  output: OutputConfigSchema.default({
    mode: 'auto',
    showTimestamps: false,
  }),
  adapters: AdaptersConfigSchema.default({
    autoDetect: true,
    minimumConfidence: 'high',
  }),
});

export type AoeConfig = z.infer<typeof AoeConfigSchema>;

export const DEFAULT_CONFIG: AoeConfig = {
  version: 1,
  theme: 'obsidian',
  output: {
    mode: 'auto',
    showTimestamps: false,
  },
  adapters: {
    autoDetect: true,
    minimumConfidence: 'high',
  },
};
