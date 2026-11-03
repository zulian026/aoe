---
name: aoe
description: Universal presentation enhancement system for AI coding agents. Enforces structured output hierarchy, reliable progress reporting, and terminal aesthetics with native fallback.
---

# AOE — Agent Output Enhancement

AOE establishes a universal presentation standard for AI coding agents communicating in terminal and CLI environments. It decouples agent reasoning from visual presentation, ensuring structured, honest, and verifiable output.

## 1. Core Invariants

Every agent adhering to AOE must strictly observe these six engineering invariants:

1. **Zero Hallucination**: Never claim work was performed, files were created, or tests passed without verifiable tool execution evidence.
2. **Never Fabricate Progress**: Never fabricate percentages or invent arbitrary percentage numbers (e.g. `68%`) or synthetic milestones. Progress must reflect observable, mathematically grounded metrics or deterministic checklists.
3. **Verify Before Completion**: Never transition status to `COMPLETED` before executing test suites, builds, or verification assertions proving the deliverables work.
4. **Privacy & Reasoning Protection**: Never output, solicit, or expose private internal chain-of-thought, thinking tokens, system prompt internals, or secret credentials.
5. **No Automatic Execution**: Never install dependencies or execute system-altering commands automatically to satisfy presentation requirements.
6. **Portable-First & Standalone**: AOE operates independently of any external engine. When the AOE presentation engine is not present, agents natively format output using standard GitHub-Flavored Markdown (GFM).

---

## 2. Information Hierarchy

Structure all non-trivial agent responses according to the standard 6-tier information hierarchy:

```
Tier 1: Task Identity       ─── Concise, unambiguous title of active task
Tier 2: Current Status      ─── Semantic status badge with one-line explanation
Tier 3: Important Findings  ─── Strategic discoveries, blockers, architectural notes
Tier 4: Execution Details   ─── Commands run (with exit codes), files modified, tests
Tier 5: Results & Deliverables  Measurable deliverables, test counts, benchmarks
Tier 6: Next Actions        ─── Concrete, numbered next steps for developer or agent
```

_For small, single-step tasks (e.g., answering a quick factual question), use the compact structure: `**Task Identity** — [STATUS]: [Direct answer with file references]`._

See details in [output-hierarchy.md](file:///home/zyan/Projects/aoe/skills/aoe/references/output-hierarchy.md).

---

## 3. Semantic Status Lifecycle

Always assign tasks one of the seven canonical semantic states:

| Status      | Usage Condition                                                  | Transition Trigger   |
| :---------- | :--------------------------------------------------------------- | :------------------- |
| `IDLE`      | Task initialized or queued. No active work has begun.            | Agent receives task  |
| `RUNNING`   | Active tool calls, file edits, or tests in progress.             | Execution starts     |
| `COMPLETED` | Deliverables implemented **and verified** with tests/build.      | Verification passes  |
| `FAILED`    | Critical error, test failure, or assertion break halted work.    | Unhandled error      |
| `BLOCKED`   | External dependency, credential, or user clarification required. | Prerequisite missing |
| `CANCELLED` | Execution aborted by user request or strategic termination.      | User aborts          |
| `WARNING`   | Finished successfully but with non-fatal caveats or anomalies.   | Partial success      |

See details in [status-system.md](file:///home/zyan/Projects/aoe/skills/aoe/references/status-system.md).

---

## 4. Operational Presentation Standards

### A. Progress Reporting

- Use milestone checklists (`- [x]` done, `- [/]` in progress, `- [ ]` pending) rather than arbitrary percentages.
- Percentages are permitted only when mathematically derived from an enumerated set (e.g., `3/6 tests = 50%`).
- Avoid repetitive progress spam; emit updates only on milestone boundary transitions.
- See details in [progress-reporting.md](file:///home/zyan/Projects/aoe/skills/aoe/references/progress-reporting.md).

### B. File Modifications

- Explicitly categorize changes: `CREATED`, `MODIFIED`, `DELETED`, or `RENAMED`.
- Include file paths, line deltas (`+lines / -lines`), and functional descriptions.
- Never list a file as modified without file system verification.
- See details in [file-changes.md](file:///home/zyan/Projects/aoe/skills/aoe/references/file-changes.md).

### C. Commands & Execution

- Display the exact command executed and process exit code (`# Exit code: 0`).
- Segregate standard error from standard output.
- Never hide or suppress failure output. Truncate repetitive stdout while preserving error context.
- See details in [command-output.md](file:///home/zyan/Projects/aoe/skills/aoe/references/command-output.md).

### D. Diagnostics & Debugging

- Categorize by severity: `ERROR`, `WARNING`, `INFO`.
- Strictly separate **Confirmed Facts** (proven by logs) from **Hypotheses** (suspicions under test).
- Include file location (`path:line:col`), root cause, and concrete remediation steps.
- See details in [diagnostics.md](file:///home/zyan/Projects/aoe/skills/aoe/references/diagnostics.md).

### E. Visual Density & Layout

- Target 80-to-100 column terminal buffers; avoid wide, overflowing tables.
- Use standard Unicode glyphs (`✓`, `✖`, `▲`, `●`, `○`) with clean ASCII fallbacks (`[v]`, `[x]`, `[!]`).
- See details in [visual-formatting.md](file:///home/zyan/Projects/aoe/skills/aoe/references/visual-formatting.md).

---

## 5. Safe Engine Detection & Fallback

AOE functions autonomously without the engine binary. Follow this non-intrusive capability check:

1. **Check Environment**: If `AOE_ACTIVE=1` or `AOE_SESSION_ID` is present, the agent may output structured protocol events (defined in M02).
2. **Fallback Mode**: If `AOE_ACTIVE` is unset or unavailable, default directly to native terminal Markdown.
3. **Safety Restrictions**:
   - Never run unverified shell commands to search for an engine.
   - Never attempt to install `@aoe/cli` or dependencies automatically.
   - Never break or fail execution if the engine is absent.

See details in [engine-integration.md](file:///home/zyan/Projects/aoe/skills/aoe/references/engine-integration.md).

---

## 6. Reference Documentation

Detailed specifications for each presentation domain:

- [Output Hierarchy Specification](file:///home/zyan/Projects/aoe/skills/aoe/references/output-hierarchy.md)
- [Status System Specification](file:///home/zyan/Projects/aoe/skills/aoe/references/status-system.md)
- [Progress Reporting Specification](file:///home/zyan/Projects/aoe/skills/aoe/references/progress-reporting.md)
- [File Changes Specification](file:///home/zyan/Projects/aoe/skills/aoe/references/file-changes.md)
- [Command Output Specification](file:///home/zyan/Projects/aoe/skills/aoe/references/command-output.md)
- [Diagnostics Specification](file:///home/zyan/Projects/aoe/skills/aoe/references/diagnostics.md)
- [Visual Formatting Specification](file:///home/zyan/Projects/aoe/skills/aoe/references/visual-formatting.md)
- [Engine Integration & Fallback Specification](file:///home/zyan/Projects/aoe/skills/aoe/references/engine-integration.md)

---

## 7. Reference Examples

Real-world output templates conforming to AOE standards:

- [Task In Progress Example](file:///home/zyan/Projects/aoe/skills/aoe/examples/task-in-progress.md)
- [Task Completed Example](file:///home/zyan/Projects/aoe/skills/aoe/examples/task-completed.md)
- [Task Failed Example](file:///home/zyan/Projects/aoe/skills/aoe/examples/task-failed.md)
- [Code Review Example](file:///home/zyan/Projects/aoe/skills/aoe/examples/code-review.md)
- [Implementation Report Example](file:///home/zyan/Projects/aoe/skills/aoe/examples/implementation-report.md)
- [Debugging Session Example](file:///home/zyan/Projects/aoe/skills/aoe/examples/debugging-session.md)
