import { PROTOCOL_VERSION, type AoeEventType } from './constants.js';
import type {
  AoeEvent,
  ProgressUpdatedPayload,
  SessionStartedPayload,
  SessionEndedPayload,
  TaskStartedPayload,
  TaskUpdatedPayload,
  TaskCompletedPayload,
  TaskFailedPayload,
  LogEmittedPayload,
  FileChangedPayload,
  DiagnosticEmittedPayload,
  ResultProducedPayload,
  ErrorOccurredPayload,
} from './events/index.js';

export function createEventId(prefix = 'evt'): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${ts}_${rnd}`;
}

export function createSessionId(prefix = 'sess'): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${ts}_${rnd}`;
}

export function createTaskId(prefix = 'task'): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${ts}_${rnd}`;
}

/**
 * Calculates a verified progress percentage from a ProgressUpdatedPayload.
 * Returns null if the percentage cannot be derived mathematically from a finite, positive denominator.
 */
export function calculateProgressPercentage(payload: ProgressUpdatedPayload): number | null {
  if (payload.totalWork !== undefined && payload.totalWork > 0) {
    const raw = (payload.completedWork / payload.totalWork) * 100;
    // Cap at 100% unless marked as estimate
    const bounded = payload.isEstimate ? raw : Math.min(100, Math.max(0, raw));
    return Math.round(bounded * 10) / 10;
  }
  return null;
}

/**
 * Checks whether an event represents a terminal state in the session or task lifecycle.
 */
export function isTerminalEvent(event: AoeEvent): boolean {
  if (event.eventType === 'session.ended') {
    return true;
  }
  if (event.eventType === 'task.completed') {
    return true;
  }
  if (event.eventType === 'task.failed') {
    return event.payload.recoverable !== true;
  }
  return false;
}

export type PayloadMap = {
  'session.started': SessionStartedPayload;
  'session.ended': SessionEndedPayload;
  'task.started': TaskStartedPayload;
  'task.updated': TaskUpdatedPayload;
  'task.completed': TaskCompletedPayload;
  'task.failed': TaskFailedPayload;
  'progress.updated': ProgressUpdatedPayload;
  'log.emitted': LogEmittedPayload;
  'file.changed': FileChangedPayload;
  'diagnostic.emitted': DiagnosticEmittedPayload;
  'result.produced': ResultProducedPayload;
  'error.occurred': ErrorOccurredPayload;
};

export interface CreateEventOptions<T extends AoeEventType> {
  sessionId: string;
  sequence: number;
  payload: PayloadMap[T];
  eventId?: string;
  timestamp?: string;
}

/**
 * Type-safe builder function to construct a valid AOE protocol event.
 */
export function createEvent<T extends AoeEventType>(
  eventType: T,
  options: CreateEventOptions<T>,
): AoeEvent {
  return {
    protocolVersion: PROTOCOL_VERSION,
    eventId: options.eventId ?? createEventId(),
    sessionId: options.sessionId,
    sequence: options.sequence,
    timestamp: options.timestamp ?? new Date().toISOString(),
    eventType,
    payload: options.payload,
  } as AoeEvent;
}
