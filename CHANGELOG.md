# Changelog

All notable changes to the AOE (Agent Output Enhancement) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
