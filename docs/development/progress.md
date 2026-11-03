# AOE Project Progress & Milestone Tracker

| Milestone | Title                        | Target Scope                                                                        | Status        | Evidence / Verification          |
| :-------- | :--------------------------- | :---------------------------------------------------------------------------------- | :------------ | :------------------------------- |
| **M00**   | **Repository Foundation**    | Workspace setup, TS, Vitest, ESLint, Prettier, package boundaries, docs             | **Completed** | Commit `e925d97`                 |
| **M01**   | **AOE Skill**                | Standalone instruction system, native fallback, hierarchy, tables, error formatting | **Completed** | 56 tests passing across monorepo |
| **M02**   | **Universal Event Protocol** | Versioned JSONL event schemas, envelopes, Zod validation                            | Pending       | Recommended next milestone       |
| **M03**   | **Core Engine**              | Event stream processing, session manager, state machine, lifecycle                  | Pending       | Blocked on M02                   |
| **M04**   | **Terminal Renderer**        | Ink components, terminal screen manager, alternate screen buffer                    | Pending       | Blocked on M03                   |
| **M05**   | **Theme Engine**             | Theme registry, Obsidian dark, light theme, custom tokens                           | Pending       | Blocked on M04                   |
| **M06**   | **Agent Integration**        | Adapters for Codex, Claude Code, Gemini CLI, OpenCode, generic stream               | Pending       | Blocked on M05                   |
| **M07**   | **CLI Tooling**              | `aoe` commands (`render`, `pipe`, `theme`, `doctor`, `skill`)                       | Pending       | Blocked on M06                   |
| **M08**   | **Release Preparation**      | Packaging, end-to-end verification, performance profiling, release                  | Pending       | Blocked on M07                   |

---

## Detailed Milestone Log

### M00: Repository Foundation

- **Goal**: Initialize repository, establish workspace structure, configure tooling, define architecture and standards.
- **Status**: Completed (Commit `e925d97`).
- **Artifacts**: Root configs, TypeScript project references, 6 packages + CLI app scaffold, initial test suites.

### M01: AOE Skill System

- **Goal**: Transform `skills/aoe/SKILL.md` into a production-grade, portable AI coding agent instruction system with complete reference specifications and realistic examples.
- **Status**: Completed.
- **Deliverables**:
  - `skills/aoe/SKILL.md`: Concise, directive-oriented entrypoint with valid frontmatter, invariants, 6-tier hierarchy, semantic status table, progress rules, safe capability detection, and catalog links.
  - `skills/aoe/references/`:
    - `output-hierarchy.md`: 6-tier information model, proportional density, good/bad examples, edge cases.
    - `status-system.md`: 7 canonical semantic states, verification before completion invariant, transition matrix.
    - `progress-reporting.md`: Deterministic progress, mathematical fractions vs checklists, zero hallucinated percentages.
    - `file-changes.md`: Standardized tables (`CREATED`, `MODIFIED`, `DELETED`, `RENAMED`), line deltas, evidence rule.
    - `command-output.md`: Explicit syntax, exit codes, segregated stderr, intelligent truncation, secret masking.
    - `diagnostics.md`: Severity tiers (`ERROR`, `WARNING`, `INFO`), confirmed facts vs hypotheses, root causes, remediations.
    - `visual-formatting.md`: GFM layout, compact tables, callouts, Unicode with ASCII fallback, terminal width rules.
    - `engine-integration.md`: Safe capability detection (`AOE_ACTIVE=1`), no automatic installations, silent native markdown fallback.
  - `skills/aoe/examples/`:
    - `task-in-progress.md`: Active multi-milestone task with checklist progress.
    - `task-completed.md`: Verified implementation with passing unit tests, file deltas, and clean status.
    - `task-failed.md`: Blocked task with non-zero exit code, segregated stderr, and actionable remediation.
    - `code-review.md`: Structured audit with severity-ranked findings and positive highlights.
    - `implementation-report.md`: Multi-file feature summary with test metrics and verification evidence.
    - `debugging-session.md`: Hypothesis elimination table, confirmed root cause, and regression verification.
  - `packages/core/src/skill-validation.test.ts`: Automated 46-test validation suite checking frontmatter, section structure, reference existence, example validity, link integrity, status uniformity, deterministic progress, and privacy rules.
- **Verification**: 8 test suites passed (56/56 tests), TypeScript compilation clean, ESLint clean, Prettier format clean.
