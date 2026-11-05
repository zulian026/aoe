import type { AoeEvent, ProtocolEnvelope } from '@zyanx04/protocol';
import type { AdapterContext, AdapterDetectionResult } from './context.js';
import type { AdapterSession } from './session.js';

export type AgentKind =
  'codex' | 'claude-code' | 'gemini-cli' | 'opencode' | 'generic' | 'antigravity';

export type AdapterLifecycleState =
  'uninitialized' | 'detected' | 'initialized' | 'active' | 'stopping' | 'disposed' | 'error';

export interface AgentAdapter {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly supportedCategories: readonly string[];

  // Legacy M00 compatibility properties
  readonly kind?: AgentKind;

  /**
   * Non-invasively inspects the environment or context to evaluate compatibility.
   */
  detect(context: AdapterContext): Promise<AdapterDetectionResult> | AdapterDetectionResult;

  /**
   * Initializes the adapter for a new execution context and returns an active AdapterSession.
   */
  initialize(context: AdapterContext, sessionId?: string): Promise<AdapterSession> | AdapterSession;

  /**
   * Normalizes arbitrary external agent telemetry into strictly validated canonical AoeEvent objects.
   */
  normalize(input: unknown, session: AdapterSession): Promise<AoeEvent[]> | AoeEvent[];

  /**
   * Disposes of any resources, buffers, or listeners held by the adapter.
   */
  dispose(): Promise<void> | void;

  // Legacy M00 compatibility methods
  canHandle?(input: unknown): boolean;
  transform?(rawChunk: string): ProtocolEnvelope[];
}

export const SUPPORTED_AGENTS: readonly AgentKind[] = [
  'codex',
  'claude-code',
  'gemini-cli',
  'opencode',
  'generic',
  'antigravity',
] as const;
