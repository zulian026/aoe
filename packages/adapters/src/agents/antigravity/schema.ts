import { z } from 'zod';

export const AntigravityCommonFieldsSchema = z.object({
  conversationId: z.string().optional(),
  workspacePaths: z.array(z.string()).optional(),
  transcriptPath: z.string().optional(),
  artifactDirectoryPath: z.string().optional(),
  modelName: z.string().optional(),
  lastUserInput: z.string().optional(),
  hookEventName: z.string().optional(),
  hook_event_name: z.string().optional(),
  // Support snake_case aliases gracefully
  conversation_id: z.string().optional(),
  workspace_paths: z.array(z.string()).optional(),
  transcript_path: z.string().optional(),
  artifact_directory_path: z.string().optional(),
  model_name: z.string().optional(),
  last_user_input: z.string().optional(),
});

export const AntigravityToolCallSchema = z.object({
  name: z.string().min(1, 'Tool name is required'),
  args: z.record(z.string(), z.unknown()).default({}),
});

export const AntigravitySessionStartPayloadSchema = AntigravityCommonFieldsSchema.extend({
  hookEventName: z.literal('SessionStart').optional(),
});

export const AntigravityPreInvocationPayloadSchema = AntigravityCommonFieldsSchema.extend({
  hookEventName: z.literal('PreInvocation').optional(),
  invocationNum: z.number().int().optional(),
  initialNumSteps: z.number().int().optional(),
  invocation_num: z.number().int().optional(),
  initial_num_steps: z.number().int().optional(),
});

export const AntigravityPreToolUsePayloadSchema = AntigravityCommonFieldsSchema.extend({
  hookEventName: z.literal('PreToolUse').optional(),
  toolCall: AntigravityToolCallSchema,
  stepIdx: z.number().int().optional(),
  step_idx: z.number().int().optional(),
});

export const AntigravityPostToolUsePayloadSchema = AntigravityCommonFieldsSchema.extend({
  hookEventName: z.literal('PostToolUse').optional(),
  toolCall: AntigravityToolCallSchema,
  stepIdx: z.number().int().optional(),
  step_idx: z.number().int().optional(),
  error: z.unknown().optional(),
});

export const AntigravityStopPayloadSchema = AntigravityCommonFieldsSchema.extend({
  hookEventName: z.literal('Stop').optional(),
  executionNum: z.number().int().optional(),
  execution_num: z.number().int().optional(),
  terminationReason: z.string().optional(),
  termination_reason: z.string().optional(),
  error: z.unknown().optional(),
  fullyIdle: z.boolean().optional(),
  fully_idle: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const AntigravityHookPayloadSchema = z.union([
  AntigravityPreToolUsePayloadSchema,
  AntigravityPostToolUsePayloadSchema,
  AntigravityStopPayloadSchema,
  AntigravityPreInvocationPayloadSchema,
  AntigravitySessionStartPayloadSchema,
]);

export type AntigravityCommonFields = z.infer<typeof AntigravityCommonFieldsSchema>;
export type AntigravityToolCall = z.infer<typeof AntigravityToolCallSchema>;
export type AntigravitySessionStartPayload = z.infer<typeof AntigravitySessionStartPayloadSchema>;
export type AntigravityPreInvocationPayload = z.infer<typeof AntigravityPreInvocationPayloadSchema>;
export type AntigravityPreToolUsePayload = z.infer<typeof AntigravityPreToolUsePayloadSchema>;
export type AntigravityPostToolUsePayload = z.infer<typeof AntigravityPostToolUsePayloadSchema>;
export type AntigravityStopPayload = z.infer<typeof AntigravityStopPayloadSchema>;
export type AntigravityHookPayload = z.infer<typeof AntigravityHookPayloadSchema>;
