# AOE Project Progress & Milestone Tracker

| Milestone | Title                        | Target Scope                                                                         | Status        | Evidence / Verification           |
| :-------- | :--------------------------- | :----------------------------------------------------------------------------------- | :------------ | :-------------------------------- |
| **M00**   | **Repository Foundation**    | Workspace setup, TS, Vitest, ESLint, Prettier, package boundaries, docs              | **Completed** | Commit `e925d97`                  |
| **M01**   | **AOE Skill**                | Standalone instruction system, native fallback, hierarchy, tables, error formatting  | **Completed** | Commit `abe5d7d`                  |
| **M02**   | **Universal Event Protocol** | Versioned JSONL event schemas, envelopes, Zod validation                             | **Completed** | Commit `35974e9`                  |
| **M03**   | **Core Engine**              | Event stream processing, session manager, state machine, lifecycle                   | **Completed** | Commit `d783235`                  |
| **M04**   | **Terminal Renderer**        | Ink components, terminal screen manager, alternate screen buffer                     | **Completed** | Commit `dfa757f`                  |
| **M05**   | **Theme Engine**             | Theme registry, Obsidian dark, light, high-contrast, custom tokens, resolver         | **Completed** | 208 tests passing across monorepo |
| **M06**   | **Agent Integration**        | Adapters for Codex, Claude Code, Gemini CLI, OpenCode, generic stream                | **Completed** | 251 tests passing across monorepo |
| **M07**   | **CLI Tooling**              | `aoe` commands (`render`, `pipe`, `theme`, `doctor`, `skill`)                        | **Completed** | Commit `8f90872`                  |
| **M08**   | **Release Readiness**        | Hardening, packaging, clean installation, benchmark, security testing, OSS readiness | **Completed** | 323 tests passing across monorepo |

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

- **Goal**: Build a versioned, validated, serializable event protocol (`@zyanx04/protocol`) enabling external AI coding agents and tools to communicate structured execution telemetry to AOE Engine.
- **Status**: Completed (Commit `35974e9`).
- **Deliverables**: 12 canonical event schemas, Zod validation, JSONL streaming parser with buffer reassembly, deterministic serialization, protocol documentation.

### M03: Core Engine

- **Goal**: Implement stateful execution engine (`@zyanx04/core`) converting protocol events into reliable, atomic state snapshots, managing sessions, task trees, progress integrity, and subscriptions.
- **Status**: Completed (Commit `d783235`).
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

### M04: Terminal Renderer

- **Goal**: Transform immutable `SessionSnapshot` updates into structured, terminal UI presentation components (`@zyanx04/components`) and an orchestrator (`@zyanx04/renderer`) supporting both interactive TTY and static stream modes.
- **Status**: Completed.
- **Deliverables**:
  - `packages/components/src/`:
    - `StatusIndicator.tsx`: Semantic status presentation (`running`, `completed`, `failed`, `blocked`, `warning`, `idle`, `cancelled`) with animated and static modes, plus ASCII fallbacks.
    - `ProgressBar.tsx`: Determinate and indeterminate progress, mathematical division-by-zero protection, `~45% (est)` estimated vs verified distinctions.
    - `Panel.tsx`: Reusable content containers with titles, metadata, and minimal border styles.
    - `TaskSummary.tsx`: Hierarchical task tree with depth indentations, durations, and task count metrics.
    - `FileChangeView.tsx`: File action badges (`+ CREATED`, `~ MODIFIED`, `- DELETED`, `-> RENAMED`), line deltas, path compaction, verified disk evidence.
    - `DiagnosticsPanel.tsx`: Grouped by severity, hypothesis tagging (`[HYPOTHESIS]`), location, root cause, and remediation.
    - `ExecutionLog.tsx`: Bounded tail-buffered log entries, log level badges, secret masking (`Bearer`, `sk-...`, `AKIA...`, `password=`), and ANSI sanitization.
    - `ResultView.tsx`: Category cards (`artifact`, `metric`, `summary`, `test_results`) with structured details.
    - `Table.tsx`: Minimal tabular presentation component.
    - `utils/sanitize.ts`: Credential masking, ANSI stripping, duration formatting, path truncation.
    - `utils/theme-resolver.ts`: Color token resolution, NO_COLOR fallback, Unicode/ASCII symbol mapping.
  - `packages/renderer/src/`:
    - `environment.ts`: TTY detection, CI detection, `NO_COLOR` / `FORCE_COLOR` handling, color depth, clamped terminal dimensions.
    - `static-renderer.ts`: Linear non-interactive stream formatter for CI, pipes, and headless redirects.
    - `interactive-app.tsx`: Ink React tree consuming `SessionSnapshot` to render composite terminal UI.
    - `terminal-renderer.ts`: Orchestrator managing mode auto-detection, engine subscription, resize (`SIGWINCH`), and termination cleanup (`SIGINT`, `SIGTERM`).
  - `docs/architecture/`:
    - `terminal-renderer.md`: Orchestrator architecture, API, and lifecycle.
    - `component-system.md`: Component specifications, data contracts, and props.
  - `docs/development/`:
    - `terminal-compatibility.md`: TTY/non-TTY matrix, accessibility, NO_COLOR, dimensions.
  - Comprehensive unit and integration test suites: 171 passing tests across monorepo (56 new tests for M04).
- **Verification**: 100% test pass rate, clean TypeScript build, clean linting, clean formatting.

### M05: Theme Engine

- **Goal**: Implement a complete, extensible semantic Theme Engine (`@zyanx04/themes`) decoupled from presentation components, providing design tokens, built-in themes, capability resolution, runtime theme switching, and deep immutability.
- **Status**: Completed.
- **Deliverables**:
  - `packages/themes/src/`:
    - `contracts.ts`: Zod schemas and TypeScript types for `ColorValueSchema`, `ThemeColorsSchema` (16 semantic palette tokens), `ThemeStatusColorsSchema` (7 lifecycle states), `ThemeTypographySchema`, `ThemeSpacingSchema`, `SymbolPairSchema`, `ThemeSymbolsSchema`, `ThemeTokensSchema`, and `AoeThemeSchema` with legacy backward-compatibility aliases.
    - `errors.ts`: Typed error hierarchy (`ThemeError`, `ThemeValidationError`, `ThemeNotFoundError`, `DuplicateThemeError`).
    - `validator.ts`: Pure schema validation, deep-freeze immutability (`deepFreeze`), deep clone, and legacy flat token normalization.
    - `builtin/`: Three production-ready built-in themes:
      - `obsidian.ts`: Default dark theme (`id: 'obsidian'`, cyan/magenta brand accents).
      - `light.ts`: Accessible off-white theme (`id: 'light'`, dark blue/teal accents).
      - `high-contrast.ts`: High-contrast dark theme (`id: 'high-contrast'`, pure white foreground, vivid ANSI colors).
    - `registry.ts`: `ThemeRegistry` with registration validation, duplicate protection, deterministic retrieval, listing, and default theme management.
    - `resolver.ts`: Capability-aware token resolution supporting `NO_COLOR`, `FORCE_COLOR`, color depth, and Unicode vs ASCII symbol fallback.
  - `packages/components/src/`:
    - `theme-context.tsx`: `ThemeProvider` context and `useTheme` hook with obsidian fallback.
    - Component refactoring: All 9 presentation components (`StatusIndicator`, `ProgressBar`, `Panel`, `TaskSummary`, `FileChangeView`, `DiagnosticsPanel`, `ExecutionLog`, `ResultView`, `Table`) refactored to consume semantic tokens via `useTheme()` and props.
  - `packages/renderer/src/`:
    - `terminal-renderer.ts`: Updated to accept theme ID strings or `AoeTheme` objects; added `setTheme(...)` for runtime theme switching with immediate re-render and invalid theme fallback.
    - `interactive-app.tsx`: Wrapped root layout in `<ThemeProvider>`.
    - `static-renderer.ts`: Added `setTheme(...)` and semantic token support.
  - `docs/architecture/`:
    - `theme-engine.md`: Theme engine architecture, boundaries, contracts, and lifecycle.
    - `design-tokens.md`: Complete specification of color, status, typography, spacing, and symbol tokens.
  - `docs/development/`:
    - `custom-themes.md`: Step-by-step developer guide for defining, validating, and registering custom themes.
  - Comprehensive unit and integration test suites: 208 passing tests across monorepo (37 new tests for M05 across themes, components, and renderer).
- **Verification**: 100% test pass rate, clean TypeScript build, clean linting, clean formatting.

### M06: Universal Agent Integration

- **Goal**: Implement universal adapter architecture in `@zyanx04/adapters` connecting external AI coding agents (Claude Code, Gemini CLI, Generic JSONL) to AOE, normalizing proprietary hooks and streams into canonical `@zyanx04/protocol` envelopes while enforcing strict privacy and isolation.
- **Status**: Completed.
- **Deliverables**:
  - `packages/adapters/src/`:
    - `contracts/`:
      - `adapter.ts`: `AgentAdapter`, `AdapterLifecycleState`, legacy `AgentKind` / `SUPPORTED_AGENTS`.
      - `context.ts`: `AdapterContext`, `DetectionConfidence`, `AdapterDetectionResult`.
      - `session.ts`: `AdapterSession`, `DefaultAdapterSession`, `createAdapterSession` factory with monotonic sequence and task mapping.
    - `errors/index.ts`: Typed domain error hierarchy (`AdapterError`, `AdapterNotFoundError`, `DuplicateAdapterError`, `AdapterParsingError`, `AdapterValidationError`, `AdapterSessionError`).
    - `utils/sanitizer.ts`: `maskSecrets` (Bearer, Anthropic `sk-...`, Google `AIza...`, AWS, passwords), `stripPrivateReasoning` (`<thought>`, `<scratchpad>`, `<antThinking>`), `sanitizeAgentText`, `sanitizePayload`.
    - `generic/`:
      - `jsonl-parser.ts`: Streaming chunk parser with line buffering, 1MB bounded line size, CRLF handling, and `flush()`.
      - `jsonl-adapter.ts`: Stream adapter supporting both direct canonical protocol envelopes and generic event structures.
    - `agents/claude-code/`:
      - `schema.ts`: Zod schemas for Claude Code hook payloads and stream-JSON events.
      - `mapper.ts`: `ClaudeCodeMapper` mapping hooks (`SessionStart`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`) to canonical events.
      - `adapter.ts`: `ClaudeCodeAdapter` with detection heuristics and payload normalization.
    - `agents/gemini-cli/`:
      - `schema.ts`: Zod schemas for Gemini CLI hook payloads and stream-JSON events.
      - `mapper.ts`: `GeminiCliMapper` mapping hooks (`SessionStart`, `BeforeAgent`, `BeforeTool`, `AfterTool`) to canonical events.
      - `adapter.ts`: `GeminiCliAdapter` with detection heuristics and payload normalization.
    - `manager/adapter-manager.ts`: `AdapterManager` with adapter registration, confidence cascade detection, session lifecycle tracking, event routing, listener exception isolation, and teardown cleanup.
  - `docs/architecture/`:
    - `agent-integration.md`: Universal adapter architecture, lifecycle, contracts, and privacy guarantees.
  - `docs/integrations/`:
    - `agent-compatibility.md`: Compatibility matrix across Claude Code, Gemini CLI, Generic JSONL, and candidate agents.
    - `generic-jsonl.md`: Specification, streaming line buffering, limits, and payload formats.
  - `docs/development/`:
    - `creating-an-adapter.md`: Step-by-step developer guide for creating and testing custom agent adapters.
  - Comprehensive unit and integration test suites: 251 passing tests across monorepo (43 new tests added for M06 across manager, claude-code, gemini-cli, jsonl, and end-to-end adapter-to-engine-to-renderer pipelines).
- **Verification**: 100% test pass rate, clean TypeScript build, clean linting, clean formatting.

### M07: CLI Tooling & Runtime Integration

- **Goal**: Implement the official standalone `aoe` CLI executable in `apps/cli`, wiring streaming input readers, user configuration, `@zyanx04/adapters`, `@zyanx04/protocol`, `@zyanx04/core`, and `@zyanx04/renderer` into five production-ready command suites.
- **Status**: Completed.
- **Deliverables**:
  - `apps/cli/src/`:
    - `commands/`:
      - `render.ts`: Canonical AOE JSONL streaming renderer from stdin with EOF partial-chunk handling, schema validation, and exit code 3 on protocol error.
      - `pipe.ts`: Universal agent ingestion pipeline supporting Claude Code, Gemini CLI, Generic JSONL, and confidence-based auto-detection.
      - `theme.ts`: Presentation theme manager (`list`, `show <name>`, `current`, `set <name>`) with atomic configuration persistence.
      - `doctor.ts`: Diagnostic engine performing real checks across Node.js runtime, CLI version, configuration, themes, adapters, terminal capabilities, and skill files.
      - `skill.ts`: Direct inspector for portable AOE Skill definition (`show`, `path`).
    - `config/`:
      - `config-schema.ts`: Zod schema for `AoeConfig` with default fallback.
      - `config-path.ts`: Platform-appropriate configuration resolver (Linux XDG, macOS, Windows, `AOE_CONFIG_PATH`).
      - `config-loader.ts`: Safe configuration reader with malformed JSON protection.
      - `config-writer.ts`: Atomic configuration saver with temporary file swap.
    - `runtime/`:
      - `exit-codes.ts`: Deterministic exit code registry (0..6, 130, 143).
      - `stdin-reader.ts`: Async streaming chunk reader with 50 MB bounded memory limit.
      - `signal-handler.ts`: Graceful SIGINT/SIGTERM shutdown coordinator.
      - `execution-pipeline.ts`: Coordinator connecting Engine, Session, and TerminalRenderer / StaticRenderer.
    - `utils/`:
      - `errors.ts`: Standardized `CliError` and actionable stderr formatting.
      - `logger.ts`: Diagnostic logger for stderr output.
      - `skill-path.ts`: Multi-candidate resolver for `skills/aoe/SKILL.md`.
    - `program.ts`: Commander application assembly and error boundary.
    - `bin.ts`: Executable entrypoint (`#!/usr/bin/env node`).
  - `docs/architecture/`:
    - `cli-runtime.md`: Architectural pipeline, execution flow, signal handling, and exit codes.
  - `docs/development/`:
    - `cli-usage.md`: Complete CLI usage guide and command reference.
    - `configuration.md`: Configuration schema, paths, atomic updates, and security principles.
  - `docs/integrations/`:
    - `cli-integration.md`: Integration guide for Claude Code, Gemini CLI, UNIX pipes, and CI/CD pipelines.
  - Test suite: 47 test files, 303 passing tests across the monorepo (10 test files and 53 tests in `apps/cli` including real subprocess execution tests).
- **Verification**: 100% test pass rate, clean TypeScript build, clean typecheck, clean linting (0 errors, 0 warnings), clean formatting.

### M08: Production Hardening, Packaging & Release Readiness

- **Goal**: Harden production security, verify streaming and memory boundaries, package distributable npm tarballs, establish performance baselines, complete open-source documentation, and ensure clean installation readiness.
- **Status**: Completed.
- **Deliverables**:
  - **Security & Sanitization**:
    - Defense-in-depth terminal text sanitization stripping OSC, DCS, APC, PM, and dangerous CSI sequences while preserving valid SGR styling.
    - Trojan Source Unicode bidirectional override suppression (`U+202A`–`U+202E`, `U+2066`–`U+2069`).
    - Expanded credential masking (Bearer, OpenAI, Anthropic, Google AI, AWS, GitHub PATs, Slack, PEM private keys).
    - Private reasoning suppression (`<thought>`, `<scratchpad>`, `<antThinking>`, `<internal_reasoning>`).
  - **Input & Memory Bounds**:
    - Per-record size validation in `parseEventStream` (default 5MB) preventing buffer bloat.
    - Total stream ceiling (50MB) in `readStreamChunks`.
  - **CLI Diagnostic JSON**:
    - Machine-readable `--json` flag on `aoe doctor` emitting pure JSON to stdout and diagnostics to stderr.
  - **Packaging & Clean Installation**:
    - Package metadata (`files`, `license`, `repository`, `engines`, `keywords`) configured across all monorepo packages.
    - Automatic packaging of `skills/aoe` into `@zyanx04/cli` package tarball.
    - Verified clean installation from packed tarballs in fresh external directory executing all CLI commands.
  - **Performance Baseline**:
    - Reproducible benchmark script (`scripts/benchmark.js` / `pnpm benchmark`).
    - Recorded baseline metrics for CLI startup time, JSONL parsing throughput, Core Engine ingestion rate, StaticRenderer throughput, and memory delta.
  - **Open Source Readiness**:
    - `README.md`, `LICENSE` (MIT), `CHANGELOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`.
    - `.github/ISSUE_TEMPLATE/bug_report.md`, `feature_request.md`, `PULL_REQUEST_TEMPLATE.md`.
    - `.github/workflows/ci.yml` and `release.yml`.
  - **Test Suite**: 48 test files, 323 passing tests across the monorepo (including dedicated security and subprocess tests).
- **Verification**: 100% test pass rate, clean TypeScript build, clean typecheck, clean linting (0 errors, 0 warnings), clean formatting, clean installation verified.
