# AOE Core Engine — Event Processing Pipeline & Atomicity

## 1. Pipeline Execution Flow

Every event ingested by the Engine passes through a strict nine-stage transactional pipeline:

```
Incoming Raw Event
    │
    ▼
1. Envelope Validation ────────► (Invalid schema ➔ Rejected)
    │
    ▼
2. Session Resolution ─────────► (Unknown session and not session.started ➔ Rejected)
    │
    ▼
3. Deduplication Check ────────► (Conflicting content ➔ Rejected; Identical ➔ Duplicate)
    │
    ▼
4. Sequence Validation ────────► (Past sequence ➔ Duplicate; Future sequence ➔ Buffered)
    │
    ▼
5. Lifecycle Validation ───────► (Terminal session or invalid task state ➔ Rejected)
    │
    ▼
6. Domain State Mutation ──────► (Update tasks, progress, files, diagnostics atomically)
    │
    ▼
7. Sequence & Dedup Commit ────► (Advance expectedSequence, record eventId)
    │
    ▼
8. Event Store Commit ─────────► (Persist event to in-memory store)
    │
    ▼
9. Snapshot & Dispatch ────────► (Generate immutable snapshot and notify subscribers)
    │
    ▼
10. Buffer Drain ──────────────► (If contiguous buffered events exist, process them)
```

---

## 2. Atomicity & Rollback Guarantees

The Engine guarantees atomic state mutations from the perspective of external consumers:

1. **Zero Partial Mutations**: If validation fails at stage 1, 2, 3, 4, or 5 (e.g. sequence gap, missing parent task, or invalid lifecycle transition), no domain state is altered:
   - Sequence counter does not advance.
   - Deduplication store does not record the failed event ID.
   - Event store does not commit the failed event.
   - Existing task maps and snapshots remain completely unchanged.
2. **Deterministic Results**: `engine.processEvent()` returns an explicit typed result:
   - `accepted`: Event was successfully verified and committed.
   - `duplicate`: Event was previously accepted; no state change occurred.
   - `buffered`: Event arrived ahead of expected sequence and is held safely in buffer.
   - `rejected`: Event failed validation with a typed `EngineError`.

---

## 3. Sequence and Recovery Semantics

### Bounded Out-of-Order Recovery

When an event arrives with `sequence > expectedSequence`:

1. It is temporarily stored in an in-memory `Map<sequence, AoeEvent>` buffer.
2. When the missing event arrives (e.g. sequence 1 arrives after sequence 2 was buffered), sequence 1 is applied immediately.
3. The engine automatically calls `drainContiguous()`, popping sequence 2 from the buffer and processing it without requiring external re-transmission.
4. If the buffer exceeds `maxBufferSize` (default 100), `BufferOverflowError` is raised to prevent denial-of-service memory exhaustion.
