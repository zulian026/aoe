# AOE (Agent Output Enhancement)

[![CI](https://github.com/aoe-dev/aoe/actions/workflows/ci.yml/badge.svg)](https://github.com/aoe-dev/aoe/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node: >=20](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)

> **Better output. Clearer workflows. Consistent agent experiences.**

AOE is an agent-agnostic terminal presentation and output enhancement system for AI coding agents operating in CLI environments.

---

## 1. The Problem

AI coding agents (e.g. Claude Code, Gemini CLI, Cursor, and custom CLI agents) execute complex tasks—editing files, running compilers, diagnosing errors, and orchestrating multi-step plans. However:

- Agent terminal outputs are often inconsistent, hard to parse visually, and cluttered with raw debug noise.
- Private reasoning steps (`<thought>`, `<scratchpad>`) frequently leak into terminal scrolls.
- Sensitive credentials (API keys, tokens, private keys) are exposed in error messages or logs.
- Interactive terminals lack structured progress bars, collapsible task trees, and clear disk change verification.

**AOE solves this** through a two-part hybrid architecture:

1. **AOE Skill (`skills/aoe/SKILL.md`)**: A zero-dependency instruction skill that guides agents to produce structured Markdown and status indicators, even without any CLI engine installed.
2. **AOE Engine & CLI (`aoe`)**: A standalone terminal presentation engine built on Ink 8 and React 19 that consumes canonical JSONL events or raw agent hooks, validates state, and renders responsive terminal UI.

---

## 2. Architecture Overview

```
                      AI Coding Agents
             (Claude Code / Gemini CLI / Generic)
                              │
                              ▼
                       @zyanx04/adapters
                 (Format Detection & Mapping)
                              │
                              ▼
                       @zyanx04/protocol
             (Canonical Event Schema & Validation)
                              │
                              ▼
                         @zyanx04/core
             (Session State, Tasks, Deduplication)
                              │
                              ▼
                       @zyanx04/renderer
             (Screen Orchestrator & Mode Selection)
                     │                 │
                     ▼                 ▼
             Interactive TTY     Non-TTY / CI Pipe
            (@zyanx04/components) (StaticRenderer)
```

### Monorepo Packages

- **[`apps/cli`](apps/cli)**: Executable `aoe` binary providing `render`, `pipe`, `theme`, `doctor`, and `skill` commands.
- **[`packages/protocol`](packages/protocol)**: Canonical event protocol schema v1.0.0 and streaming JSONL parser.
- **[`packages/core`](packages/core)**: Core event ingestion, session lifecycle, task hierarchies, and progress tracking.
- **[`packages/renderer`](packages/renderer)**: Terminal rendering engine orchestrating Ink interactive apps and static fallbacks.
- **[`packages/components`](packages/components)**: Reusable terminal UI elements (`ProgressBar`, `TaskSummary`, `FileChangeView`, etc.).
- **[`packages/themes`](packages/themes)**: Theme engine with semantic color tokens and WCAG contrast validation.
- **[`packages/adapters`](packages/adapters)**: Ingestion adapters for Claude Code, Gemini CLI, and generic JSONL logs.
- **[`skills/aoe`](skills/aoe)**: Portable, standalone skill documentation for AI agents.

---

## 3. Features

- **Agent-Agnostic**: Works with any agent emitting structured JSONL or supported CLI hook formats.
- **Dual-Mode Rendering**:
  - **Interactive TTY**: Fluid Ink layout with animations, status spinners, and clean task hierarchies.
  - **Static Non-TTY / CI**: Streaming plain text output without screen-clearing escapes, safe for log captures and pipelines.
- **Built-in Security & Privacy**:
  - Defense-in-depth sanitization against terminal escape injection (OSC titles, cursor control).
  - Trojan Source Unicode bidirectional override suppression.
  - Automatic masking of API keys (`sk-...`, `AIza...`), Bearer tokens, GitHub PATs, and private keys.
  - Suppression of private thought tags (`<thought>`, `<scratchpad>`).
- **Memory & Stream Bounds**: Safe streaming with line-length limits and stream ceilings protecting against memory exhaustion.
- **Atomic Configuration**: Safe configuration persistence with temporary file swaps preventing corruption.
- **Customizable Themes**: Built-in `obsidian` (dark), `light`, and `high-contrast` themes.

---

## 4. Installation

### Requirements

- **Node.js**: `>= 20.0.0`
- **npm** or **pnpm**: `>= 9.0.0`

### Global Installation via npm

```bash
npm install -g @zyanx04/cli
```

### Local Project Installation

```bash
pnpm add @zyanx04/cli
```

---

## 5. Quick Start

### 1. Verify Your Environment

Run the diagnostic suite to ensure your system and terminal are ready:

```bash
aoe doctor
```

Or for machine-readable JSON:

```bash
aoe doctor --json
```

### 2. Render Canonical Events

Pipe canonical AOE JSONL events directly into the renderer:

```bash
echo '{"protocolVersion":"1.0.0","eventId":"evt-1","sessionId":"demo-1","sequence":1,"timestamp":"2026-11-03T12:00:00Z","eventType":"session.started","payload":{"workingDirectory":"/tmp","agent":{"name":"demo-agent"}}}' | aoe render
```

### 3. Adapt Agent Output

Pipe output from an AI coding agent or generic JSONL log:

```bash
cat agent_output.jsonl | aoe pipe --agent generic-jsonl
```

### 4. Manage Themes

```bash
# List available themes
aoe theme list

# Inspect a theme's color palette and tokens
aoe theme show obsidian

# Set default theme
aoe theme set high-contrast
```

---

## 6. CLI Commands Reference

| Command       | Usage                                                      | Description                                                      |
| ------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| `aoe render`  | `cat events.jsonl \| aoe render [options]`                 | Renders canonical AOE JSONL events from standard input.          |
| `aoe pipe`    | `cat agent.log \| aoe pipe [options]`                      | Adapts and renders raw agent telemetry from standard input.      |
| `aoe theme`   | `aoe theme [list \| current \| show <name> \| set <name>]` | Manages active and installed terminal themes.                    |
| `aoe doctor`  | `aoe doctor [--json]`                                      | Diagnoses environment, Node version, themes, config, and skills. |
| `aoe skill`   | `aoe skill [show \| path]`                                 | Displays or resolves the location of `skills/aoe/SKILL.md`.      |
| `aoe version` | `aoe version` or `aoe --version`                           | Outputs current CLI and protocol versions.                       |

### Common Flags

- `-t, --theme <name>`: Override theme for the current command (`obsidian`, `light`, `high-contrast`).
- `-m, --mode <auto|interactive|static>`: Force render mode (`auto` detects TTY automatically).
- `--verbose`: Show detailed diagnostic stack traces on error.

---

## 7. Supported Agents

| Agent / Input     | Adapter Flag             | Description                                                                 |
| ----------------- | ------------------------ | --------------------------------------------------------------------------- |
| **Claude Code**   | `--agent claude-code`    | Ingests Claude Code CLI telemetry, hook events, and tool execution reports. |
| **Gemini CLI**    | `--agent gemini-cli`     | Ingests Gemini CLI tool calls, system messages, and outputs.                |
| **Generic JSONL** | `--agent generic-jsonl`  | Standard JSONL format with flexible schema mapping for custom agents.       |
| **Auto-Detect**   | `--agent auto` (default) | Automatically inspects stream headers and environment to select adapter.    |

---

## 8. Configuration

AOE stores user preferences in standard OS-specific directories:

- **Linux**: `~/.config/aoe/config.json` (or `$XDG_CONFIG_HOME/aoe/config.json`)
- **macOS**: `~/Library/Application Support/aoe/config.json`
- **Windows**: `%APPDATA%\aoe\config.json`
- **Custom**: `$AOE_CONFIG_PATH`

Example `config.json`:

```json
{
  "theme": "obsidian",
  "output": {
    "mode": "auto",
    "unicode": true,
    "animations": true
  },
  "adapters": {
    "defaultAgent": "auto"
  }
}
```

---

## 9. Security Guarantees

1. **No Automatic Command Execution**: AOE never runs shell commands emitted in agent events.
2. **No Agent Config Tampering**: AOE treats external agent configuration as strictly read-only.
3. **Defense-in-Depth Sanitization**: Text rendered to the terminal is filtered for ANSI escapes and control characters.
4. **Secret Masking**: Sensitive tokens are replaced with asterisks before display.
5. **Private Thought Protection**: Reasoning sections are stripped prior to rendering.

For full security policy and reporting guidelines, see [`SECURITY.md`](SECURITY.md).

---

## 10. Contributing

We welcome contributions from the community! Please read:

- [`CONTRIBUTING.md`](CONTRIBUTING.md) for development setup, architecture boundaries, and testing guidelines.
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) for community standards.

---

## 11. License

This project is licensed under the [MIT License](LICENSE).
