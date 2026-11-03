import type { AoeEvent } from '@aoe/protocol';
import type { SessionSnapshot, StateListener, UnsubscribeFn } from './types.js';

export class StateDispatcher {
  private readonly sessionListeners: Map<string, Set<StateListener>> = new Map();
  private readonly globalListeners: Set<StateListener> = new Set();
  public readonly coalesceUpdates: boolean;

  constructor(coalesceUpdates = false) {
    this.coalesceUpdates = coalesceUpdates;
  }

  /**
   * Subscribes a listener to state updates for a specific session.
   */
  public subscribe(sessionId: string, listener: StateListener): UnsubscribeFn {
    let listeners = this.sessionListeners.get(sessionId);
    if (!listeners) {
      listeners = new Set();
      this.sessionListeners.set(sessionId, listeners);
    }
    listeners.add(listener);

    return () => {
      const set = this.sessionListeners.get(sessionId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.sessionListeners.delete(sessionId);
        }
      }
    };
  }

  /**
   * Subscribes a listener to state updates across all sessions.
   */
  public subscribeAll(listener: StateListener): UnsubscribeFn {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  /**
   * Dispatches a state snapshot and initiating event to all registered listeners.
   * Subscriber exceptions are caught and isolated.
   */
  public dispatch(sessionId: string, snapshot: SessionSnapshot, event: AoeEvent): void {
    const sessionSet = this.sessionListeners.get(sessionId);
    const targets: StateListener[] = [
      ...(sessionSet ? Array.from(sessionSet) : []),
      ...Array.from(this.globalListeners),
    ];

    for (const listener of targets) {
      try {
        listener(snapshot, event);
      } catch (err) {
        // Isolate subscriber exceptions to prevent engine crash
        console.error(`[StateDispatcher] Error in listener for session '${sessionId}':`, err);
      }
    }
  }

  public getSubscriberCount(sessionId?: string): number {
    if (sessionId) {
      return (this.sessionListeners.get(sessionId)?.size ?? 0) + this.globalListeners.size;
    }
    let total = this.globalListeners.size;
    for (const set of this.sessionListeners.values()) {
      total += set.size;
    }
    return total;
  }

  public clear(): void {
    this.sessionListeners.clear();
    this.globalListeners.clear();
  }
}
