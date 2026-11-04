# AOE Core Engine — State Management & Model

## 1. State Model Architecture

The AOE Core Engine exposes an immutable, read-only state snapshot model designed for presentation layers, renderers, and subscribers. Internal mutable state containers are strictly isolated inside `@zyanx04/core`.

---

## 2. Session Snapshot Structure

```typescript
export interface SessionSnapshot {
  readonly sessionId: string;
  readonly status: 'active' | 'completed' | 'failed' | 'cancelled';
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
```

---

## 3. Immutability Guarantees

1. **Defensive Copies**: All arrays (`fileChanges`, `diagnostics`, `rootTaskIds`) and objects (`agent`, `stats`) are cloned defensively during snapshot generation.
2. **Read-Only Maps**: Task maps are typed as `ReadonlyMap<string, TaskSnapshot>`. External mutation attempts do not affect engine internal state.
3. **Snapshot Isolation**: When a subscriber receives a snapshot, it represents a point-in-time state that will not mutate underfoot as new events arrive.

---

## 4. State Machines

### Session State Transitions

```
[ Unregistered ] ──(session.started)──► [ active ]
                                           │
                        ┌──────────────────┼──────────────────┐
                        │                  │                  │
                        ▼                  ▼                  ▼
                  [ completed ]        [ failed ]       [ cancelled ]
```

### Task State Transitions

```
[ Unregistered ] ──(task.started)──► [ running ] ◄──────────┐
                                         │                  │
                                 ┌───────┴───────┐          │
                                 ▼               ▼          │
                            [ blocked ]     [ warning ] ────┘
                                 │               │
                                 └───────┬───────┘
                                         │
                                 ┌───────┴───────┐
                                 ▼               ▼
                           [ completed ]    [ failed ]
                            (verified: true)
```

---

## 5. Memory Management & Bounded Growth

1. **Out-of-Order Buffer Bounding**: Per-session out-of-order buffers are capped by `maxBufferSize` (default 100). Reaching the buffer limit raises `BufferOverflowError` rather than allowing unbounded memory growth.
2. **Event Store Eviction**: Event stores enforce a maximum number of events per session (default 10,000) with FIFO eviction of oldest events when capacity is reached.
3. **Session Cleansing**: When `engine.dispose()` or `sessionManager.deleteSession()` is called, all associated sequence buffers, deduplication hashes, and task maps are cleanly de-referenced.
