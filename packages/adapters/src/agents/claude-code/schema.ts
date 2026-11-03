import { z } from 'zod';

export const ClaudeCodeHookPayloadSchema = z.object({
  session_id: z.string().min(1),
  hook_event_name: z.string().min(1),
  cwd: z.string().optional(),
  transcript_path: z.string().optional(),
  permission_mode: z.string().optional(),
  tool_name: z.string().optional(),
  tool_use_id: z.string().optional(),
  tool_input: z.record(z.unknown()).optional(),
  tool_response: z.unknown().optional(),
  error: z.unknown().optional(),
  prompt: z.string().optional(),
  message: z.string().optional(),
  timestamp: z.string().optional(),
});

export type ClaudeCodeHookPayload = z.infer<typeof ClaudeCodeHookPayloadSchema>;

export const ClaudeCodeStreamEventSchema = z.object({
  type: z.enum(['message', 'tool_use', 'tool_result', 'result', 'error']),
  name: z.string().optional(),
  id: z.string().optional(),
  input: z.record(z.unknown()).optional(),
  output: z.unknown().optional(),
  content: z.unknown().optional(),
  session_id: z.string().optional(),
  cwd: z.string().optional(),
});

export type ClaudeCodeStreamEvent = z.infer<typeof ClaudeCodeStreamEventSchema>;

export const ClaudeCodeInputSchema = z.union([
  ClaudeCodeHookPayloadSchema,
  ClaudeCodeStreamEventSchema,
]);

export type ClaudeCodeInput = z.infer<typeof ClaudeCodeInputSchema>;
