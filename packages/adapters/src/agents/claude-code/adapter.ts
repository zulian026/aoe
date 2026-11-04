import { type AoeEvent, type ProtocolEnvelope } from '@zyanx04/protocol';
import type {
  AgentAdapter,
  AgentKind,
  AdapterContext,
  AdapterDetectionResult,
  AdapterSession,
} from '../../contracts/index.js';
import { createAdapterSession } from '../../contracts/session.js';
import { ClaudeCodeMapper } from './mapper.js';
import { AdapterParsingError } from '../../errors/index.js';

export class ClaudeCodeAdapter implements AgentAdapter {
  public readonly id = 'claude-code';
  public readonly name = 'Claude Code Adapter';
  public readonly version = '1.0.0';
  public readonly kind: AgentKind = 'claude-code';
  public readonly supportedCategories = [
    'session',
    'task',
    'log',
    'file',
    'diagnostic',
    'error',
  ] as const;

  private readonly mapper = new ClaudeCodeMapper();

  public detect(context: AdapterContext): AdapterDetectionResult {
    const evidence: string[] = [];
    const env = context.environment ?? {};

    if (env.CLAUDE_CODE_ENTRYPOINT || env.CLAUDE_PROJECT_DIR || env.CLAUDE_PROJECT_ROOT) {
      evidence.push(
        'Environment variables CLAUDE_CODE_ENTRYPOINT, CLAUDE_PROJECT_DIR, or CLAUDE_PROJECT_ROOT detected',
      );
    }

    if (context.metadata?.agent === 'claude-code' || context.metadata?.agent === 'claude') {
      evidence.push('Metadata agent="claude-code" provided');
    }

    if (evidence.length >= 2) {
      return {
        detected: true,
        confidence: 'exact',
        agentName: 'claude-code',
        evidence,
      };
    }

    if (evidence.length === 1) {
      return {
        detected: true,
        confidence: 'high',
        agentName: 'claude-code',
        evidence,
      };
    }

    return {
      detected: false,
      confidence: 'none',
    };
  }

  public initialize(context: AdapterContext, sessionId?: string): AdapterSession {
    return createAdapterSession({
      sessionId,
      adapterId: this.id,
      agentName: 'claude-code',
      workingDirectory: context.workingDirectory,
      metadata: context.metadata,
    });
  }

  public normalize(input: unknown, session: AdapterSession): AoeEvent[] {
    let parsed: unknown = input;

    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) return [];
      try {
        parsed = JSON.parse(trimmed);
      } catch (err) {
        throw new AdapterParsingError(
          `Invalid JSON payload passed to ClaudeCodeAdapter: ${(err as Error).message}`,
          {
            adapterId: this.id,
            rawInput: trimmed,
            cause: err,
          },
        );
      }
    }

    if (Array.isArray(parsed)) {
      const results: AoeEvent[] = [];
      for (const item of parsed) {
        results.push(...this.mapper.mapEvent(item, session));
      }
      return results;
    }

    return this.mapper.mapEvent(parsed, session);
  }

  public dispose(): void {
    // Stateless mapper, nothing to teardown
  }

  // Legacy M00 compatibility
  public canHandle(input: unknown): boolean {
    if (!input || typeof input !== 'object') return false;
    const rec = input as Record<string, unknown>;
    return Boolean(rec.hook_event_name || rec.tool_name || rec.tool_use_id);
  }

  public transform(rawChunk: string): ProtocolEnvelope[] {
    const session = createAdapterSession({ adapterId: this.id, agentName: 'claude-code' });
    const events = this.normalize(rawChunk, session);
    return events.map((e) => ({
      protocolVersion: e.protocolVersion,
      eventId: e.eventId,
      sessionId: e.sessionId,
      sequence: e.sequence,
      timestamp: e.timestamp,
      eventType: e.eventType,
      payload: e.payload,
    }));
  }
}
