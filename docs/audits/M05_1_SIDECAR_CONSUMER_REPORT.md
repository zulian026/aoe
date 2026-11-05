# M05.1 — AOE Stateful Sidecar Consumer Foundation Audit Report

**Date**: 2026-11-04  
**Project**: AOE (Agent Output Enhancement)  
**Workspace**: `~/Projects/aoe`  
**Baseline Commit**: `d2eee36`  
**Auditor**: Antigravity Assistant (AI Pair Programmer)  
**Classification**: `PASS` (All requirements satisfied and verified across 55 test suites)

---

## 1. Executive Summary & Verification Classification

Milestone M05.1 implements the **Stateful Sidecar Consumer Foundation** for AOE.

Following the live desktop integration verified in M04.3, M05.1 delivers an independent, event-driven consumer architecture capable of attaching to any active AOE session Unix Domain Socket, parsing streaming canonical Protocol v1.0.0 events incrementally, validating protocol contracts, tracking strictly monotonic sequence ordering, and maintaining a normalized, reactive state read model.

### Final Classification: `PASS`

| Verification Target                | Target Status | Actual Verification Evidence                                                                                                                                                                                             |
| ---------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Unix Domain Socket IPC Client**  | `PASS`        | `SidecarIpcClient` with connection lifecycle, bounded exponential backoff reconnection, timeout safeguards, and clean teardown. Verified across 8 integration tests.                                                     |
| **Incremental Framing**            | `PASS`        | `IncrementalFrameDecoder` splits multi-line chunks, buffers partial frames across chunk boundaries, drains trailing lines, and guards against buffer overflows.                                                          |
| **Canonical Protocol Validation**  | `PASS`        | `validateCanonicalEvent` validates JSON strings and objects against Protocol v1.0.0 envelopes and Zod schemas. 7 unit tests pass.                                                                                        |
| **Monotonic Sequence Enforcement** | `PASS`        | `SidecarEventSequencer` rejects duplicate event IDs and sequences, detects sequence gaps (`SEQUENCE_GAP`) and out-of-order events (`OUT_OF_ORDER_SEQUENCE`) without reordering or fabricating events. 6 unit tests pass. |
| **Normalized State Read Model**    | `PASS`        | `SidecarReadModel` maintains complete session state, task lifecycle, tool activity, file change history, and verification evidence exclusively from canonical events. 7 unit tests pass.                                 |
| **Terminal State Reconciliation**  | `PASS`        | Fixed producer/consumer discrepancy: producer marks store terminated (`markTerminatedSync`), and consumer immediately reconciles active tasks and clears `activeTaskId` upon `session.ended`.                            |
| **CLI Sidecar Command**            | `PASS`        | `aoe sidecar [options]` registered with socket auto-discovery (`discoverActiveSocket`), `--socket`, `--session`, `--once`, `--json`, and clean exit (code 0) when no session is active. 4 CLI unit tests pass.           |
| **Full Monorepo Regression**       | `PASS`        | All 55 test files (413 tests) passed cleanly with 0 failures across `@zyanx04/protocol`, `@zyanx04/theme`, `@zyanx04/components`, `@zyanx04/core`, `@zyanx04/adapters`, and `@zyanx04/cli`.                              |

---

## 2. Architectural Design & Separation of Concerns

The AOE Sidecar is strictly decoupled from the agent process and the hook bridge producer:

```
┌─────────────────────────────────────────────────────────────┐
│                       AGENT RUNTIME                         │
│   (e.g., Google Antigravity CLI / Desktop, Claude Code)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Lifecycle Hooks
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 AOE HOOK BRIDGE (PRODUCER)                  │
│  - AntigravityAdapter & Mapper                              │
│  - AntigravitySessionStore (Atomic File Locking)            │
│  - Unix Domain Socket Server (/tmp/aoe-<session>.sock)      │
└──────────────────────────────┬──────────────────────────────┘
                               │ Newline-Delimited JSON (IPC)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             AOE SIDECAR FOUNDATION (CONSUMER)               │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ SidecarIpcClient (Unix Socket Client, Auto-Reconnect) │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │ Raw Buffers                  │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ IncrementalFrameDecoder (Chunk & Line Buffer)         │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │ Complete JSON Lines          │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ validateCanonicalEvent (Protocol v1.0.0 & Zod Schema) │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │ Validated AoeEvent           │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ SidecarEventSequencer (Monotonicity & Anomaly Check)  │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │ Sequenced Event              │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ SidecarReadModel (State Reduction & Terminal Sync)    │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │ Reactive Snapshot (getSnapshot)
│                              ▼                              │
│             Sidecar Consumer Presentation Layer             │
│            (CLI Snapshot in M05.1 / Ink UI in M05.2)        │
└─────────────────────────────────────────────────────────────┘
```

### Invariants Maintained:

1. **Independent Process**: Sidecar runs in an independent terminal process; it never intercepts Antigravity's standard UI or modifies standard streams.
2. **Read-Only Consumer**: The sidecar does not emit events back into the socket; it only consumes from the hook bridge producer.
3. **Agent-Agnostic Core**: The consumer layer (`@zyanx04/core/sidecar`) relies solely on canonical Protocol v1.0.0 envelopes and schemas.
4. **No Event Fabrication**: If a sequence gap occurs, the consumer diagnoses the gap via a structured diagnostic without fabricating imaginary events.
5. **No Event Reordering**: Out-of-order events are ingested as observed with anomaly diagnosis to prevent race conditions or distorted timestamps.
6. **Privacy Preserved**: No scratchpads, tool execution side-effects, or hidden thinking blocks are recorded or exposed.

---

## 3. Implementation Details

### 3.1. Producer State Store & Mapper Synchronization Fixes

In M04.3, an edge-case was observed where `session.ended` was emitted, but the session store retained `isTerminated: false` and `activeTaskId` remained non-null because `mapStop` only generated the event without triggering a state update on `AntigravitySessionStore`.

- **`packages/adapters/src/agents/antigravity/state-store.ts`**:
  - Implemented `clearActiveTaskIdSync()` to explicitly remove the active task pointer when tasks finish.
  - Implemented `markTerminatedSync(reason?: string)` to atomically mark `isTerminated = true` and `status = 'completed' | 'failed' | 'cancelled'`.
- **`packages/adapters/src/agents/antigravity/mapper.ts`**:
  - Updated all 4 termination branches in `mapStop` (`Stop`, `SessionEnd`, `SubagentStop`, `SessionAborted`) to invoke `store?.markTerminatedSync(terminationReason)` prior to emitting `session.ended`.
- **`packages/adapters/src/tests/antigravity-adapter.test.ts`**:
  - Added regression test verifying `AntigravityAdapter.handleStopHook` updates store state to terminated with cleared `activeTaskId`.

### 3.2. Core Sidecar Consumer Modules (`packages/core/src/sidecar/`)

- **`types.ts`**: Complete domain model defining `SidecarConnectionStatus`, `SidecarTaskModel`, `SidecarFileChange`, `SidecarVerificationEvidence`, `SidecarDiagnostic`, `SidecarReadModelSnapshot`, `SequenceCheckResult`, and options interfaces.
- **`frame-decoder.ts` (`IncrementalFrameDecoder`)**: Robust stream parser handling chunks divided at arbitrary byte boundaries, multi-line chunks, empty line filtering, configurable buffer limits (default 1MB), and graceful drain.
- **`protocol-validator.ts` (`validateCanonicalEvent`)**: Validates JSON envelopes against `PROTOCOL_VERSION = '1.0.0'` and parses payloads against `@zyanx04/protocol` schemas.
- **`event-sequencer.ts` (`SidecarEventSequencer`)**: Enforces monotonic sequencing (`0..N`), detects duplicates by ID or sequence number, diagnoses sequence gaps, and logs out-of-order deliveries without mutations.
- **`read-model.ts` (`SidecarReadModel`)**: Normalized state aggregator tracking active session, task trees, progress metrics, tool executions, file modifications, and verification evidence. Enforces terminal session reconciliation on `session.ended`.
- **`ipc-client.ts` (`SidecarIpcClient`)**: Resilient Unix Domain Socket client with connection timeouts, bounded exponential backoff reconnection, safe EventEmitter error propagation, and graceful teardown.
- **`sidecar-consumer.ts` (`SidecarConsumer`)**: High-level coordinator linking client, decoder, validator, sequencer, and read model.
- **`index.ts`**: Public barrel exports cleanly exposing all sidecar consumer types and classes.

### 3.3. CLI Sidecar Command (`apps/cli/src/commands/sidecar.ts`)

- Implemented `registerSidecarCommand` registering `aoe sidecar [options]`.
- Implemented `discoverActiveSocket(customDir?)`: Automatically locates the most recent `aoe-*.sock` across `customDir`, `AOE_SESSION_DIR`, `XDG_RUNTIME_DIR`, `/tmp`, and `os.tmpdir()`.
- Supported options:
  - `-s, --socket <path>`: Explicit socket path.
  - `--session <id>`: Attach to socket derived from session ID.
  - `--dir <path>`: Search directory for session sockets.
  - `--once`: Connect, read snapshot, and exit cleanly.
  - `--json`: Format snapshots and messages as valid JSON.
- Handled empty / no-session state: When no socket is found, exits with code 0 and an informative status message.

---

## 4. Test Verification & Results

### 4.1. Unit Test Coverage

| Test Suite          | File                                                         | Tests | Result |
| ------------------- | ------------------------------------------------------------ | ----- | ------ |
| Incremental Framing | `packages/core/src/tests/sidecar-frame-decoder.test.ts`      | 9     | `PASS` |
| Protocol Validation | `packages/core/src/tests/sidecar-protocol-validator.test.ts` | 7     | `PASS` |
| Event Sequencer     | `packages/core/src/tests/sidecar-event-sequencer.test.ts`    | 6     | `PASS` |
| State Read Model    | `packages/core/src/tests/sidecar-read-model.test.ts`         | 7     | `PASS` |
| CLI Sidecar Command | `apps/cli/src/tests/sidecar-command.test.ts`                 | 4     | `PASS` |
| Antigravity Adapter | `packages/adapters/src/tests/antigravity-adapter.test.ts`    | 35    | `PASS` |

### 4.2. IPC Consumer Integration Suite (`packages/core/src/tests/sidecar-ipc-consumer.test.ts`)

Verified against real local Unix domain sockets in temporary directories:

1. **Connect & Ingest**: Client connects, ingests `session.started`, exposes active status in read model, and closes cleanly (`PASS`).
2. **Fragmented Chunks**: Chunks split across arbitrary boundaries reassemble deterministically (`PASS`).
3. **Multi-Event Chunks**: Multiple events within a single socket chunk process sequentially without dropping events (`PASS`).
4. **Malformed Frame Recovery**: Invalid JSON is rejected and recorded as a diagnostic without crashing the consumer (`PASS`).
5. **Sequence Anomalies**: Duplicate events ignored; sequence gaps diagnosed and recorded without fabricating missing events (`PASS`).
6. **Terminal Session Reconciliation**: `session.ended` received while task is running immediately reconciles task status and clears `activeTaskId` (`PASS`).
7. **Socket Unavailable Resilience**: Non-existent socket fails gracefully without uncaught exceptions (`PASS`).
8. **Producer Disconnect & Auto-Reconnect**: When producer closes connection, consumer automatically reconnects via bounded backoff (`PASS`).

### 4.3. Monorepo Regression Verification

- **Total Test Files**: 55 passed (100%)
- **Total Tests**: 413 passed (100%)
- **TypeScript Compilation**: `tsc -b` exits with code 0 across all 7 packages.

---

## 5. Deliverables & Files Summary

### Files Created:

1. `packages/core/src/sidecar/types.ts`
2. `packages/core/src/sidecar/frame-decoder.ts`
3. `packages/core/src/sidecar/protocol-validator.ts`
4. `packages/core/src/sidecar/event-sequencer.ts`
5. `packages/core/src/sidecar/read-model.ts`
6. `packages/core/src/sidecar/ipc-client.ts`
7. `packages/core/src/sidecar/sidecar-consumer.ts`
8. `packages/core/src/sidecar/index.ts`
9. `apps/cli/src/commands/sidecar.ts`
10. `packages/core/src/tests/sidecar-frame-decoder.test.ts`
11. `packages/core/src/tests/sidecar-protocol-validator.test.ts`
12. `packages/core/src/tests/sidecar-event-sequencer.test.ts`
13. `packages/core/src/tests/sidecar-read-model.test.ts`
14. `packages/core/src/tests/sidecar-ipc-consumer.test.ts`
15. `apps/cli/src/tests/sidecar-command.test.ts`
16. `docs/audits/M05_1_SIDECAR_CONSUMER_REPORT.md`

### Files Modified:

1. `packages/adapters/src/agents/antigravity/state-store.ts`
2. `packages/adapters/src/agents/antigravity/mapper.ts`
3. `packages/adapters/src/tests/antigravity-adapter.test.ts`
4. `packages/core/src/index.ts`
5. `apps/cli/src/commands/index.ts`
6. `apps/cli/src/program.ts`

---

## 6. Next Steps & Transition to M05.2

With Milestone M05.1 completed and verified:

- **Consumer State Foundation**: Complete, fully tested, and resilient.
- **Protocol v1.0.0 Compliance**: 100% verified.
- **M05.2 Objective**: Implement the full terminal presentation layer using Ink + React + Yoga, providing live sidecar UI rendering (task tree, tool execution status, verification badges, progress bars, and diagnostics) attached to this state consumer foundation.
