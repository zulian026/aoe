export type SidecarConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'closed';

export interface SidecarProgress {
  completedWork: number;
  totalWork?: number;
  percentage: number | null;
  currentWork?: string;
  isEstimate: boolean;
  unit?: string;
}

export interface SidecarFileChange {
  action: 'CREATED' | 'MODIFIED' | 'DELETED' | 'RENAMED';
  path: string;
  evidence?: { verifiedOnDisk?: boolean };
  description?: string;
  taskId?: string;
  timestamp: string;
}

export interface SidecarVerificationEvidence {
  taskId: string;
  verified: boolean;
  timestamp: string;
  resultSummary?: string;
}

export interface SidecarDiagnostic {
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
  code?: string;
  taskId?: string;
  details?: unknown;
}

export interface SidecarTaskModel {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'warning';
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  verified: boolean;
  progress?: SidecarProgress;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  fileChanges: SidecarFileChange[];
  metadata?: Record<string, unknown>;
}

export interface SidecarToolActivity {
  stepIdx?: number;
  name: string;
  status: 'executing' | 'completed' | 'failed';
  timestamp: string;
  taskId?: string;
  description?: string;
}

export interface SidecarReadModelSnapshot {
  sessionId?: string;
  agent?: { name: string; version?: string; environment?: string };
  workingDirectory?: string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  status: 'uninitialized' | 'active' | 'completed' | 'failed' | 'cancelled';
  isTerminated: boolean;
  terminationReason?: string;
  activeTaskId?: string;
  currentTask?: SidecarTaskModel;
  tasks: Record<string, SidecarTaskModel>;
  rootTaskIds: string[];
  overallProgress?: SidecarProgress;
  activeTools: SidecarToolActivity[];
  toolHistory: SidecarToolActivity[];
  fileChanges: SidecarFileChange[];
  verificationStatus: {
    verified: boolean;
    evidenceCount: number;
    evidenceList: SidecarVerificationEvidence[];
  };
  diagnostics: SidecarDiagnostic[];
  sequenceStats: {
    lastSequence: number;
    totalEventsReceived: number;
    duplicateCount: number;
    gapCount: number;
    outOfOrderCount: number;
  };
}

export interface IpcClientOptions {
  socketPath: string;
  minBackoffMs?: number;
  maxBackoffMs?: number;
  backoffFactor?: number;
  maxRetries?: number;
  connectTimeoutMs?: number;
  autoReconnect?: boolean;
}

export interface FrameDecodeResult {
  lines: string[];
  errors: Array<{ raw: string; error: string }>;
}

export interface SequenceCheckResult {
  accepted: boolean;
  anomaly?: 'duplicate' | 'sequence_gap' | 'out_of_order';
  diagnostic?: SidecarDiagnostic;
}
