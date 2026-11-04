# AOE v0.1.0 — Initial Public Release Notes

**Release Version:** `0.1.0`  
**Protocol Version:** `1.0.0`  
**Release Tag:** `v0.1.0`  
**Date:** 2026-11-04  
**License:** MIT

> **Better output. Clearer workflows. Consistent agent experiences.**

---

## 1. Overview

AOE (Agent Output Enhancement) is an agent-agnostic terminal presentation and output enhancement system for AI coding agents operating in CLI environments.

Modern AI coding agents (such as Claude Code, Gemini CLI, and custom agent harnesses) coordinate complex multi-step tasks across compilation, file modifications, test executions, and diagnostics. However, standard terminal output is often cluttered, difficult to parse visually, and vulnerable to leaking private chain-of-thought reasoning or sensitive API credentials.

AOE solves this problem through a two-part hybrid architecture:

1. **AOE Skill (`skills/aoe/SKILL.md`)**: A standalone, zero-dependency Markdown instruction skill that guides agents to emit structured, readable terminal output independently of any software installation.
2. **AOE Engine & CLI (`aoe`)**: A high-performance presentation engine built on Ink 8 and React 19 that consumes canonical JSONL events or raw agent hooks, validates state, and renders responsive terminal UI.

---

## 2. Key Capabilities

- **Hybrid Dual-Mode Rendering**:
  - **Interactive TTY Mode**: Fluid, animated Ink-powered layout with status spinners, live progress bars, collapsible task hierarchies, and color-coded status badges.
  - **Static Plain Text Mode**: Line-buffered linear output without screen-clearing escapes, purpose-built for CI runners, piped outputs, and non-interactive logs.
- **Universal Event Protocol (v1.0.0)**:
  - Versioned, validated event envelope and canonical schemas powered by Zod.
  - Deterministic key ordering and streaming JSONL parsing with record byte limits.
- **Built-in Security & Privacy**:
  - **Terminal Escape Injection Defense**: Sanitizes dangerous OSC (window/clipboard) and CSI (cursor/screen) escape codes while safely preserving standard SGR colors.
  - **Trojan Source Protection**: Filters Unicode bidirectional override characters (`U+202A`–`U+202E`, `U+2066`–`U+2069`).
  - **Secret Redaction**: Automatically masks Bearer tokens, OpenAI/Anthropic keys (`sk-...`), Google AI keys (`AIza...`), AWS credentials (`AKIA...`), GitHub PATs (`ghp_...`, `github_pat_...`), and PEM private keys.
  - **Private Thought Suppression**: Purges agent chain-of-thought tags (`<thought>`, `<scratchpad>`, `<antThinking>`, `<internal_reasoning>`) and reasoning payload fields.
- **Stateful Engine & Deduplication**:
  - Out-of-order sequence tracking with bounded buffer limits.
  - Session lifecycle enforcement (`active`, `completed`, `failed`, `cancelled`).
  - Hierarchical task trees and verified disk evidence tracking.
- **Extensible Themes**:
  - Semantic design tokens with WCAG contrast ratio compliance.
  - Three built-in themes: `obsidian` (default dark), `light` (paper light), and `high-contrast` (accessibility).
- **Atomic Configuration**:
  - OS-compliant configuration persistence (`$XDG_CONFIG_HOME`, `~/.config/aoe`, `%APPDATA%\aoe`, or `~/Library/Application Support/aoe`) using temp-and-rename atomic swaps.

---

## 3. Architecture

AOE follows a strict, layered Directed Acyclic Graph (DAG) architecture:

```text
                     AI Coding Agents
            (Claude Code / Gemini CLI / Generic)
                             │
                             ▼
                      @aoe/adapters
                (Format Detection & Mapping)
                             │
                             ▼
                      @aoe/protocol
            (Canonical Event Schema & Validation)
                             │
                             ▼
                        @aoe/core
            (Session State, Tasks, Deduplication)
                             │
                             ▼
                      @aoe/renderer
            (Screen Orchestrator & Mode Selection)
                    │                 │
                    ▼                 ▼
            Interactive TTY     Non-TTY / CI Pipe
            (@aoe/components)    (StaticRenderer)
```

---

## 4. Supported Agent Integrations

| Agent / Input     | Adapter Flag             | Description                                                                                                                        |
| ----------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Claude Code**   | `--agent claude-code`    | Ingests Claude Code CLI telemetry, tool invocations (`PreToolUse`, `PostToolUse`), and hook events (`SessionStart`, `SessionEnd`). |
| **Gemini CLI**    | `--agent gemini-cli`     | Ingests Google Gemini CLI tool execution reports, command lifecycle hooks, and system events.                                      |
| **Generic JSONL** | `--agent generic-jsonl`  | Ingests arbitrary JSONL log streams with flexible field mapping.                                                                   |
| **Auto-Detect**   | `--agent auto` (default) | Automatically inspects stream headers and environment to select the appropriate adapter.                                           |

---

## 5. Installation Instructions

### Requirements

- **Node.js**: `>= 20.0.0`
- **npm** or **pnpm**: `>= 9.0.0`

### Global Installation via npm

```bash
npm install -g @aoe/cli
```

### Local Project Installation

```bash
npm install -D @aoe/cli
# or
pnpm add -D @aoe/cli
```

---

## 6. Quickstart

### Verify Environment & Capabilities

```bash
aoe doctor
```

### Render Canonical Event Stream

```bash
echo '{"protocolVersion":"1.0.0","eventId":"evt-1","sessionId":"demo-1","sequence":1,"timestamp":"2026-11-04T10:00:00Z","eventType":"session.started","payload":{"workingDirectory":"/tmp","agent":{"name":"demo-agent"}}}' | aoe render
```

### Adapt Agent Output

```bash
cat agent_output.jsonl | aoe pipe --agent generic-jsonl
```

### Inspect Themes

```bash
aoe theme list
aoe theme show obsidian
aoe theme set high-contrast
```

---

## 7. Package Distribution List

| Package               | Version | Description                                                                    |
| --------------------- | ------- | ------------------------------------------------------------------------------ |
| **`@aoe/protocol`**   | `0.1.0` | Canonical event protocol schemas, types, and streaming JSONL parser.           |
| **`@aoe/themes`**     | `0.1.0` | Semantic design tokens, theme registry, and contrast validation.               |
| **`@aoe/core`**       | `0.1.0` | State management engine, task trees, session lifecycle, and deduplication.     |
| **`@aoe/components`** | `0.1.0` | Reusable React 19 / Ink 8 terminal UI components with built-in sanitization.   |
| **`@aoe/adapters`**   | `0.1.0` | Ingestion adapters for Claude Code, Gemini CLI, and generic JSONL streams.     |
| **`@aoe/renderer`**   | `0.1.0` | Hybrid rendering engine coordinating interactive Ink and static output modes.  |
| **`@aoe/cli`**        | `0.1.0` | Command-line interface executable (`aoe`) and bundled standalone skill assets. |

---

## 8. Protocol Version

The canonical protocol version is **`1.0.0`**. It defines 12 core event schemas:

- `session.started`, `session.ended`
- `task.started`, `task.updated`, `task.completed`, `task.failed`
- `progress.updated`
- `file.changed`
- `diagnostic.emitted`
- `log.emitted`
- `result.produced`
- `error.occurred`

Full specification: [`docs/protocol/protocol-specification.md`](../protocol/protocol-specification.md).

---

## 9. Platform Compatibility

- **Linux (x86_64)**: Tier 1 (Fully Verified natively with 326 tests).
- **Linux (ARM64)**: Tier 2 (Architecture-neutral ESM; verified in CI matrix).
- **macOS (Apple Silicon & Intel)**: Tier 2 (POSIX compliant; covered via CI matrix `[macos-latest]`).
- **Windows (x64)**: Tier 2 (Path resolution and Win32 config conventions implemented; covered via CI matrix `[windows-latest]`).

---

## 10. Known Limitations

1. **Interactive TTY Requirement**: Ink-powered interactive rendering requires a genuine TTY terminal (`process.stdout.isTTY === true`). Non-TTY environments, dumb terminals (`TERM=dumb`), and CI runners automatically fall back to linear `StaticRenderer`.
2. **Terminal Window Resize**: Rapid terminal resizing during high-frequency event streaming (>5,000 ev/s) may produce temporary visual artifacts on select terminal emulators.
3. **Multi-Package Publication Ordering**: Standalone tarball installation requires all internal `@aoe/*` packages to be published to an npm registry first.

---

## 11. Security Considerations

AOE provides six foundational security guarantees:

1. **Zero Shell Execution**: AOE never executes shell commands or scripts emitted in events.
2. **Zero Agent Config Tampering**: External agent configurations are treated as strictly read-only.
3. **Defense-in-Depth Sanitization**: Text rendered to terminals is filtered for malicious OSC/CSI escapes and unprintable ASCII control characters.
4. **Trojan Source Protection**: Bidi override characters are neutralized.
5. **Secret Redaction**: Bearer tokens, API keys, and private keys are masked with asterisks.
6. **Private Thought Suppression**: Chain-of-thought tags are stripped prior to display.

Full security policy: [`SECURITY.md`](../../SECURITY.md).

---

## 12. Documentation & Resources

- **Website / Repository**: [https://github.com/aoe-dev/aoe](https://github.com/aoe-dev/aoe)
- **Architecture Guide**: [`docs/architecture.md`](../architecture.md)
- **CLI Usage Guide**: [`docs/development/cli-usage.md`](../development/cli-usage.md)
- **Standalone Skill Definition**: [`skills/aoe/SKILL.md`](../../skills/aoe/SKILL.md)
- **Changelog**: [`CHANGELOG.md`](../../CHANGELOG.md)
- **Contributing Guidelines**: [`CONTRIBUTING.md`](../../CONTRIBUTING.md)
