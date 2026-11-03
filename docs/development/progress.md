# AOE Project Progress & Milestone Tracker

| Milestone | Title                        | Target Scope                                                                        | Status        | Evidence / Verification           |
| :-------- | :--------------------------- | :---------------------------------------------------------------------------------- | :------------ | :-------------------------------- |
| **M00**   | **Repository Foundation**    | Workspace setup, TS, Vitest, ESLint, Prettier, package boundaries, docs             | **Completed** | Commit `e925d97`                  |
| **M01**   | **AOE Skill**                | Standalone instruction system, native fallback, hierarchy, tables, error formatting | **Completed** | Commit `abe5d7d`                  |
| **M02**   | **Universal Event Protocol** | Versioned JSONL event schemas, envelopes, Zod validation                            | **Completed** | Commit `35974e9`                  |
| **M03**   | **Core Engine**              | Event stream processing, session manager, state machine, lifecycle                  | **Completed** | 120 tests passing across monorepo |
| **M04**   | **Terminal Renderer**        | Ink components, terminal screen manager, alternate screen buffer                    | Pending       | Recommended next milestone        |
| **M05**   | **Theme Engine**             | Theme registry, Obsidian dark, light theme, custom tokens                           | Pending       | Blocked on M04                    |
| **M06**   | **Agent Integration**        | Adapters for Codex, Claude Code, Gemini CLI, OpenCode, generic stream               | Pending       | Blocked on M05                    |
| **M07**   | **CLI Tooling**              | `aoe` commands (`render`, `pipe`, `theme`, `doctor`, `skill`)                       | Pending       | Blocked on M06                    |
| **M08**   | **Release Preparation**      | Packaging, end-to-end verification, performance profiling, release                  | Pending       | Blocked on M07                    |

---

## Detailed Milestone Log

### M00: Repository Foundation

- **Goal**: Initialize repository, establish workspace structure, configure tooling, define architecture and standards.
- **Status**: Completed (Commit `e925d97`).
- **Artifacts**: Root configs, TypeScript project references, 6 packages + CLI app scaffold, initial test suites.

### M01: AOE Skill System

- **Goal**: Transform `skills/aoe/SKILL.md` into a production-grade, portable AI coding agent instruction system with complete reference specifications and realistic examples.
- **Status**: Completed (Commit `abe5d7d`).
- **Deliverables**: Portable `SKILL.md`, 8 reference specifications, 6 complete examples, automated skill validation suite.

### M02: Universal Event Protocol

- **Goal**: Build a versioned, validated, serializable event protocol (`@aoe/protocol`) enabling external AI coding agents and tools to communicate structured execution telemetry to AOE Engine.
- **Status**: Completed (Commit `35974e9`).
- **Deliverables**: 12 canonical event schemas, Zod validation, JSONL streaming parser with buffer reassembly, deterministic serialization, protocol documentation.

### M03: Core Engine

- **Goal**: Implement stateful execution engine (`@aoe/core`) converting protocol events into reliable, atomic state snapshots, managing sessions, task trees, progress integrity, and subscriptions.
- **Status**: Completed.
- **Deliverables**:
  - `packages/core/src/session-manager.ts`: Concurrent session containers, lifecycle transitions.
  - `packages/core/src/sequence-tracker.ts`: Monotonic sequence checking, gap detection, bounded out-of-order buffering and automatic drain.
  - `packages/core/src/deduplication.ts`: Content-hashing event deduplication and conflicting ID detection.
  - `packages/core/src/lifecycle-manager.ts`: Transition tables for sessions and tasks; terminal status barriers.
  - `packages/core/src/task-manager.ts`: Hierarchical task tree, depth calculation, cycle detection, missing parent validation.
  - `packages/core/src/progress-tracker.ts`: Mathematical progress validation, estimated vs verified tracking, aggregate derivations.
  - `packages/core/src/event-store.ts`: In-memory bounded event storage (default 10,000 events) with FIFO eviction.
  - `packages/core/src/state-dispatcher.ts`: Subscriber notification bus with listener exception isolation.
  - `packages/core/src/event-processor.ts`: Atomic 9-stage transactional processing pipeline with zero partial mutations.
  - `packages/core/src/engine.ts`: Public Engine facade with full lifecycle methods and M00 backward compatibility.
  - `packages/core/src/errors.ts`: Typed domain error classes for all failure modes.
  - `packages/core/src/types.ts`: Read-only snapshot contracts and processing result types.
  - `docs/architecture/`:
    - `core-engine.md`: Engine architecture and module decomposition.
    - `state-management.md`: Snapshot models, immutability guarantees, state machines.
    - `event-processing.md`: Transactional pipeline, atomicity, sequence recovery.
  - Comprehensive unit test suites (69 tests in `@aoe/core`, 120 tests across monorepo).
- **Verification**: 100% test pass rate, clean TypeScript build, clean linting, clean formatting.
