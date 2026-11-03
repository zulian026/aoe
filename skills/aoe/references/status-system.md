# Status System Reference

## Purpose

The AOE Status System defines an unambiguous state machine for tracking task progression in AI coding agent interactions. By standardizing status nomenclature, agents communicate operational state consistently, preventing premature claims of completion, clarifying blockers, and providing transparent execution monitoring.

---

## Rules

1. **Seven Canonical States**: All tasks must be assigned exactly one of the seven recognized semantic states:
   - `IDLE`: Task is queued, initialized, or awaiting scheduled kickoff. No active work has begun.
   - `RUNNING`: Work is actively in progress. Operations or tool calls are currently executing.
   - `COMPLETED`: All specified deliverables have been implemented and explicitly verified.
   - `FAILED`: An unrecoverable error or assertion failure occurred, halting the task.
   - `BLOCKED`: Progression cannot continue due to an external dependency, missing permission, or prerequisite.
   - `CANCELLED`: Execution was explicitly terminated by user intervention or strategic abort.
   - `WARNING`: Execution finished with non-critical anomalies, degraded performance, or pending caveats.
2. **Verification Before Completion Invariant**: An agent must **never** report `COMPLETED` before running and verifying test suites, lint checks, builds, or explicit output assertions. If code was written but not verified, the status remains `RUNNING` or `WARNING` with an unverified caveat.
3. **State Monotonicity**: A task in `COMPLETED`, `FAILED`, or `CANCELLED` is terminal. Reopening work requires initiating a new task or transitioning back to `RUNNING` with an explicit reason.
4. **Mandatory Explanation**: Status badges must always be accompanied by a brief summary describing the reason for the current state.
5. **No Synthetic States**: Do not invent hybrid states (e.g., `ALMOST_DONE`, `MOSTLY_SUCCESS`, `IN_PROGRESS_TESTING`). Use `RUNNING` with descriptive detail.

---

## Formatting Conventions

### Status Display Format

```markdown
**Status**: `[STATE]` — [Concise one-line rationale or milestone summary]
```

### State Machine Transition Rules

```
       ┌───────────┐
       │   IDLE    │
       └─────┬─────┘
             │ (start)
             ▼
       ┌───────────┐
   ┌──►│  RUNNING  ├─────────────┐
   │   └──┬───┬───┬┘             │
   │      │   │   │              │
   │(fix) │   │   └────────┐     │
   │      │   ▼ (block)    │     ▼ (cancel)
   │      │ ┌─────────┐    │   ┌───────────┐
   │      │ │ BLOCKED │    │   │ CANCELLED │
   │      │ └────┬────┘    │   └───────────┘
   │      │      │ (unblock)
   │      │      ▼         │
   │      │   RUNNING      │
   │      │                │
   │      ▼ (fail)         ▼ (verify ok)
   │   ┌────────┐     ┌───────────┐
   └───┤ FAILED │     │ COMPLETED │
       └────────┘     └─────┬─────┘
                            │ (caveats)
                            ▼
                      ┌───────────┐
                      │  WARNING  │
                      └───────────┘
```

---

## Good Examples

### Good Example 1: Verifiable Completion

```markdown
**Status**: `COMPLETED` — All 18 unit tests passed and TypeScript compilation succeeded without errors.
```

### Good Example 2: Blocked by External Dependency

```markdown
**Status**: `BLOCKED` — Staging database credentials in `.env.staging` are missing required permissions for table migrations.
```

### Good Example 3: Completion with Warnings

```markdown
**Status**: `WARNING` — Core parser refactored successfully, but 2 legacy deprecation warnings remain in upstream dependencies.
```

---

## Bad Examples

### Bad Example 1: Premature Completion Without Evidence

```markdown
<!-- BAD: Marking completed without executing tests or compilation check -->

**Status**: `COMPLETED` — I finished updating the authentication logic. It should work perfectly now!
```

_Why this is bad_: Violates the verification invariant. Code was written, but no test, build, or runtime execution proved it works.

### Bad Example 2: Fabricated or Non-Standard State

```markdown
<!-- BAD: Invented non-standard status name -->

**Status**: `ALMOST_COMPLETED (95%)` — Just need to run the linter and we are good.
```

_Why this is bad_: Violates canonical state naming. The task is still `RUNNING`.

---

## Edge Cases

1. **Partial Success in Multi-Part Tasks**:
   - If 3 of 4 subtasks succeeded but 1 failed, report `FAILED` if the primary deliverable is incomplete, or `WARNING` if the primary goal is functional but secondary items were skipped. Document exact subtask statuses in execution details.
2. **User Abort via Interruption**:
   - When the user presses `Ctrl+C` or issues an abort instruction, cleanly transition state to `CANCELLED` and record all partial changes made up to the cancellation point.
3. **Flaky Test Failures**:
   - If tests fail intermittently due to environmental race conditions, report `FAILED` with diagnostic notes explaining the flaky test investigation; never silently retry and claim unblemished `COMPLETED`.
