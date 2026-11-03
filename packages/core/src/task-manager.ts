import type {
  TaskStartedPayload,
  TaskUpdatedPayload,
  TaskCompletedPayload,
  TaskFailedPayload,
} from '@aoe/protocol';
import type { TaskSnapshot, CoreTaskStatus, TaskProgress } from './types.js';
import {
  CircularTaskHierarchyError,
  DuplicateTaskError,
  MissingParentTaskError,
  UnknownTaskError,
} from './errors.js';
import { LifecycleManager } from './lifecycle-manager.js';

interface MutableTask {
  id: string;
  name: string;
  description?: string;
  status: CoreTaskStatus;
  parentTaskId?: string;
  childTaskIds: string[];
  depth: number;
  progress?: TaskProgress;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  durationMs?: number;
  verified?: boolean;
  resultSummary?: string;
  deliverables?: string[];
  error?: {
    code: string;
    message: string;
    stack?: string;
    recoverable?: boolean;
  };
}

export class TaskManager {
  private readonly tasks: Map<string, MutableTask> = new Map();
  private readonly rootTaskIds: string[] = [];
  public readonly sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  public getTask(taskId: string): TaskSnapshot | undefined {
    const task = this.tasks.get(taskId);
    return task ? this.toSnapshot(task) : undefined;
  }

  public getAllTasks(): ReadonlyMap<string, TaskSnapshot> {
    const map = new Map<string, TaskSnapshot>();
    for (const [id, task] of this.tasks.entries()) {
      map.set(id, this.toSnapshot(task));
    }
    return map;
  }

  public getRootTaskIds(): readonly string[] {
    return [...this.rootTaskIds];
  }

  /**
   * Registers a new task initiated via task.started.
   */
  public registerTask(
    payload: TaskStartedPayload,
    timestamp: string,
    eventId?: string,
  ): TaskSnapshot {
    if (this.tasks.has(payload.taskId)) {
      throw new DuplicateTaskError(payload.taskId, this.sessionId, eventId);
    }

    let depth = 0;
    if (payload.parentTaskId) {
      const parent = this.tasks.get(payload.parentTaskId);
      if (!parent) {
        throw new MissingParentTaskError(
          payload.taskId,
          payload.parentTaskId,
          this.sessionId,
          eventId,
        );
      }
      this.assertNoCircularReference(payload.taskId, payload.parentTaskId);
      depth = parent.depth + 1;
      parent.childTaskIds.push(payload.taskId);
    } else {
      this.rootTaskIds.push(payload.taskId);
    }

    const newTask: MutableTask = {
      id: payload.taskId,
      name: payload.taskName,
      description: payload.description,
      status: 'running',
      parentTaskId: payload.parentTaskId,
      childTaskIds: [],
      depth: payload.depth ?? depth,
      startedAt: timestamp,
      updatedAt: timestamp,
    };

    this.tasks.set(payload.taskId, newTask);
    return this.toSnapshot(newTask);
  }

  /**
   * Updates an existing task via task.updated.
   */
  public updateTask(
    payload: TaskUpdatedPayload,
    timestamp: string,
    eventId?: string,
  ): TaskSnapshot {
    const task = this.tasks.get(payload.taskId);
    if (!task) {
      throw new UnknownTaskError(payload.taskId, this.sessionId, eventId);
    }

    LifecycleManager.validateTaskTransition(
      task.id,
      task.status,
      payload.status,
      this.sessionId,
      eventId,
    );

    task.status = payload.status;
    task.updatedAt = timestamp;
    if (payload.message) {
      task.description = payload.message;
    }

    return this.toSnapshot(task);
  }

  /**
   * Completes a task via task.completed.
   */
  public completeTask(
    payload: TaskCompletedPayload,
    timestamp: string,
    eventId?: string,
  ): TaskSnapshot {
    const task = this.tasks.get(payload.taskId);
    if (!task) {
      throw new UnknownTaskError(payload.taskId, this.sessionId, eventId);
    }

    LifecycleManager.validateTaskTransition(
      task.id,
      task.status,
      'completed',
      this.sessionId,
      eventId,
    );

    task.status = 'completed';
    task.updatedAt = timestamp;
    task.completedAt = timestamp;
    task.resultSummary = payload.resultSummary;
    task.verified = payload.verified;
    task.durationMs = payload.durationMs;
    if (payload.deliverables) {
      task.deliverables = [...payload.deliverables];
    }

    return this.toSnapshot(task);
  }

  /**
   * Fails a task via task.failed.
   */
  public failTask(payload: TaskFailedPayload, timestamp: string, eventId?: string): TaskSnapshot {
    const task = this.tasks.get(payload.taskId);
    if (!task) {
      throw new UnknownTaskError(payload.taskId, this.sessionId, eventId);
    }

    LifecycleManager.validateTaskTransition(
      task.id,
      task.status,
      'failed',
      this.sessionId,
      eventId,
    );

    task.status = 'failed';
    task.updatedAt = timestamp;
    task.completedAt = timestamp;
    task.durationMs = payload.durationMs;
    task.error = {
      code: payload.error.code,
      message: payload.error.message,
      stack: payload.error.stack,
      recoverable: payload.recoverable,
    };

    return this.toSnapshot(task);
  }

  /**
   * Updates progress for a task.
   */
  public updateTaskProgress(
    taskId: string,
    progress: TaskProgress,
    timestamp: string,
  ): TaskSnapshot {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new UnknownTaskError(taskId, this.sessionId);
    }

    task.progress = progress;
    task.updatedAt = timestamp;
    return this.toSnapshot(task);
  }

  public get counts(): { total: number; active: number; completed: number; failed: number } {
    let active = 0;
    let completed = 0;
    let failed = 0;

    for (const task of this.tasks.values()) {
      if (task.status === 'completed') {
        completed += 1;
      } else if (task.status === 'failed') {
        failed += 1;
      } else {
        active += 1;
      }
    }

    return { total: this.tasks.size, active, completed, failed };
  }

  private assertNoCircularReference(taskId: string, parentTaskId: string): void {
    let currentId: string | undefined = parentTaskId;
    const visited = new Set<string>([taskId]);

    while (currentId) {
      if (visited.has(currentId)) {
        throw new CircularTaskHierarchyError(taskId, parentTaskId, this.sessionId);
      }
      visited.add(currentId);
      const parent = this.tasks.get(currentId);
      currentId = parent?.parentTaskId;
    }
  }

  private toSnapshot(task: MutableTask): TaskSnapshot {
    return {
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      parentTaskId: task.parentTaskId,
      childTaskIds: [...task.childTaskIds],
      depth: task.depth,
      progress: task.progress ? { ...task.progress } : undefined,
      startedAt: task.startedAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
      durationMs: task.durationMs,
      verified: task.verified,
      resultSummary: task.resultSummary,
      deliverables: task.deliverables ? [...task.deliverables] : undefined,
      error: task.error ? { ...task.error } : undefined,
    };
  }
}
