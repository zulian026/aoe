import { createSessionId } from '@zyanx04/protocol';

export type AdapterSessionStatus = 'active' | 'completed' | 'failed' | 'disposed';

export interface AdapterSession {
  readonly id: string;
  readonly adapterId: string;
  readonly agentName: string;
  readonly workingDirectory: string;
  readonly startedAt: string;
  status: AdapterSessionStatus;
  metadata: Record<string, unknown>;

  /**
   * Advances and returns the next monotonic sequence number for the session.
   */
  nextSequence(): number;

  /**
   * Returns the last allocated sequence number without advancing.
   */
  getCurrentSequence(): number;

  /**
   * Translates or generates a persistent mapped task ID for this session.
   */
  mapTaskId(externalTaskId: string): string;

  /**
   * Checks if an external task ID is already mapped in this session.
   */
  hasTaskId(externalTaskId: string): boolean;
}

export interface CreateAdapterSessionOptions {
  sessionId?: string;
  adapterId: string;
  agentName: string;
  workingDirectory?: string;
  initialSequence?: number;
  metadata?: Record<string, unknown>;
}

export class DefaultAdapterSession implements AdapterSession {
  public readonly id: string;
  public readonly adapterId: string;
  public readonly agentName: string;
  public readonly workingDirectory: string;
  public readonly startedAt: string;
  public status: AdapterSessionStatus = 'active';
  public metadata: Record<string, unknown>;

  private currentSequence: number;
  private readonly taskMap = new Map<string, string>();

  constructor(options: CreateAdapterSessionOptions) {
    this.id = options.sessionId ?? createSessionId('sess');
    this.adapterId = options.adapterId;
    this.agentName = options.agentName;
    this.workingDirectory =
      options.workingDirectory ?? (typeof process !== 'undefined' ? process.cwd() : '/');
    this.startedAt = new Date().toISOString();
    // Start at -1 if sequence starts with nextSequence() returning 0 for session.started,
    // or if initialSequence is provided (e.g. 0).
    this.currentSequence = options.initialSequence ?? -1;
    this.metadata = options.metadata ? { ...options.metadata } : {};
  }

  public nextSequence(): number {
    this.currentSequence += 1;
    return this.currentSequence;
  }

  public getCurrentSequence(): number {
    return Math.max(0, this.currentSequence);
  }

  public mapTaskId(externalTaskId: string): string {
    const existing = this.taskMap.get(externalTaskId);
    if (existing) {
      return existing;
    }
    // Clean and stabilize external task ID, prefixing with session ID
    const sanitized = externalTaskId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const mapped = `${sanitized}`;
    this.taskMap.set(externalTaskId, mapped);
    return mapped;
  }

  public hasTaskId(externalTaskId: string): boolean {
    return this.taskMap.has(externalTaskId);
  }
}

export function createAdapterSession(options: CreateAdapterSessionOptions): AdapterSession {
  return new DefaultAdapterSession(options);
}
