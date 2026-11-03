import type {
  AgentMetadata,
  CoreSessionStatus,
  DiagnosticSummary,
  FileChangeSummary,
  SessionSnapshot,
  SessionStats,
} from './types.js';
import { SequenceTracker } from './sequence-tracker.js';
import { DeduplicationStore } from './deduplication.js';
import { TaskManager } from './task-manager.js';
import { ProgressTracker } from './progress-tracker.js';
import { UnknownSessionError } from './errors.js';
import { LifecycleManager } from './lifecycle-manager.js';

export interface CreateSessionOptions {
  sessionId: string;
  agent: AgentMetadata;
  workingDirectory: string;
  parentSessionId?: string;
  startedAt?: string;
}

export class SessionStateContainer {
  public readonly sessionId: string;
  public status: CoreSessionStatus = 'active';
  public readonly agent: AgentMetadata;
  public readonly workingDirectory: string;
  public readonly parentSessionId?: string;
  public readonly startedAt: string;
  public endedAt?: string;
  public durationMs?: number;

  public readonly sequenceTracker: SequenceTracker;
  public readonly deduplicationStore: DeduplicationStore;
  public readonly taskManager: TaskManager;
  public readonly progressTracker: ProgressTracker;

  public readonly fileChanges: FileChangeSummary[] = [];
  public readonly diagnostics: DiagnosticSummary[] = [];

  public errorsCount = 0;
  public warningsCount = 0;

  constructor(options: CreateSessionOptions, maxBufferSize = 100) {
    this.sessionId = options.sessionId;
    this.agent = { ...options.agent };
    this.workingDirectory = options.workingDirectory;
    this.parentSessionId = options.parentSessionId;
    this.startedAt = options.startedAt ?? new Date().toISOString();

    this.sequenceTracker = new SequenceTracker(this.sessionId, maxBufferSize);
    this.deduplicationStore = new DeduplicationStore(this.sessionId);
    this.taskManager = new TaskManager(this.sessionId);
    this.progressTracker = new ProgressTracker(this.sessionId);
  }

  public toSnapshot(totalEvents = 0): SessionSnapshot {
    const taskCounts = this.taskManager.counts;
    const progress = this.progressTracker.deriveAggregateProgress(
      taskCounts.total,
      taskCounts.completed,
    );

    const stats: SessionStats = {
      tasksTotal: taskCounts.total,
      tasksCompleted: taskCounts.completed,
      tasksFailed: taskCounts.failed,
      filesChanged: this.fileChanges.length,
      errorsCount: this.errorsCount,
      warningsCount: this.warningsCount,
      durationMs: this.durationMs,
    };

    return {
      sessionId: this.sessionId,
      status: this.status,
      agent: { ...this.agent },
      workingDirectory: this.workingDirectory,
      parentSessionId: this.parentSessionId,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      durationMs: this.durationMs,
      lastSequence: this.sequenceTracker.getLastAcceptedSequence(),
      totalEvents,
      tasks: this.taskManager.getAllTasks(),
      rootTaskIds: this.taskManager.getRootTaskIds(),
      activeTaskCount: taskCounts.active,
      completedTaskCount: taskCounts.completed,
      failedTaskCount: taskCounts.failed,
      progress,
      fileChanges: [...this.fileChanges],
      diagnostics: [...this.diagnostics],
      stats,
    };
  }
}

export class SessionManager {
  private readonly sessions: Map<string, SessionStateContainer> = new Map();
  public readonly defaultMaxBufferSize: number;

  constructor(defaultMaxBufferSize = 100) {
    this.defaultMaxBufferSize = defaultMaxBufferSize;
  }

  public createSession(options: CreateSessionOptions): SessionStateContainer {
    if (this.sessions.has(options.sessionId)) {
      return this.sessions.get(options.sessionId)!;
    }
    const container = new SessionStateContainer(options, this.defaultMaxBufferSize);
    this.sessions.set(options.sessionId, container);
    return container;
  }

  public getSession(sessionId: string): SessionStateContainer | undefined {
    return this.sessions.get(sessionId);
  }

  public requireSession(sessionId: string, eventId?: string): SessionStateContainer {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new UnknownSessionError(sessionId, eventId);
    }
    return session;
  }

  public hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  public endSession(
    sessionId: string,
    status: 'completed' | 'failed' | 'cancelled',
    timestamp: string,
    durationMs?: number,
  ): SessionStateContainer {
    const session = this.requireSession(sessionId);
    LifecycleManager.validateSessionTransition(sessionId, session.status, status);

    session.status = status;
    session.endedAt = timestamp;
    session.durationMs = durationMs;
    return session;
  }

  public listSessions(): SessionStateContainer[] {
    return Array.from(this.sessions.values());
  }

  public deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  public clear(): void {
    this.sessions.clear();
  }
}
