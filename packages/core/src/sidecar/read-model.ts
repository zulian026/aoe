import type {
  AoeEvent,
  SessionStartedEvent,
  SessionEndedEvent,
  TaskStartedEvent,
  TaskUpdatedEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  ProgressUpdatedEvent,
  FileChangedEvent,
  DiagnosticEmittedEvent,
  LogEmittedEvent,
} from '@zyanx04/protocol';
import type {
  SidecarReadModelSnapshot,
  SidecarTaskModel,
  SidecarFileChange,
  SidecarVerificationEvidence,
  SidecarDiagnostic,
  SidecarProgress,
  SidecarToolActivity,
} from './types.js';

/**
 * Normalized read model for the AOE Sidecar Consumer.
 * State is derived exclusively from validated canonical Protocol v1.0.0 events.
 */
export class SidecarReadModel {
  public sessionId?: string;
  public agent?: { name: string; version?: string; environment?: string };
  public workingDirectory?: string;
  public startedAt?: string;
  public endedAt?: string;
  public durationMs?: number;
  public status: 'uninitialized' | 'active' | 'completed' | 'failed' | 'cancelled' =
    'uninitialized';
  public isTerminated = false;
  public terminationReason?: string;

  public activeTaskId?: string;
  public currentTask?: SidecarTaskModel;
  public readonly tasks = new Map<string, SidecarTaskModel>();
  public readonly rootTaskIds: string[] = [];

  public overallProgress?: SidecarProgress;
  public readonly activeTools = new Map<string, SidecarToolActivity>();
  public readonly toolHistory: SidecarToolActivity[] = [];
  public readonly fileChanges: SidecarFileChange[] = [];

  public readonly verificationStatus = {
    verified: false,
    evidenceCount: 0,
    evidenceList: [] as SidecarVerificationEvidence[],
  };

  public readonly diagnostics: SidecarDiagnostic[] = [];

  public sequenceStats = {
    lastSequence: -1,
    totalEventsReceived: 0,
    duplicateCount: 0,
    gapCount: 0,
    outOfOrderCount: 0,
  };

  /**
   * Reduces a validated canonical protocol event into the read model.
   */
  public reduce(event: AoeEvent): void {
    this.sequenceStats.lastSequence = event.sequence;
    this.sequenceStats.totalEventsReceived += 1;

    switch (event.eventType) {
      case 'session.started':
        this.applySessionStarted(event as SessionStartedEvent);
        break;
      case 'session.ended':
        this.applySessionEnded(event as SessionEndedEvent);
        break;
      case 'task.started':
        this.applyTaskStarted(event as TaskStartedEvent);
        break;
      case 'task.updated':
        this.applyTaskUpdated(event as TaskUpdatedEvent);
        break;
      case 'task.completed':
        this.applyTaskCompleted(event as TaskCompletedEvent);
        break;
      case 'task.failed':
        this.applyTaskFailed(event as TaskFailedEvent);
        break;
      case 'progress.updated':
        this.applyProgressUpdated(event as ProgressUpdatedEvent);
        break;
      case 'file.changed':
        this.applyFileChanged(event as FileChangedEvent);
        break;
      case 'diagnostic.emitted':
        this.applyDiagnosticEmitted(event as DiagnosticEmittedEvent);
        break;
      case 'log.emitted':
        this.applyLogEmitted(event as LogEmittedEvent);
        break;
    }
  }

  public addDiagnostic(diag: SidecarDiagnostic): void {
    this.diagnostics.push(diag);
  }

  public updateSequenceStats(stats: {
    lastSequence: number;
    totalEventsReceived: number;
    duplicateCount: number;
    gapCount: number;
    outOfOrderCount: number;
  }): void {
    this.sequenceStats = { ...stats };
  }

  private applySessionStarted(event: SessionStartedEvent): void {
    this.sessionId = event.sessionId;
    this.status = 'active';
    this.isTerminated = false;
    this.startedAt = event.timestamp;
    this.workingDirectory = event.payload.workingDirectory;
    this.agent = {
      name: event.payload.agent.name,
      version: event.payload.agent.version,
      environment: event.payload.agent.environment,
    };
  }

  private applySessionEnded(event: SessionEndedEvent): void {
    this.status = event.payload.status;
    this.isTerminated = true;
    this.endedAt = event.timestamp;
    this.terminationReason = event.payload.summary;

    if (this.startedAt) {
      this.durationMs = Math.max(
        0,
        new Date(event.timestamp).getTime() - new Date(this.startedAt).getTime(),
      );
    }

    // Invariant: Terminal session state must be consistent.
    // When a session ends, active task pointer is cleared and active tasks reconciled.
    this.activeTaskId = undefined;
    this.currentTask = undefined;
    this.activeTools.clear();

    for (const task of this.tasks.values()) {
      if (task.status === 'running') {
        task.status = event.payload.status === 'completed' ? 'completed' : 'failed';
        task.completedAt = event.timestamp;
        task.updatedAt = event.timestamp;
      }
    }
  }

  private applyTaskStarted(event: TaskStartedEvent): void {
    const { taskId, taskName, metadata } = event.payload;
    const task: SidecarTaskModel = {
      id: taskId,
      name: taskName,
      status: 'running',
      startedAt: event.timestamp,
      updatedAt: event.timestamp,
      verified: false,
      fileChanges: [],
      metadata: metadata ? { ...metadata } : undefined,
    };

    this.tasks.set(taskId, task);
    this.activeTaskId = taskId;
    this.currentTask = task;

    if (!this.rootTaskIds.includes(taskId)) {
      this.rootTaskIds.push(taskId);
    }
  }

  private applyTaskUpdated(event: TaskUpdatedEvent): void {
    const { taskId, status, message } = event.payload;
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.updatedAt = event.timestamp;
    if (status === 'warning') {
      task.status = 'warning';
    }

    if (message) {
      task.metadata = { ...(task.metadata ?? {}), lastUpdateMessage: message };
    }

    if (this.activeTaskId === taskId) {
      this.currentTask = task;
    }
  }

  private applyTaskCompleted(event: TaskCompletedEvent): void {
    const { taskId, verified, resultSummary } = event.payload;
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'completed';
    task.completedAt = event.timestamp;
    task.updatedAt = event.timestamp;
    task.verified = Boolean(verified);

    if (resultSummary) {
      task.metadata = { ...(task.metadata ?? {}), resultSummary };
    }

    if (verified) {
      this.verificationStatus.verified = true;
      this.verificationStatus.evidenceCount += 1;
      this.verificationStatus.evidenceList.push({
        taskId,
        verified: true,
        timestamp: event.timestamp,
        resultSummary,
      });
    }

    if (this.activeTaskId === taskId) {
      this.activeTaskId = undefined;
      this.currentTask = undefined;
    }
  }

  private applyTaskFailed(event: TaskFailedEvent): void {
    const { taskId, error } = event.payload;
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'failed';
    task.completedAt = event.timestamp;
    task.updatedAt = event.timestamp;
    task.error = {
      code: error.code,
      message: error.message,
      stack: error.stack,
    };

    if (this.activeTaskId === taskId) {
      this.activeTaskId = undefined;
      this.currentTask = undefined;
    }
  }

  private applyProgressUpdated(event: ProgressUpdatedEvent): void {
    const { taskId, completedWork, totalWork, isEstimate, currentWork, unit, description } =
      event.payload;

    const progress: SidecarProgress = {
      completedWork,
      totalWork,
      percentage:
        typeof totalWork === 'number' && totalWork > 0
          ? Math.min(100, Math.round((completedWork / totalWork) * 100))
          : null,
      currentWork,
      isEstimate: Boolean(isEstimate),
      unit,
    };

    this.overallProgress = progress;

    if (taskId && this.tasks.has(taskId)) {
      const task = this.tasks.get(taskId)!;
      task.progress = progress;
      task.updatedAt = event.timestamp;
      if (this.activeTaskId === taskId) {
        this.currentTask = task;
      }
    }

    // Tool activity update based on currentWork
    if (currentWork) {
      const activity: SidecarToolActivity = {
        name: currentWork,
        status: currentWork.includes('finished') || currentWork.includes('completed')
          ? 'completed'
          : 'executing',
        timestamp: event.timestamp,
        taskId,
        description,
      };
      if (activity.status === 'executing') {
        this.activeTools.set(currentWork, activity);
      } else {
        this.activeTools.delete(currentWork.replace(/ (finished|completed)$/, ''));
      }
      this.toolHistory.push(activity);
    }
  }

  private applyFileChanged(event: FileChangedEvent): void {
    const { path, action, evidence, description, taskId } = event.payload;
    const change: SidecarFileChange = {
      path,
      action,
      evidence: evidence ? { verifiedOnDisk: evidence.verifiedOnDisk } : undefined,
      description,
      taskId,
      timestamp: event.timestamp,
    };

    this.fileChanges.push(change);

    if (taskId && this.tasks.has(taskId)) {
      const task = this.tasks.get(taskId)!;
      task.fileChanges.push(change);
      task.updatedAt = event.timestamp;
    }
  }

  private applyDiagnosticEmitted(event: DiagnosticEmittedEvent): void {
    const { severity, message, isHypothesis, taskId, suggestedRemediation } = event.payload;
    const diag: SidecarDiagnostic = {
      level: severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'info',
      message,
      timestamp: event.timestamp,
      taskId,
      details: { isHypothesis, suggestedRemediation },
    };
    this.diagnostics.push(diag);
  }

  private applyLogEmitted(event: LogEmittedEvent): void {
    const { level, message, taskId } = event.payload;
    if (level === 'error' || level === 'warn') {
      this.diagnostics.push({
        level: level === 'error' ? 'error' : 'warning',
        message: `[Log] ${message}`,
        timestamp: event.timestamp,
        taskId,
      });
    }
  }

  /**
   * Produces an immutable, serializable snapshot of current read model state.
   */
  public getSnapshot(): SidecarReadModelSnapshot {
    const tasksObj: Record<string, SidecarTaskModel> = {};
    for (const [id, t] of this.tasks.entries()) {
      tasksObj[id] = {
        ...t,
        fileChanges: [...t.fileChanges],
        metadata: t.metadata ? { ...t.metadata } : undefined,
      };
    }

    return {
      sessionId: this.sessionId,
      agent: this.agent ? { ...this.agent } : undefined,
      workingDirectory: this.workingDirectory,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      durationMs: this.durationMs,
      status: this.status,
      isTerminated: this.isTerminated,
      terminationReason: this.terminationReason,
      activeTaskId: this.activeTaskId,
      currentTask: this.currentTask ? { ...this.currentTask } : undefined,
      tasks: tasksObj,
      rootTaskIds: [...this.rootTaskIds],
      overallProgress: this.overallProgress ? { ...this.overallProgress } : undefined,
      activeTools: Array.from(this.activeTools.values()),
      toolHistory: [...this.toolHistory],
      fileChanges: [...this.fileChanges],
      verificationStatus: {
        verified: this.verificationStatus.verified,
        evidenceCount: this.verificationStatus.evidenceCount,
        evidenceList: [...this.verificationStatus.evidenceList],
      },
      diagnostics: [...this.diagnostics],
      sequenceStats: { ...this.sequenceStats },
    };
  }

  public reset(): void {
    this.sessionId = undefined;
    this.agent = undefined;
    this.workingDirectory = undefined;
    this.startedAt = undefined;
    this.endedAt = undefined;
    this.durationMs = undefined;
    this.status = 'uninitialized';
    this.isTerminated = false;
    this.terminationReason = undefined;
    this.activeTaskId = undefined;
    this.currentTask = undefined;
    this.tasks.clear();
    this.rootTaskIds.length = 0;
    this.overallProgress = undefined;
    this.activeTools.clear();
    this.toolHistory.length = 0;
    this.fileChanges.length = 0;
    this.verificationStatus.verified = false;
    this.verificationStatus.evidenceCount = 0;
    this.verificationStatus.evidenceList.length = 0;
    this.diagnostics.length = 0;
    this.sequenceStats = {
      lastSequence: -1,
      totalEventsReceived: 0,
      duplicateCount: 0,
      gapCount: 0,
      outOfOrderCount: 0,
    };
  }
}
