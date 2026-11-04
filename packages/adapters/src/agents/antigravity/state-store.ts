import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import type { VerificationEvidence } from './evidence.js';

export interface PersistentSessionState {
  version: 1;
  sessionId: string;
  agentName: string;
  workingDirectory: string;
  currentSequence: number;
  activeTaskId?: string;
  startedAt: string;
  lastUpdatedAt: string;
  isTerminated: boolean;
  terminationReason?: string;
  taskMap: Record<string, string>;
  activeTools: Record<string, { name: string; args: Record<string, unknown>; stepIdx: number }>;
  verificationEvidence: VerificationEvidence[];
  processedEventSignatures: string[];
}

export function sanitizeSessionId(id?: string): string {
  const trimmed = typeof id === 'string' ? id.trim() : '';
  const effective = trimmed.length > 0 ? trimmed : 'default';
  const clean = effective.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (Buffer.byteLength(clean, 'utf-8') > 32) {
    const hash = crypto.createHash('sha256').update(clean).digest('hex').slice(0, 16);
    return `${clean.slice(0, 16)}_${hash}`;
  }

  return clean;
}

export function getSessionStorageDir(): string {
  if (process.env.AOE_SESSION_DIR && fs.existsSync(process.env.AOE_SESSION_DIR)) {
    return process.env.AOE_SESSION_DIR;
  }

  const runtimeDir = process.env.XDG_RUNTIME_DIR;
  if (runtimeDir && fs.existsSync(runtimeDir)) {
    return runtimeDir;
  }

  return fs.existsSync('/tmp') ? '/tmp' : os.tmpdir();
}

export class AntigravitySessionStore {
  public readonly sessionId: string;
  public readonly safeId: string;
  public readonly statePath: string;
  public readonly lockPath: string;

  constructor(sessionId?: string, baseDir?: string) {
    this.safeId = sanitizeSessionId(sessionId);
    this.sessionId = typeof sessionId === 'string' && sessionId.trim().length > 0 ? sessionId.trim() : 'default';

    const dir = baseDir ?? getSessionStorageDir();
    this.statePath = path.join(dir, `aoe-state-${this.safeId}.json`);
    this.lockPath = path.join(dir, `aoe-state-${this.safeId}.lock`);
  }

  /**
   * Executes an operation with atomic file locking and state persistence.
   */
  public async withLock<T>(fn: (state: PersistentSessionState) => T | Promise<T>): Promise<T> {
    await this.acquireLock();
    try {
      const state = this.readStateUnsafe();
      const result = await fn(state);
      this.writeStateUnsafe(state);
      return result;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Synchronous variant of withLock for sync normalization pipelines.
   */
  public withLockSync<T>(fn: (state: PersistentSessionState) => T): T {
    this.acquireLockSync();
    try {
      const state = this.readStateUnsafe();
      const result = fn(state);
      this.writeStateUnsafe(state);
      return result;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Retrieves the current snapshot of persistent session state.
   */
  public getStateSync(): PersistentSessionState {
    return this.withLockSync((state) => ({ ...state }));
  }

  /**
   * Allocates `count` strictly monotonic sequence numbers for this session.
   */
  public allocateSequencesSync(count = 1): number[] {
    return this.withLockSync((state) => {
      const allocated: number[] = [];
      for (let i = 0; i < count; i++) {
        state.currentSequence += 1;
        allocated.push(state.currentSequence);
      }
      return allocated;
    });
  }

  /**
   * Records verification evidence bound to a specific task.
   */
  public recordEvidenceSync(evidence: VerificationEvidence): void {
    this.withLockSync((state) => {
      state.verificationEvidence.push(evidence);
    });
  }

  /**
   * Checks if valid passed verification evidence exists for the specified task.
   */
  public hasPassedVerificationSync(taskId: string): boolean {
    return this.withLockSync((state) => {
      return state.verificationEvidence.some((ev) => ev.taskId === taskId && ev.passed);
    });
  }

  /**
   * Checks if an event signature has already been processed in this session.
   */
  public checkAndRecordSignatureSync(signature: string): boolean {
    return this.withLockSync((state) => {
      if (state.processedEventSignatures.includes(signature)) {
        return true; // Already processed (duplicate)
      }
      state.processedEventSignatures.push(signature);
      return false;
    });
  }

  /**
   * Maps or retrieves a persistent task ID.
   */
  public mapTaskIdSync(externalTaskId: string): string {
    return this.withLockSync((state) => {
      const existing = state.taskMap[externalTaskId];
      if (existing) {
        return existing;
      }
      const sanitized = externalTaskId.replace(/[^a-zA-Z0-9_-]/g, '_');
      state.taskMap[externalTaskId] = sanitized;
      return sanitized;
    });
  }

  /**
   * Gets the active task ID from the persistent store.
   */
  public getActiveTaskIdSync(): string | undefined {
    return this.withLockSync((state) => state.activeTaskId);
  }

  /**
   * Sets the active task ID in the persistent store.
   */
  public setActiveTaskIdSync(taskId: string): void {
    this.withLockSync((state) => {
      state.activeTaskId = taskId;
    });
  }

  /**
   * Clears the active task ID in the persistent store.
   */
  public clearActiveTaskIdSync(): void {
    this.withLockSync((state) => {
      state.activeTaskId = undefined;
    });
  }

  /**
   * Marks the session as terminated in the persistent store.
   */
  public markTerminatedSync(reason?: string): void {
    this.withLockSync((state) => {
      state.isTerminated = true;
      state.terminationReason = reason;
      state.activeTaskId = undefined;
    });
  }

  /**
   * Reads state without locking (internal use only).
   */
  private readStateUnsafe(): PersistentSessionState {
    if (fs.existsSync(this.statePath)) {
      try {
        const raw = fs.readFileSync(this.statePath, 'utf-8');
        const parsed = JSON.parse(raw) as PersistentSessionState;
        if (parsed && parsed.version === 1) {
          return parsed;
        }
      } catch {
        // Fallback to fresh state on parse error
      }
    }

    const now = new Date().toISOString();
    return {
      version: 1,
      sessionId: this.sessionId,
      agentName: 'antigravity',
      workingDirectory: process.cwd(),
      currentSequence: -1,
      startedAt: now,
      lastUpdatedAt: now,
      isTerminated: false,
      taskMap: {},
      activeTools: {},
      verificationEvidence: [],
      processedEventSignatures: [],
    };
  }

  /**
   * Writes state atomically via temporary file and rename.
   */
  private writeStateUnsafe(state: PersistentSessionState): void {
    state.lastUpdatedAt = new Date().toISOString();
    const tempFile = `${this.statePath}.tmp.${process.pid}.${Date.now()}`;
    const payload = JSON.stringify(state, null, 2);

    try {
      fs.writeFileSync(tempFile, payload, 'utf-8');
      fs.renameSync(tempFile, this.statePath);
    } catch (err) {
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch {
        // Ignore temp cleanup error
      }
      throw err;
    }
  }

  /**
   * Acquires the lock file with spinlock and stale lock eviction.
   */
  private async acquireLock(timeoutMs = 3000): Promise<void> {
    const start = Date.now();
    const retryIntervalMs = 20;

    while (Date.now() - start < timeoutMs) {
      if (this.tryCreateLock()) {
        return;
      }

      // Check for stale lock (> 5000ms old)
      this.evictStaleLock();

      await new Promise((r) => setTimeout(r, retryIntervalMs));
    }

    // Force acquire if lock timed out
    this.releaseLock();
    if (!this.tryCreateLock()) {
      throw new Error(`Failed to acquire lock for session "${this.sessionId}" after ${timeoutMs}ms`);
    }
  }

  /**
   * Synchronous lock acquisition for synchronous normalize operations.
   */
  private acquireLockSync(timeoutMs = 2000): void {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      if (this.tryCreateLock()) {
        return;
      }

      this.evictStaleLock();

      // Busy wait short sleep simulation
      const waitUntil = Date.now() + 10;
      while (Date.now() < waitUntil) {
        // Spin
      }
    }

    this.releaseLock();
    if (!this.tryCreateLock()) {
      throw new Error(`Failed to acquire lock sync for session "${this.sessionId}" after ${timeoutMs}ms`);
    }
  }

  private tryCreateLock(): boolean {
    try {
      const fd = fs.openSync(this.lockPath, 'wx');
      fs.writeSync(fd, `${process.pid}\n${Date.now()}\n`);
      fs.closeSync(fd);
      return true;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
        return false;
      }
      return false;
    }
  }

  private evictStaleLock(): void {
    try {
      if (fs.existsSync(this.lockPath)) {
        const stats = fs.statSync(this.lockPath);
        if (Date.now() - stats.mtimeMs > 5000) {
          fs.unlinkSync(this.lockPath);
        }
      }
    } catch {
      // Ignore eviction race condition
    }
  }

  private releaseLock(): void {
    try {
      if (fs.existsSync(this.lockPath)) {
        fs.unlinkSync(this.lockPath);
      }
    } catch {
      // Ignore release error
    }
  }

  /**
   * Cleans up both state and lock files (useful for tests and session disposal).
   */
  public clean(): void {
    this.releaseLock();
    try {
      if (fs.existsSync(this.statePath)) {
        fs.unlinkSync(this.statePath);
      }
    } catch {
      // Ignore cleanup error
    }
  }
}
