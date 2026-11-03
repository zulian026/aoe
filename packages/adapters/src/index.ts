import { type ProtocolEnvelope } from '@aoe/protocol';

export type AgentKind = 'codex' | 'claude-code' | 'gemini-cli' | 'opencode' | 'generic';

export interface AgentAdapter {
  readonly kind: AgentKind;
  canHandle(input: unknown): boolean;
  transform(rawChunk: string): ProtocolEnvelope[];
}

export const SUPPORTED_AGENTS: readonly AgentKind[] = [
  'codex',
  'claude-code',
  'gemini-cli',
  'opencode',
  'generic',
] as const;
