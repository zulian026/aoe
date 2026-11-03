export * from './types.js';
export * from './errors.js';
export * from './session-manager.js';
export * from './sequence-tracker.js';
export * from './deduplication.js';
export * from './lifecycle-manager.js';
export * from './task-manager.js';
export * from './progress-tracker.js';
export * from './event-store.js';
export * from './state-dispatcher.js';
export * from './event-processor.js';
export * from './engine.js';

// Legacy M00 SessionState interface
export interface SessionState {
  id: string;
  startedAt: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  eventsProcessed: number;
}
