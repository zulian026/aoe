export const PROTOCOL_NAME = 'aoe';
export const PROTOCOL_VERSION = '1.0.0';

export const EVENT_TYPES = [
  'session.started',
  'session.ended',
  'task.started',
  'task.updated',
  'task.completed',
  'task.failed',
  'progress.updated',
  'log.emitted',
  'file.changed',
  'diagnostic.emitted',
  'result.produced',
  'error.occurred',
] as const;

export type AoeEventType = (typeof EVENT_TYPES)[number];

export const FILE_ACTIONS = ['CREATED', 'MODIFIED', 'DELETED', 'RENAMED'] as const;
export type FileAction = (typeof FILE_ACTIONS)[number];

export const DIAGNOSTIC_SEVERITIES = ['error', 'warning', 'info'] as const;
export type DiagnosticSeverity = (typeof DIAGNOSTIC_SEVERITIES)[number];

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const TASK_STATUSES = ['idle', 'running', 'blocked', 'warning'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const SESSION_STATUSES = ['completed', 'failed', 'cancelled'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const RESULT_CATEGORIES = ['artifact', 'metric', 'summary', 'test_results'] as const;
export type ResultCategory = (typeof RESULT_CATEGORIES)[number];

export const ERROR_SEVERITIES = ['fatal', 'recoverable'] as const;
export type ErrorSeverity = (typeof ERROR_SEVERITIES)[number];
