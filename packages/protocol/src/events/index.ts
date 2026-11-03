import { z } from 'zod';
import {
  SessionStartedEventSchema,
  SessionEndedEventSchema,
  type SessionStartedEvent,
  type SessionEndedEvent,
} from './session.js';
import {
  TaskStartedEventSchema,
  TaskUpdatedEventSchema,
  TaskCompletedEventSchema,
  TaskFailedEventSchema,
  type TaskStartedEvent,
  type TaskUpdatedEvent,
  type TaskCompletedEvent,
  type TaskFailedEvent,
} from './task.js';
import { ProgressUpdatedEventSchema, type ProgressUpdatedEvent } from './progress.js';
import { LogEmittedEventSchema, type LogEmittedEvent } from './log.js';
import { FileChangedEventSchema, type FileChangedEvent } from './file.js';
import { DiagnosticEmittedEventSchema, type DiagnosticEmittedEvent } from './diagnostic.js';
import { ResultProducedEventSchema, type ResultProducedEvent } from './result.js';
import { ErrorOccurredEventSchema, type ErrorOccurredEvent } from './error.js';

export * from './session.js';
export * from './task.js';
export * from './progress.js';
export * from './log.js';
export * from './file.js';
export * from './diagnostic.js';
export * from './result.js';
export * from './error.js';

export const AoeEventSchema = z.discriminatedUnion('eventType', [
  SessionStartedEventSchema,
  SessionEndedEventSchema,
  TaskStartedEventSchema,
  TaskUpdatedEventSchema,
  TaskCompletedEventSchema,
  TaskFailedEventSchema,
  ProgressUpdatedEventSchema,
  LogEmittedEventSchema,
  FileChangedEventSchema,
  DiagnosticEmittedEventSchema,
  ResultProducedEventSchema,
  ErrorOccurredEventSchema,
]);

export type AoeEvent =
  | SessionStartedEvent
  | SessionEndedEvent
  | TaskStartedEvent
  | TaskUpdatedEvent
  | TaskCompletedEvent
  | TaskFailedEvent
  | ProgressUpdatedEvent
  | LogEmittedEvent
  | FileChangedEvent
  | DiagnosticEmittedEvent
  | ResultProducedEvent
  | ErrorOccurredEvent;
