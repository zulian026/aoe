import type {
  AoeEvent,
  FileAction,
  LineDelta,
  FileEvidence,
  DiagnosticSeverity,
  DiagnosticLocation,
} from '@aoe/protocol';
import type { EngineError } from './errors.js';

export type CoreSessionStatus = 'active' | 'completed' | 'failed' | 'cancelled';
export type CoreTaskStatus = 'idle' | 'running' | 'blocked' | 'warning' | 'completed' | 'failed';

export interface AgentMetadata {
  readonly name: string;
  readonly version?: string;
  readonly environment?: string;
}

export interface TaskProgress {
  readonly completedWork: number;
  readonly totalWork?: number;
  readonly verifiedWork?: number;
  readonly isEstimate: boolean;
  readonly unit?: string;
  readonly description?: string;
  readonly percentage: number | null;
}

export interface TaskSnapshot {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly status: CoreTaskStatus;
  readonly parentTaskId?: string;
  readonly childTaskIds: readonly string[];
  readonly depth: number;
  readonly progress?: TaskProgress;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly verified?: boolean;
  readonly resultSummary?: string;
  readonly deliverables?: readonly string[];
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly stack?: string;
    readonly recoverable?: boolean;
  };
}

export interface FileChangeSummary {
  readonly action: FileAction;
  readonly path: string;
  readonly oldPath?: string;
  readonly lineDelta?: LineDelta;
  readonly evidence: FileEvidence;
  readonly description?: string;
  readonly taskId?: string;
  readonly timestamp: string;
}

export interface DiagnosticSummary {
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly code?: string;
  readonly location?: DiagnosticLocation;
  readonly isHypothesis: boolean;
  readonly rootCause?: string;
  readonly suggestedRemediation?: string;
  readonly taskId?: string;
  readonly timestamp: string;
}

export interface SessionStats {
  readonly tasksTotal: number;
  readonly tasksCompleted: number;
  readonly tasksFailed: number;
  readonly filesChanged: number;
  readonly errorsCount: number;
  readonly warningsCount: number;
  readonly durationMs?: number;
}

export interface SessionSnapshot {
  readonly sessionId: string;
  readonly status: CoreSessionStatus;
  readonly agent: AgentMetadata;
  readonly workingDirectory: string;
  readonly parentSessionId?: string;
  readonly startedAt: string;
  readonly endedAt?: string;
  readonly durationMs?: number;
  readonly lastSequence: number;
  readonly totalEvents: number;
  readonly tasks: ReadonlyMap<string, TaskSnapshot>;
  readonly rootTaskIds: readonly string[];
  readonly activeTaskCount: number;
  readonly completedTaskCount: number;
  readonly failedTaskCount: number;
  readonly progress: TaskProgress | null;
  readonly fileChanges: readonly FileChangeSummary[];
  readonly diagnostics: readonly DiagnosticSummary[];
  readonly stats: SessionStats;
}

export type EventProcessingResult =
  | { readonly status: 'accepted'; readonly event: AoeEvent; readonly snapshot: SessionSnapshot }
  | {
      readonly status: 'duplicate';
      readonly eventId: string;
      readonly sequence: number;
      readonly reason: string;
    }
  | {
      readonly status: 'buffered';
      readonly eventId: string;
      readonly sequence: number;
      readonly expectedSequence: number;
    }
  | { readonly status: 'rejected'; readonly reason: string; readonly error: EngineError };

export type StateListener = (snapshot: SessionSnapshot, event: AoeEvent) => void;
export type UnsubscribeFn = () => void;

export interface EngineConfig {
  readonly maxBufferSize?: number;
  readonly maxEventsPerSession?: number;
  readonly coalesceUpdates?: boolean;
}
