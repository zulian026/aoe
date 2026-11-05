# Changelog

All notable changes to the AOE (Agent Output Enhancement) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.2] - 2026-11-05

### Added

- **Hybrid Bundled CLI Architecture (Strategy D)**:
  - Bundled internal workspace packages (`@zyanx04/protocol`, `@zyanx04/themes`, `@zyanx04/core`, `@zyanx04/components`, `@zyanx04/adapters`, `@zyanx04/renderer`) into `@zyanx04/cli` distribution via `tsup 9.0.0`.
  - External runtime dependencies strictly constrained to native Node/Ink ecosystem (`ink`, `react`, `yoga-layout`, `commander`, `zod`).
  - Tarball compressed footprint optimized to 88 KB across 23 packaged files.
- **Terminal Sidecar Presentation Layer**:
  - Independent sidecar process (`aoe sidecar`) powered by Ink and Yoga Layout.
  - Live session header, current task panel, activity timeline, verification audit, and system diagnostics panels.
  - Bidirectional IPC server and client communication modes over Unix domain socket / named pipe.
- **Antigravity Hook Bridge & Stateful Session Store**:
  - Stateful session tracking with atomic file locking and POSIX `0o600` permissions.
  - Real-environment verified Antigravity adapter translating agent lifecycle hooks to canonical AOE Protocol v1.0.0.
  - Safe Windows named pipe path discovery and fallback.
- **Clean-Install Verification Harness**:
  - Comprehensive 7-phase validation script (`scripts/verify-clean-install.sh`) validating tarball extraction, zero-symlink execution, CLI commands, protocol stdin piping, and sidecar IPC communication.

### Changed

- **Release Workflow Hardening**:
  - Upgraded release CI workflow to Node.js 22.x LTS and pinned `npm@11.21.2` for full OIDC Trusted Publishing compatibility.
  - Made npm OIDC Trusted Publishing the explicit primary publication mechanism (`id-token: write`, provenance attestation).
  - Pre-publication barrier: artifact packing, checksum generation (`SHA256SUMS`), and clean-install verification occur prior to npm publication.

### Security

- **Supply Chain Security Remediation**:
  - Remediated High severity Zod advisory `GHSA-mrhx-c7xc-m3w5` across all workspace packages by upgrading Zod to `^4.6.7` with explicit two-argument `z.record(z.string(), z.unknown())` schemas.
  - Production vulnerability audit verified at 0 known vulnerabilities (`pnpm audit --prod`).

---

## [0.1.1] - 2026-11-04

### Changed

- **npm Distribution Namespace**: Migrated distribution package namespace from `@aoe/*` to `@zyanx04/*` (`@zyanx04/protocol`, `@zyanx04/themes`, `@zyanx04/core`, `@zyanx04/components`, `@zyanx04/adapters`, `@zyanx04/renderer`, `@zyanx04/cli`).
- Product identity (`AOE — Agent Output Enhancement`), CLI binary name (`aoe`), environment variables (`AOE_*`), and Universal Protocol identifier (`aoe`) remain strictly preserved.

### Fixed

- **Cross-Platform CI Portability**: Resolved Windows CRLF frontmatter parsing in `skill-validation.test.ts` and normalized path separator assertions in `skill-command.test.ts`.

---

## [0.1.0] - 2026-11-03

### Initial Public Release

AOE (Agent Output Enhancement) is an agent-agnostic terminal presentation and output enhancement system for AI coding agents running in CLI environments.

> **Tagline:** Better output. Clearer workflows. Consistent agent experiences.

### Project Overview & Milestone Architecture

This initial release represents the culmination of milestones M00 through M08:

- **M00: Foundation & Toolchain**: Monorepo structure, pnpm workspaces, TypeScript composite project references, Vitest, ESLint, and Prettier setup.
- **M01: Standalone Skill System**: Zero-dependency portable skill (`skills/aoe/SKILL.md`) with output hierarchy, visual formatting, status markers, and native Markdown fallback.
- **M02: Universal Event Protocol**: Canonical event schema definitions (`@aoe/protocol` v1.0.0) with Zod validation, deterministic key sorting, and streaming JSONL serialization.
- **M03: Core Engine**: Ingestion engine (`@aoe/core`), session management, sequence tracking, deduplication, task hierarchies, progress aggregation, and immutable session snapshots.
- **M04: Terminal Renderer**: Hybrid renderer (`@aoe/renderer`) supporting Ink 8 / React 19 interactive TTY rendering, linear `StaticRenderer` for non-TTY/CI pipes, and graceful degradation.
- **M05: Theme Engine**: Semantic design tokens, color resolution (`@aoe/themes`), contrast validation, and built-in themes (`obsidian`, `light`, `high-contrast`).
- **M06: Universal Agent Integrations**: Normalized adapters (`@aoe/adapters`) for Claude Code, Gemini CLI, and generic JSONL event streams.
- **M07: CLI Tooling & Runtime**: Command-line binary (`aoe`) implementing `render`, `pipe`, `theme`, `doctor`, and `skill` with atomic configuration persistence.
- **M08: Hardening & Packaging**: Production readiness, defense-in-depth sanitization, Trojan Source Unicode filtering, clean installation packaging, cross-platform matrix, and performance baselines.

### Added Features

- **Executable CLI (`aoe`)**:
  - `aoe render`: Ingests canonical AOE JSONL events from `stdin` and renders live interactive or static output.
  - `aoe pipe`: Universal agent ingestion gateway supporting automatic detection, `--agent claude-code`, `--agent gemini-cli`, and `--agent generic-jsonl`.
  - `aoe theme`: Theme management (`list`, `show <name>`, `current`, `set <name>`).
  - `aoe doctor`: Comprehensive system diagnostic suite with `--json` machine-readable output option.
  - `aoe skill`: Inspects portable skill content (`show`) or resolves local filesystem location (`path`).
- **Terminal UI Components (`@aoe/components`)**:
  - `ProgressBar`: Smooth Unicode/ASCII animated progress rendering.
  - `StatusIndicator`: Consistent status symbols and spinners.
  - `TaskSummary`: Hierarchical tree presentation with branch connectors and depth clamping.
  - `FileChangeView`: File modification list with disk verification evidence badges and deltas.
  - `DiagnosticsPanel`: Sorted error, warning, and info messages with hypothesis markers and remediation advice.
  - `ExecutionLog`: Tail of execution events with timestamp and level tags.
  - `ResultView`: Final outcome panel with metrics and artifact links.
- **Atomic Configuration System**:
  - Platform-compliant configuration storage (`$XDG_CONFIG_HOME`, `~/.config/aoe`, `%APPDATA%\aoe`, `~/Library/Application Support/aoe`, or `$AOE_CONFIG_PATH`).
  - Temp-file-and-rename atomic writes preventing corrupt state during unexpected terminations.
- **Graceful Signal Handling**:
  - Restores terminal cursor (`\x1b[?25h`), leaves alternate screen (`\x1b[?1049l`), and resets terminal raw mode on `SIGINT` (exit code 130) and `SIGTERM` (exit code 143).

### Security & Privacy Protections

- **Terminal Escape Sanitization**: Strips dangerous OSC sequences (title, clipboard manipulation), DCS/APC/PM escapes, and cursor repositioning CSI sequences while preserving legitimate styling.
- **Trojan Source Protection**: Filters Unicode bidirectional override characters (`U+202A` - `U+202E`, `U+2066` - `U+2069`) to prevent visual source spoofing.
- **Secret & Credential Masking**: Automatically masks Bearer tokens, OpenAI/Anthropic API keys (`sk-...`), Google AI keys (`AIza...`), AWS credentials (`AKIA...`), GitHub PATs (`ghp_...`, `github_pat_...`), Slack tokens (`xox...`), and private key blocks.
- **Private Thought Suppression**: Strips internal reasoning tags (`<thought>`, `<scratchpad>`, `<antThinking>`, `<internal_reasoning>`) to keep chain-of-thought private.
- **Bounded Input & Memory Limits**: Enforces 1MB/5MB per-record length limit and 50MB default stream ceiling to prevent memory exhaustion attacks.
- **Process Safety**: Zero shell executions from event data; zero automatic modifications to agent config files.

### Breaking Changes

- Initial release; establishes baseline API and protocol specification v1.0.0.

### Known Limitations

- Ink-based interactive rendering requires a true TTY terminal; non-TTY environments automatically fall back to static text streaming.
- Dynamic terminal window resizing during rapid event streaming may cause brief visual artifacts on certain terminal emulators.
- Regular expression secret masking is a heuristic defense-in-depth layer and cannot guarantee detection of arbitrary custom secret formats.
