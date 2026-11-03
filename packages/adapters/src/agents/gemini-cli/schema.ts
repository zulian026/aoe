import { z } from 'zod';

export const GeminiCliHookPayloadSchema = z.object({
  session_id: z.string().min(1),
  hook_event_name: z.string().min(1),
  cwd: z.string().optional(),
  transcript_path: z.string().optional(),
  timestamp: z.string().optional(),
  tool_name: z.string().optional(),
  tool_use_id: z.string().optional(),
  call_id: z.string().optional(),
  tool_input: z.record(z.unknown()).optional(),
  tool_result: z.unknown().optional(),
  error: z.unknown().optional(),
  message: z.string().optional(),
});

export type GeminiCliHookPayload = z.infer<typeof GeminiCliHookPayloadSchema>;

export const GeminiCliStreamEventSchema = z.object({
  type: z.enum(['init', 'message', 'tool_use', 'tool_result', 'error', 'result']),
  session_id: z.string().optional(),
  cwd: z.string().optional(),
  id: z.string().optional(),
  tool_name: z.string().optional(),
  tool_use_id: z.string().optional(),
  call_id: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
  input: z.record(z.unknown()).optional(),
  output: z.unknown().optional(),
  result: z.unknown().optional(),
  error: z.unknown().optional(),
  content: z.unknown().optional(),
});

export type GeminiCliStreamEvent = z.infer<typeof GeminiCliStreamEventSchema>;

export const GeminiCliInputSchema = z.union([
  GeminiCliHookPayloadSchema,
  GeminiCliStreamEventSchema,
]);

export type GeminiCliInput = z.infer<typeof GeminiCliInputSchema>;
