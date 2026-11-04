import { type AoeEvent, type ProtocolEnvelope } from '@zyanx04/protocol';
import type {
  AgentAdapter,
  AgentKind,
  AdapterContext,
  AdapterDetectionResult,
  AdapterSession,
} from '../../contracts/index.js';
import { createAdapterSession } from '../../contracts/session.js';
import { AntigravityMapper } from './mapper.js';
import { AdapterParsingError } from '../../errors/index.js';

export class AntigravityAdapter implements AgentAdapter {
  public readonly id = 'antigravity';
  public readonly name = 'Antigravity Adapter';
  public readonly version = '1.0.0';
  public readonly kind: AgentKind = 'antigravity';
  public readonly supportedCategories = [
    'session',
    'task',
    'progress',
    'file',
    'log',
    'diagnostic',
    'error',
    'result',
  ] as const;

  private readonly mapper = new AntigravityMapper();

  public detect(context: AdapterContext): AdapterDetectionResult {
    const evidence: string[] = [];
    const env = context.environment ?? {};

    if (env.ANTIGRAVITY_APP_DATA_DIR || env.ANTIGRAVITY_CLI_LOG_FILE) {
      evidence.push('Antigravity environment variables detected');
    }

    if (context.metadata?.agent === 'antigravity' || context.metadata?.agent === 'agy') {
      evidence.push('Metadata agent="antigravity" provided');
    }

    if (evidence.length >= 2) {
      return {
        detected: true,
        confidence: 'exact',
        agentName: 'antigravity',
        evidence,
      };
    }

    if (evidence.length === 1) {
      return {
        detected: true,
        confidence: 'high',
        agentName: 'antigravity',
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
      agentName: 'antigravity',
      workingDirectory: context.workingDirectory,
      metadata: context.metadata,
    });
  }

  public normalize(
    input: unknown,
    session: AdapterSession,
    explicitEvent?: string,
  ): AoeEvent[] {
    let parsed: unknown = input;

    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) return [];
      try {
        parsed = JSON.parse(trimmed);
      } catch (err) {
        throw new AdapterParsingError(
          `Invalid JSON payload passed to AntigravityAdapter: ${(err as Error).message}`,
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
        results.push(...this.mapper.mapEvent(item, session, explicitEvent));
      }
      return results;
    }

    return this.mapper.mapEvent(parsed, session, explicitEvent);
  }

  public dispose(): void {
    // Stateless mapper, nothing to teardown
  }

  // Legacy M00 compatibility
  public canHandle(input: unknown): boolean {
    if (!input || typeof input !== 'object') return false;
    const rec = input as Record<string, unknown>;
    return Boolean(
      rec.conversationId ||
        rec.conversation_id ||
        rec.toolCall ||
        rec.tool_call ||
        rec.terminationReason ||
        rec.termination_reason,
    );
  }

  public transform(rawChunk: string): ProtocolEnvelope[] {
    const session = createAdapterSession({ adapterId: this.id, agentName: 'antigravity' });
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
