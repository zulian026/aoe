# M04.2 — Stateful Antigravity Hook Infrastructure & Reliability Hardening Report

**Date**: 2026-11-04  
**Project**: AOE (Agent Output Enhancement)  
**Workspace**: `~/Projects/aoe`  
**Baseline Commit**: `40059e99cfef8edf277273e19c4bd3e0b1957c73`  
**Auditor**: Antigravity Assistant (AI Pair Programmer)  
**Status**: COMPLETED — VERIFIED ACROSS MULTI-PROCESS EXECUTION

---

## 1. Executive Summary

Milestone M04.2 resolves all architectural deficiencies, multi-process race conditions, state amnesia, and false-positive vulnerabilities identified in the **M04.1 Real Environment Integration Verification Report** (`M04_1_ANTIGRAVITY_REAL_ENVIRONMENT_VERIFICATION.md`).

Because Antigravity executes each hook as an independent, ephemeral child shell process (`sh -c "aoe bridge ..."`), in-memory state cannot survive between lifecycle hooks. In M04.2, AOE introduces the **Stateful Session Authority (`AntigravitySessionStore`)**, backed by atomic file locking (`O_CREAT | O_EXCL`) and atomic state persistence (`.tmp.${pid}.${timestamp}` + `rename`), providing monotonic sequence allocation, cross-process task mapping, and a structured, task-bound verification evidence engine without requiring a standing daemon process.

### Final Verification Classification: `VERIFIED`

| Verification Target                                      | M04.1 Status                          | M04.2 Status      | Verification Evidence                                                                        |
| -------------------------------------------------------- | ------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| **Monotonic Event Sequencing Across Discrete Processes** | `FAILED` (reset to 0)                 | `VERIFIED`        | 5 discrete subprocesses produced sequences 0..7 without reset or collision.                  |
| **Cross-Process Task Continuity**                        | `FAILED` (lost on exit)               | `VERIFIED`        | Active task and task mapping persistent across distinct hook subprocesses.                   |
| **Verification Evidence Integrity**                      | `FAILED` (in-memory boolean)          | `VERIFIED`        | Structured `VerificationEvidence` bound to specific task IDs with runner validation.         |
| **Anti-False-Positive Test Protection**                  | `FAILED` (vulnerable to `mkdir test`) | `VERIFIED`        | Strictly rejected `mkdir test`, `cat test.txt`, `echo test`; prevented completion.           |
| **Explicit Hook Event Identification**                   | `FAILED` (guessed from payload)       | `VERIFIED`        | Required `--event <Name>`; rejected ambiguous and unknown events with `AdapterParsingError`. |
| **UNIX Domain Socket Path Ceiling**                      | `FAILED` (risk of POSIX overflow)     | `VERIFIED`        | Deterministic SHA-256 truncation guaranteed path length <= 96 bytes.                         |
| **Subprocess Stream Drainage & Clean Exit**              | `NOT_VERIFIED`                        | `VERIFIED`        | Stdout flushed before resolution; diagnostics isolated strictly to stderr.                   |
| **Workspace Regression Integrity**                       | 355 tests passing                     | 371 tests passing | 49 test suites passed 100% with zero regressions across all 7 packages.                      |

---

## 2. Architectural Transformation: Before vs. After

### Before (M04 / M04.1 Stateless Lifecycle Dissociation)

```
[Antigravity Turn]
      │
      ├──> Hook 1: SessionStart ──> [node aoe bridge] ──> Session (seq: 0) ──> Process Dies
      │
      ├──> Hook 2: PreInvocation ──> [node aoe bridge] ──> Session (seq: 0 [RESET]) ──> Process Dies
      │
      ├──> Hook 3: PostToolUse  ──> [node aoe bridge] ──> tests_verified=true ──> Process Dies
      │                                                     (State Lost!)
      └──> Hook 4: Stop         ──> [node aoe bridge] ──> tests_verified=undefined
                                                             (Task Incomplete / Failure)
```

**Flaws**:

- Monotonic sequence violated: each hook spawned a new `AdapterSession` with sequence starting at 0.
- State amnesia: tool outcomes recorded in one process disappeared when the child process terminated.
- Fragile inference: heuristic payload inspection misclassified `PostToolUse` without errors as `PreToolUse`.

### After (M04.2 Stateful Session Authority Architecture)

```
[Antigravity Turn]
      │
      ├──> Hook 1: SessionStart  ──> [node aoe bridge]
      │                                     │ (acquire lock)
      │                                     ▼
      ├──> Hook 2: PreInvocation ──> [AntigravitySessionStore]
      │                                     │  • Monotonic Sequence (0 -> 1 -> 2 -> ...)
      │                                     │  • Active Task ID Tracking
      ├──> Hook 3: PostToolUse  ──>         │  • Task-Bound Verification Evidence
      │    (vitest / pnpm test)             │  • Event Deduplication Signatures
      │                                     │  • Atomic JSON + Safe Lock Eviction
      └──> Hook 4: Stop         ──>         ▼
           (NO_TOOL_CALL)             [UNIX Domain Socket] (bounded <= 96 bytes)
                                            │
                                            ▼
                                      [AOE Receiver / Pipe]
```

---

## 3. Stateful Authority: `AntigravitySessionStore`

Implemented in `packages/adapters/src/agents/antigravity/state-store.ts`.

### 3.1 Persistence Contract

Each Antigravity session is identified by its canonical `conversationId`. The store persists session state to:

- State File: `${SESSION_DIR}/aoe-state-${safeId}.json`
- Lock File: `${SESSION_DIR}/aoe-state-${safeId}.lock`

Directory resolution priority:

1. `AOE_SESSION_DIR` (environment override for isolation in tests and containers)
2. `XDG_RUNTIME_DIR` (POSIX memory-backed `/run/user/<uid>`, ensuring high throughput and automatic cleanup)
3. `/tmp` fallback

### 3.2 Atomic Locking & Concurrency Control

- **Lock Acquisition**: Uses `fs.openSync(lockPath, 'wx')` (`O_CREAT | O_EXCL`) to guarantee mutual exclusion across concurrent hook subprocesses.
- **Stale Lock Eviction**: If a previous process was killed unexpectedly (`SIGKILL`), locks older than 5,000ms are safely evicted.
- **Atomic State Writes**: State is serialized to a PID-tagged temporary file (`${statePath}.tmp.${pid}.${Date.now()}`) and renamed atomically over the destination file.
- **Safe Session ID Sanitization**: All session identifiers are stripped of path traversal characters (`/`, `\`, `..`) and replaced with `_`. Empty or whitespace IDs fall back to `'default'`. If the resulting string exceeds 32 bytes, it is deterministically hashed with SHA-256.

---

## 4. Monotonic Sequencing Across Discrete Subprocesses

Sequence numbers must be monotonically increasing and strictly unique across the entire lifecycle of a conversation.

1. `AntigravitySessionStore.allocateSequencesSync(count)` acquires the session lock, reads the current state, increments `currentSequence` by `count`, writes back the state atomically, and returns the allocated sequence array.
2. In `AntigravityMapper.mapEvent`, all events allocate sequences from the store:
   ```typescript
   private allocateSequence(session: AdapterSession, store?: AntigravitySessionStore): number {
     if (store) {
       const allocated = store.allocateSequencesSync(1);
       return allocated[0];
     }
     return session.nextSequence();
   }
   ```
3. Multi-event hooks (such as `PostToolUse` emitting both `file.changed`, `log.emitted`, and `progress.updated`, or `Stop` emitting `task.completed` and `session.ended`) allocate contiguous, non-overlapping sequences atomically.
4. **Verification**: Multi-process execution verified that discrete process invocations generated sequential sequence numbers:
   - Process 1 (`SessionStart`): `sequence 0`
   - Process 2 (`PreInvocation`): `sequence 1`
   - Process 3 (`PreToolUse`): `sequence 2`, `sequence 3`
   - Process 4 (`PostToolUse`): `sequence 4`, `sequence 5`
   - Process 5 (`Stop`): `sequence 6`, `sequence 7`

---

## 5. Verification Evidence Model & Anti-False-Positive Protections

Implemented in `packages/adapters/src/agents/antigravity/evidence.ts`.

### 5.1 Rejection of Naive Boolean Flags

M04.1 identified that a boolean `session.metadata['tests_verified']` could be spoofed by any command containing the substring `"test"`. In M04.2, this is completely replaced with structured `VerificationEvidence`:

```typescript
export interface VerificationEvidence {
  command: string;
  exitCode: number;
  timestamp: string;
  taskId: string;
  passed: boolean;
  runnerName?: string;
  sourceEventId?: string;
}
```

### 5.2 Strict Test Runner Classification

`identifyTestRunner(commandLine)` employs strict matching rules:

1. **Explicit Non-Test Utilities Blocklist**: Immediately rejects utilities even if their arguments include `"test"`, including:
   `mkdir`, `rmdir`, `rm`, `touch`, `cat`, `head`, `tail`, `more`, `less`, `nano`, `vim`, `echo`, `printf`, `ls`, `dir`, `find`, `grep`, `sed`, `awk`, `git`, `cd`, `pwd`, `cp`, `mv`, `chmod`, `chown`.
2. **Package Manager Test Invocations**: Matches `npm`, `pnpm`, `yarn`, `bun` executing `test` / `t` while rejecting package manager subcommands like `install test`, `add test`, `remove test`.
3. **Dedicated Test Frameworks**: Matches `vitest`, `jest`, `pytest`, `cargo test`, `go test`, `dotnet test`, `ctest`, `mvn test`, `gradlew test`.

### 5.3 Task-Bound Evidence Invariant

- Verification evidence is strictly bound to the `taskId` of the active turn.
- When Turn 1 runs `pnpm test` and passes, Turn 1 is verified.
- When Turn 2 begins with a new `PreInvocation`, Turn 2 creates a new `taskId`.
- Stop on Turn 2 will **NOT** complete if Turn 2 did not produce its own passing verification evidence, preventing historical evidence leakage.

---

## 6. Explicit Hook Identification & Parsing Safety

### 6.1 Requirement for Explicit Hook Name

In `apps/cli/src/commands/bridge.ts` and `AntigravityMapper`, heuristic guessing of event names from payload structure has been eliminated:

- Hook commands MUST specify `--event <EventName>`.
- Payloads may also include `hookEventName` / `hook_event_name`.
- Any hook call lacking an event name or specifying an unallowed event immediately throws `AdapterParsingError` with the allowed event names:
  `SessionStart`, `PreInvocation`, `PreToolUse`, `PostToolUse`, `Stop`.

### 6.2 Disambiguation of `PostToolUse`

In M04.1, a successful `PostToolUse` without an error field had identical structure to `PreToolUse`, causing incorrect progress resets. With explicit event enforcement, `PostToolUse` is always mapped to tool completion, progress update, file change detection, and verification evidence evaluation.

---

## 7. UNIX Domain Socket Portability & Bounds

Implemented in `packages/adapters/src/agents/antigravity/ipc-transport.ts`.

### 7.1 POSIX Socket Byte Limits

POSIX specifies `sockaddr_un.sun_path` length limits:

- Linux: 108 bytes
- macOS / BSD: 104 bytes

Antigravity UUIDs (e.g. `f01aa833-4c56-4d85-bcee-3909147eaa15`) combined with runtime paths (`/run/user/1000/`) could exceed this ceiling.

### 7.2 Deterministic SHA-256 Truncation

`resolveSocketPath(sessionId)` guarantees a maximum path length of **96 bytes**:

1. Base runtime directory resolved (`XDG_RUNTIME_DIR`, `/tmp`, or `os.tmpdir()`).
2. Candidate filename formatted: `aoe-${safeId}.sock`.
3. If total byte length exceeds 96 bytes:
   ```typescript
   const hash = crypto.createHash('sha256').update(clean).digest('hex').slice(0, 16);
   return path.join(dir, `aoe-${hash}.sock`);
   ```
4. Tested with 128-character conversation IDs: strictly remained <= 96 bytes.

---

## 8. Process Lifecycle, Stream Drainage, and Stderr Isolation

In `apps/cli/src/commands/bridge.ts` and `runHookBridge`:

1. **Stdout Drainage**: Ensured `stdoutStream.write()` completes via a promise before process termination:
   ```typescript
   await new Promise<void>((resolve) => {
     stdoutStream.write(`${responseJson}\n`, 'utf-8', () => resolve());
   });
   ```
2. **Stream Cleanup**: In `readStdin`, event listeners (`data`, `end`, `error`) are explicitly removed upon completion or timeout, preventing hanging event loops.
3. **Stderr Isolation**: Diagnostic logs and warnings (`[aoe-bridge]`) are written strictly to `stderr`. Antigravity's required control JSON (`{"decision":"allow"}`, `{}`, etc.) is written exclusively to `stdout`.
4. **Crash Immunity**: If an unhandled error occurs, `aoe bridge` catches it, writes the error to `stderr`, emits a valid fallback response (`{}`) to `stdout`, and sets `process.exitCode = 0`, ensuring Antigravity is never blocked or aborted.

---

## 9. Security Audit & Invariants

1. **Path Traversal**: Sanitization replaces `/`, `\`, and relative specifiers (`..`) with `_`. State and socket paths are bounded to designated runtime directories.
2. **Command Injection**: `identifyTestRunner` and `evaluateVerificationEvidence` inspect command strings via regular expressions without invoking shell execution or subshells.
3. **Secret Redaction**: `sanitizeAgentText` redacts Google API keys (`AIza...`), OpenAI/Anthropic keys (`sk-...`, `sk-ant-...`), GitHub tokens (`ghp_...`), Bearer tokens, and internal reasoning tags (`<thought>...</thought>`).
4. **Data Isolation**: Each conversation maintains an isolated state file (`aoe-state-${safeId}.json`). Tests verified that operations in Conversation A produce zero side-effects in Conversation B.

---

## 10. Test Matrix & Multi-Process Verification Evidence

### 10.1 Unit & Integration Suite (`vitest`)

Full workspace test run executed via `pnpm test`:

- **Total Test Files**: 49 passed / 49 (100%)
- **Total Tests**: 371 passed / 371 (100%)
- **Duration**: 43.64s

Antigravity Adapter & Bridge Suite (`antigravity-adapter.test.ts`):

- **Total Tests**: 34 passed / 34 (100%)
- **Coverage**:
  - `SessionStart`, `PreInvocation`, `PreToolUse`, `PostToolUse`, `Stop` normalization: PASS
  - Monotonic sequence allocation across discrete hook stores: PASS
  - Concurrent sequence allocation (10 concurrent workers, 20 unique sequences): PASS
  - State persistence and restart recovery: PASS
  - Duplicate hook event signature deduplication: PASS
  - Strict session isolation: PASS
  - `identifyTestRunner` recognition & rejection of false-positive utilities: PASS
  - `evaluateVerificationEvidence` generation: PASS
  - Prevention of task completion on `mkdir test`: PASS
  - Task completion on verified test runner success: PASS
  - Task isolation of verification evidence across turns: PASS
  - Prevention of task completion on test failure: PASS
  - Disambiguation of `PostToolUse` without error: PASS
  - Rejection of missing/unknown hook events: PASS
  - POSIX socket path ceiling under 96 bytes: PASS
  - Stream drainage and stderr diagnostics isolation: PASS

### 10.2 Real Multi-Process Subprocess Verification

Executed using compiled binary `node apps/cli/dist/bin.js bridge`:

```
Process 1 (SessionStart)  -> stdout: {"injectSteps":[]}
Process 2 (PreInvocation) -> stdout: {"injectSteps":[],"terminationBehavior":""}
Process 3 (PreToolUse)    -> stdout: {"decision":"allow"}
Process 4 (PostToolUse)   -> stdout: {}
Process 5 (Stop)          -> stdout: {"decision":""}

State file: aoe-state-multi-proc-test-1793786772625.json
Final sequence: 7 (strictly monotonic 0..7 across 5 independent processes)
Verification evidence count: 1
Processed event signatures: 5
Active task ID: turn_1
Status: MULTI_PROCESS_VERIFICATION_SUCCESS
```

### 10.3 Anti-False-Positive Subprocess Verification

Executed with `run_command: mkdir test`:

```
1. SessionStart -> OK
2. PreInvocation -> Task turn_1 started
3. PostToolUse (mkdir test) -> Processed
4. Stop (NO_TOOL_CALL) -> Evaluated

Verification evidence count: 0
Task completed emitted: NO (emitted task.updated with status: warning)
Status: ANTI_FALSE_POSITIVE_VERIFIED
```

---

## 11. Residual Limitations & Next Steps

1. **Daemonless State Model**: M04.2 intentionally implements a lightweight atomic file-based authority without requiring a standing daemon process. If an IPC consumer (like `aoe render` or a future sidecar) is listening on the socket, events are forwarded instantly (<150ms). If no consumer is listening, the bridge completes safely with non-blocking fallback.
2. **Next Milestone (M05)**:
   - Dynamic real-time terminal UI integration / sidecar receiver consuming the Antigravity IPC socket stream.
   - Live progress indicator rendered during active Antigravity tool invocations.
   - Packaging and global distribution validation.
