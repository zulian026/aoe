# AOE Project Progress & Milestone Tracker

| Milestone | Title                        | Target Scope                                                                        | Status        | Evidence / Verification          |
| :-------- | :--------------------------- | :---------------------------------------------------------------------------------- | :------------ | :------------------------------- |
| **M00**   | **Repository Foundation**    | Workspace setup, TS, Vitest, ESLint, Prettier, package boundaries, docs             | **Completed** | Commit `e925d97`                 |
| **M01**   | **AOE Skill**                | Standalone instruction system, native fallback, hierarchy, tables, error formatting | **Completed** | Commit `abe5d7d`                 |
| **M02**   | **Universal Event Protocol** | Versioned JSONL event schemas, envelopes, Zod validation                            | **Completed** | 94 tests passing across monorepo |
| **M03**   | **Core Engine**              | Event stream processing, session manager, state machine, lifecycle                  | Pending       | Recommended next milestone       |
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
- **Status**: Completed (Commit `abe5d7d`).
- **Deliverables**: Portable `SKILL.md`, 8 reference specifications, 6 complete examples, automated skill validation suite.

### M02: Universal Event Protocol

- **Goal**: Build a versioned, validated, serializable event protocol (`@aoe/protocol`) enabling external AI coding agents and tools to communicate structured execution telemetry to AOE Engine.
- **Status**: Completed.
- **Deliverables**:
  - `packages/protocol/src/constants.ts`: Protocol name (`aoe`), version (`1.0.0`), canonical event types, statuses, actions, severities.
  - `packages/protocol/src/envelope.ts`: `BaseEnvelopeSchema` (`protocolVersion`, `eventId`, `sessionId`, `sequence`, `timestamp`).
  - `packages/protocol/src/events/`:
    - `session.ts`: `session.started`, `session.ended` schemas and types.
    - `task.ts`: `task.started`, `task.updated`, `task.completed`, `task.failed` schemas and types.
    - `progress.ts`: `progress.updated` schema enforcing progress integrity rules.
    - `log.ts`: `log.emitted` schema with level, stream, source metadata.
    - `file.ts`: `file.changed` schema (`CREATED`, `MODIFIED`, `DELETED`, `RENAMED`), line deltas, evidence requirements.
    - `diagnostic.ts`: `diagnostic.emitted` schema, hypothesis flag, precise locations, remediations.
    - `result.ts`: `result.produced` schema (`artifact`, `metric`, `summary`, `test_results`).
    - `error.ts`: `error.occurred` schema (`fatal`, `recoverable`).
    - `index.ts`: Discriminated union `AoeEventSchema` and `AoeEvent` type.
  - `packages/protocol/src/serialization.ts`: Deterministic JSONL serialization (`serializeEvent`), strict parsing (`parseEvent`, `safeParseEvent`), in-memory validation (`validateEvent`), and chunked stream parsing with buffer reassembly (`parseEventStream`).
  - `packages/protocol/src/helpers.ts`: Event builder (`createEvent`), ID generators (`createEventId`, `createSessionId`, `createTaskId`), `calculateProgressPercentage`, and `isTerminalEvent`.
  - `docs/protocol/`:
    - `protocol-specification.md`: Envelope structure, constraints, valid/invalid envelope examples.
    - `event-catalog.md`: Comprehensive reference for all 12 events with valid and invalid JSON examples.
    - `lifecycle-rules.md`: Session & task state machines, sequence monotonicity, timestamp rules, deduplication.
    - `serialization.md`: JSONL wire format, deterministic key sorting, streaming chunk reassembly, error codes.
  - Comprehensive unit test suites (41 tests in `@aoe/protocol`, 94 tests across monorepo).
- **Verification**: 13 test suites passed (94/94 tests), TypeScript build clean, typecheck clean, ESLint clean, Prettier format clean.
