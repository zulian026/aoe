# Progress Reporting Reference

## Purpose

The AOE Progress Reporting Reference defines rules for conveying task progression truthfully and deterministically. AI coding agents must never hallucinate execution progress, fabricate completion metrics, or spam terminal output with synthetic updates. Progress must directly reflect verified, observable work.

---

## Rules

1. **Zero Hallucinated Percentages**: Never fabricate percentages or output arbitrary percentage numbers (e.g. `45%`, `72%`) unless mathematically calculated from a finite, deterministic denominator (e.g., `4 of 8 test suites completed = 50%`). If work cannot be strictly enumerated, use checklist or milestone progress.
2. **Never Invent Completed Work**: Every completed item in a progress report must reference actual files created, tests executed, or verified commands. Never check off a subtask that was not actually executed.
3. **Distinguish Estimated vs. Verified Progress**:
   - **Verified**: Confirmed by tool output, test exit code 0, or file system verification.
   - **In Progress**: Tool call currently executing or actively running.
   - **Pending**: Planned next step, not yet executed.
4. **Milestone / Checklist Preference**: Use markdown task lists (`- [x]`, `- [/]`, `- [ ]`) to track multi-phase workflows.
5. **Update Cadence & Anti-Spam**: Do not emit progress updates after every trivial line of thought. Emit updates only when:
   - A phase or milestone starts.
   - A phase or milestone finishes.
   - A blocker or unexpected failure occurs.

---

## Formatting Conventions

### Checklist Progress Table or List

```markdown
### Execution Progress

- [x] **Phase 1: Database Migration**: Created schema and ran migrations (verified exit code 0)
- [/] **Phase 2: Repository Layer**: Implementing repository queries (in progress)
- [ ] **Phase 3: Service Layer & Unit Tests**: Pending
- [ ] **Phase 4: Verification & Linting**: Pending
```

### Discrete Count Progress (When Denominator is Known)

```markdown
**Progress**: 3/7 test suites completed (42%)

- [x] Auth tests (`src/auth.test.ts`)
- [x] Session tests (`src/session.test.ts`)
- [x] Token tests (`src/token.test.ts`)
- [/] User repository tests (`src/user.test.ts` — executing)
- [ ] Profile tests
- [ ] Billing tests
- [ ] Notification tests
```

---

## Good Examples

### Good Example 1: Verifiable Multi-Step Checklist

```markdown
### Progress (3/5 Milestones Verified)

- [x] **Schema Definition**: Added `refreshToken` column to `users` table (`src/schema.sql`).
- [x] **Token Generator**: Implemented cryptographically secure token helper (`src/auth/tokens.ts`).
- [x] **Unit Testing**: 6/6 tests passing for token generation and expiry (`pnpm test:unit tokens`).
- [/] **Middleware Integration**: Updating session validation middleware (`src/middleware/auth.ts`).
- [ ] **End-to-End Validation**: Pending integration test suite run.
```

### Good Example 2: Mathematical Progress Bar for Batch Operations

```markdown
**Migrating Assets**: [██████████░░░░░░░░░░] 50% (5/10 files processed)

- Verified: `logo.svg`, `icon-1.png`, `icon-2.png`, `hero.jpg`, `banner.png`
- Pending: `avatar-1.jpg`, `avatar-2.jpg`, `footer.svg`, `badge.png`, `spinner.svg`
```

---

## Bad Examples

### Bad Example 1: Fabricated Progress Percentage

```markdown
<!-- BAD: Arbitrary percentage with zero mathematical foundation -->

Working on the backend refactor... Progress: 68% complete.
Everything is moving along smoothly!
```

_Why this is bad_: The number `68%` is fabricated out of thin air. It provides no verifiable information and misleads the user.

### Bad Example 2: Premature Checkmarks

```markdown
<!-- BAD: Checking off tasks before running verification -->

- [x] Write authentication logic
- [x] Fix security vulnerability
- [x] Make sure all tests pass (haven't run them yet, but code looks good)
```

_Why this is bad_: Claims verification before running the actual test suite.

---

## Edge Cases

1. **Unknown Total Steps**:
   - When debugging an open-ended issue where the total number of steps is unknown, do not guess a total. Use an event log or sequential discovery list:
     - `Step 1 (Done): Inspected stack trace`
     - `Step 2 (Done): Reproduced failure with minimal test case`
     - `Step 3 (Active): Isolating race condition in lock manager`
2. **Dynamic Step Discovery**:
   - If investigation reveals 3 additional steps are necessary, update the milestone list transparently and state why the scope expanded.
3. **Long-Running Commands**:
   - When running a long build or test command (>30s), state that the command is active and provide its expected scope rather than fabricating intermediate synthetic percent counters.
