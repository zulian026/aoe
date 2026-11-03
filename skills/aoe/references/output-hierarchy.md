# Output Hierarchy Reference

## Purpose

The AOE Output Hierarchy establishes an information flow for AI coding agents communicating via terminal or CLI environments. By enforcing a standard tier structure, agents present complex technical workflows clearly, enabling users to understand the task, assess current state, review evidence, and decide next actions without cognitive overload.

---

## Rules

1. **Strict Tier Sequence**: Output must flow in 6 structured tiers:
   - **Tier 1: Task Identity**: Clear, concise title identifying the active task or objective.
   - **Tier 2: Current Status**: Unambiguous status indicator using AOE semantic states (`RUNNING`, `COMPLETED`, `FAILED`, etc.).
   - **Tier 3: Important Findings**: Critical discoveries, architectural blockers, breaking changes, or key technical takeaways.
   - **Tier 4: Execution Details**: Evidence of actions taken (commands run with exit codes, file modifications, test suites).
   - **Tier 5: Results & Artifacts**: Measurable deliverables, test outcomes, generated assets, or benchmark numbers.
   - **Tier 6: Next Actions**: Actionable next steps or recommendations for the user or subsequent agent turns.
2. **Proportional Visual Economy**: The depth of presentation must scale with task complexity. Trivial tasks (e.g., reading a file or answering a single question) must not produce multi-page structured reports. Omit empty tiers when they add no information.
3. **No Decorative Noise**: Avoid ASCII banners, redundant horizontal rules, emoji spam, or multi-nested bullet points.
4. **Findings Precede Details**: Users must never need to scroll through raw logs or verbose command output to discover whether a task succeeded or what broke.
5. **Separation of Concerns**: Keep operational logs separated from strategic conclusions and next recommendations.

---

## Formatting Conventions

### Full Structure (Complex / Multi-Step Tasks)

```markdown
# [Task Identity]

**Status**: `[STATUS]` — [One-line status explanation]

## Key Findings

- [High-priority finding or confirmed fact]
- [Architectural observation or constraint discovered]

## Execution Details

- [Action 1: description and link to file/test]
- [Action 2: command executed with exit status]

## Results

- [Verified deliverable or passing test metric]

## Next Actions

1. [Immediate follow-up task]
2. [Optional exploration or user decision point]
```

### Compact Structure (Single-Step / Simple Tasks)

```markdown
**[Task Identity]** — `[STATUS]`
[Direct, concise answer or verification result with file links]
```

---

## Good Examples

### Good Example 1: Full Hierarchy for Refactoring Task

```markdown
# Database Connection Pooling Refactor

**Status**: `COMPLETED` — Connection pooling configured and verified with integration tests.

## Key Findings

- Prior implementation leaked connections under high concurrency due to missing pool release hooks in error handlers.
- Connection limits have been tuned to max 20 connections per worker process.

## Execution Details

- Updated connection lifecycle in `src/db/pool.ts` to enforce `finally` release blocks.
- Added connection timeout threshold of 5,000ms.
- Executed integration test suite: `pnpm test:integration` (exit code 0).

## Results

- 12/12 integration tests passed in 1.4s.
- Zero connection leaks observed across 500 simulated concurrent requests.

## Next Actions

1. Deploy migration to staging environment.
2. Monitor connection pool metrics under staging load.
```

### Good Example 2: Compact Hierarchy for Quick Bugfix

```markdown
**Fix Null Pointer in User Profile** — `COMPLETED`
Added optional chaining to `user.address?.zipCode` in `src/models/user.ts#L42`. Verified with unit test `pnpm test src/models/user.test.ts` (1 passed, exit code 0).
```

---

## Bad Examples

### Bad Example 1: Inverted Hierarchy & Verbose Clutter

```markdown
<!-- BAD: Dumps huge command logs before stating status, findings, or task goal -->

==================================================

> > > RUNNING TESTS NOW PLEASE WAIT...
> > > \==================================================
> > > $ vitest run src/auth.test.ts
> > > ✓ Auth test 1
> > > ✓ Auth test 2
> > > ✓ Auth test 3
> > > Total time: 234ms
> > > All good!

Oh by the way, I worked on the authentication middleware task and it is completed. I think we should test it on staging now.
```

_Why this is bad_: Forces the user to parse raw command logs before learning what was attempted, what was found, or whether the overall task succeeded.

### Bad Example 2: Missing Actionable Next Steps & Vague Status

```markdown
<!-- BAD: Missing semantic status, vague findings, no concrete next actions -->

### Refactoring

Done with some changes. Found some weird bugs in the code.

- Changed some files
- Ran a test
  Everything looks fine. Let me know what you want me to do next.
```

_Why this is bad_: Does not identify files modified, hides test specifics, provides vague findings, and abdicates technical leadership.

---

## Edge Cases

1. **Zero Changes Made (Exploration / Read-Only Task)**:
   - When a task only investigates code without making modifications, omit Tier 4 (Execution Details) or describe inspected files, and focus Tier 3 on findings and Tier 6 on recommended changes.
2. **Immediate Blocker Encountered (Early Termination)**:
   - When a blocker halts execution at step 1, status transitions immediately to `BLOCKED` or `FAILED`. Tier 3 highlights the root cause, Tier 4 shows the failing command/error, Tier 5 is omitted, and Tier 6 provides remediation steps.
3. **Conversational Queries (No Code Changes)**:
   - Format response directly with concise technical facts, omitting formal multi-heading scaffolding while maintaining the logical flow: Identity -> Conclusion -> Supporting Evidence.
