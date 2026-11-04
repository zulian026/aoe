# CLI Tooling & Runtime Architecture

This document describes the command-line interface architecture and runtime integration implemented in `@zyanx04/cli` (Milestone 07) for the AOE (Agent Output Enhancement) system.

---

## 1. Architectural Role and Pipeline

The CLI application (`apps/cli`, binary executable `aoe`) serves as the universal user entrypoint for the AOE monorepo. It orchestrates user configuration, streaming input readers, protocol validation, adapter normalization, core engine state transitions, and terminal presentation.

```text
               Input Sources (Stdin / Pipes / Subprocess Redirects)
                                       |
                                       v
                           +-----------------------+
                           |     @zyanx04/cli (aoe)    |
                           |   (Commander Parser)  |
                           +-----------+-----------+
                                       |
                                       v
                           +-----------------------+
                           |  Config & Environment |
                           |  (loadConfig, XDG)    |
                           +-----------+-----------+
                                       |
                   +-------------------+-------------------+
                   |                                       |
         [aoe render] (Canonical)                [aoe pipe] (Proprietary)
                   |                                       |
                   v                                       v
         +-------------------+                   +-------------------+
         |   @zyanx04/protocol   |                   |   @zyanx04/adapters   |
         | (parseEventStream)|                   | (AdapterManager)  |
         +---------+---------+                   +---------+---------+
                   |                                       |
                   | (Validated AoeEvents)                 | (Normalized AoeEvents)
                   +-------------------+-------------------+
                                       |
                                       v
                           +-----------------------+
                           |       @zyanx04/core       |
                           |   (Execution Engine)  |
                           +-----------+-----------+
                                       |
                                       v (Immutable SessionSnapshot)
                           +-----------------------+
                           |     @zyanx04/renderer     |
                           | (ExecutionPipeline)   |
                           +-----------+-----------+
                                       |
                   +-------------------+-------------------+
                   |                                       |
         (Interactive TTY)                          (Non-TTY / Pipe / CI)
                   v                                       v
         +-------------------+                   +-------------------+
         | TerminalRenderer  |                   |  StaticRenderer   |
         | (Ink + React Tree)|                   | (Linear Stream)   |
         +-------------------+                   +-------------------+
```

---

## 2. Core Modules & Decomposition

### 2.1 Execution Pipeline (`ExecutionPipeline`)

Located in `apps/cli/src/runtime/execution-pipeline.ts`:

- Coordinates the lifecycle between `@zyanx04/core`'s `Engine` and `@zyanx04/renderer`'s `TerminalRenderer` or `StaticRenderer`.
- Automatically selects the rendering strategy:
  - `interactive`: Uses full-screen Ink components when standard output is an interactive TTY and not running in CI.
  - `static`: Uses line-oriented linear text stream formatting for CI environments, redirected stdout, or headless pipes.
  - `auto`: Dynamically detects terminal capabilities via `isInteractiveSuitable(process.stdout)`.
- Subscribes to session state changes from `Engine.subscribe(sessionId, listener)`.
- Ensures clean teardown and terminal cursor restoration upon stream completion or cancellation.

### 2.2 Streaming Stdin Reader (`readStreamChunks`)

Located in `apps/cli/src/runtime/stdin-reader.ts`:

- Reads raw text chunks asynchronously using Node.js stream async iterables (`for await (const chunk of stream)`).
- Enforces an upper bound memory threshold (default 50 MB) to prevent denial-of-service from unbounded stream generators.
- Correctly propagates chunk boundaries without requiring the entire input to be buffered in memory before processing begins.

### 2.3 Signal Management & Graceful Teardown (`SignalHandler`)

Located in `apps/cli/src/runtime/signal-handler.ts`:

- Captures `SIGINT` (Ctrl+C) and `SIGTERM` signals once and prevents duplicate signal listener registration.
- Executes registered teardown tasks in reverse order of registration (ending active adapter sessions, unmounting React/Ink trees, restoring terminal alternate screen).
- Exits with POSIX-standard signal exit codes (`130` for SIGINT, `143` for SIGTERM).

---

## 3. Exit Code Specification

The AOE CLI strictly maps operation results to deterministic exit codes:

| Exit Code | Constant            | Meaning                                                                               |
| --------- | ------------------- | ------------------------------------------------------------------------------------- |
| `0`       | `SUCCESS`           | Successful execution without error.                                                   |
| `1`       | `UNEXPECTED_ERROR`  | Unhandled runtime exception or unexpected failure.                                    |
| `2`       | `INVALID_ARGUMENTS` | Invalid command line arguments, unknown options, or missing stdin pipe.               |
| `3`       | `PROTOCOL_ERROR`    | Canonical event schema failure, malformed JSONL, or protocol envelope violation.      |
| `4`       | `ADAPTER_ERROR`     | Adapter parsing failure, unknown agent identifier, or low auto-detection confidence.  |
| `5`       | `CONFIG_ERROR`      | User configuration syntax error, validation error, or filesystem access failure.      |
| `6`       | `ENVIRONMENT_ERROR` | Environment dependency missing or diagnostic check failure (e.g. missing `SKILL.md`). |
| `130`     | `SIGINT`            | Process terminated via SIGINT (Ctrl+C).                                               |
| `143`     | `SIGTERM`           | Process terminated via SIGTERM.                                                       |

---

## 4. Safety and Security Invariants

In strict adherence to AOE engineering standards:

1. **Zero Shell Execution**: The CLI never spawns subshells or executes shell commands to inspect, detect, or run external AI agents.
2. **Zero Configuration Tampering**: The CLI never modifies agent settings (`.claude/settings.json`, `.gemini/settings.json`) or installs unauthorized hooks.
3. **No Credential Logging**: All logs, diagnostics, and session snapshots are routed through credential masks (`maskSecrets`) before terminal output.
4. **No Private Reasoning Exposure**: Chain-of-thought blocks (`<thought>`, `<scratchpad>`) are stripped during normalization and never displayed.
