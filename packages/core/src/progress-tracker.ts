import { calculateProgressPercentage, type ProgressUpdatedPayload } from '@aoe/protocol';
import type { TaskProgress } from './types.js';
import { InvalidStateMutationError } from './errors.js';

export class ProgressTracker {
  private readonly taskProgress: Map<string, TaskProgress> = new Map();
  private sessionProgress: TaskProgress | null = null;
  public readonly sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Records a progress update for a task or the entire session.
   */
  public recordProgress(payload: ProgressUpdatedPayload): TaskProgress {
    // Validate mathematical constraints
    if (
      payload.totalWork !== undefined &&
      !payload.isEstimate &&
      payload.completedWork > payload.totalWork
    ) {
      throw new InvalidStateMutationError(
        `Completed work (${payload.completedWork}) cannot exceed total work (${payload.totalWork}) for verified progress`,
        this.sessionId,
      );
    }
    if (payload.verifiedWork !== undefined && payload.verifiedWork > payload.completedWork) {
      throw new InvalidStateMutationError(
        `Verified work (${payload.verifiedWork}) cannot exceed completed work (${payload.completedWork})`,
        this.sessionId,
      );
    }

    const percentage = calculateProgressPercentage(payload);

    const progress: TaskProgress = {
      completedWork: payload.completedWork,
      totalWork: payload.totalWork,
      verifiedWork: payload.verifiedWork,
      isEstimate: payload.isEstimate,
      unit: payload.unit,
      description: payload.description,
      percentage,
    };

    if (payload.taskId) {
      this.taskProgress.set(payload.taskId, progress);
    } else {
      this.sessionProgress = progress;
    }

    return progress;
  }

  public getTaskProgress(taskId: string): TaskProgress | undefined {
    return this.taskProgress.get(taskId);
  }

  public getSessionProgress(): TaskProgress | null {
    return this.sessionProgress ? { ...this.sessionProgress } : null;
  }

  /**
   * Derives a mathematical aggregate progress based on completed tasks versus total tasks.
   * Does not fabricate continuous percentages if no tasks exist.
   */
  public deriveAggregateProgress(totalTasks: number, completedTasks: number): TaskProgress | null {
    if (this.sessionProgress) {
      return { ...this.sessionProgress };
    }

    if (totalTasks === 0) {
      return null;
    }

    const percentage = Math.round((completedTasks / totalTasks) * 1000) / 10;
    return {
      completedWork: completedTasks,
      totalWork: totalTasks,
      verifiedWork: completedTasks,
      isEstimate: false,
      unit: 'tasks',
      percentage,
    };
  }

  public clear(): void {
    this.taskProgress.clear();
    this.sessionProgress = null;
  }
}
