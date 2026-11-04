# Agent Compatibility Matrix

This document outlines verified agent compatibility, integration mechanisms, and support statuses across AI coding agents in AOE v0.1.0.

All integrations are verified against official vendor documentation as of November 2026.

---

## 1. Compatibility Overview

| Agent                       | Status                | Adapter ID      | Primary Mechanism                   | Fallback Mechanism             | Verification Date |
| --------------------------- | --------------------- | --------------- | ----------------------------------- | ------------------------------ | ----------------- |
| **Claude Code** (Anthropic) | Fully Supported       | `claude-code`   | CLI Hooks (`.claude/settings.json`) | `--stream-json` stdout         | Nov 2026          |
| **Gemini CLI** (Google)     | Fully Supported       | `gemini-cli`    | CLI Hooks (`.gemini/settings.json`) | `--output-format stream-json`  | Nov 2026          |
| **Generic JSONL Stream**    | Fully Supported       | `generic-jsonl` | Line-delimited JSON on `stdin`      | Explicit `--format jsonl` file | Nov 2026          |
| **OpenCode / Custom Agent** | Supported via Generic | `generic-jsonl` | Standard JSONL pipe                 | Manual adapter subclass        | Nov 2026          |
| **Cursor / Windsurf**       | Planned (M09+)        | —               | Extension IPC / LSP bridge          | Generic JSONL export           | Planned           |
| **Aider**                   | Candidate             | —               | `--message-format json` pipe        | Generic JSONL                  | Candidate         |

---

## 2. Supported Event Categories

| Event Category               | Claude Code                              | Gemini CLI                               | Generic JSONL                         | Notes                                                             |
| ---------------------------- | ---------------------------------------- | ---------------------------------------- | ------------------------------------- | ----------------------------------------------------------------- |
| **Session Lifecycle**        | Supported (`SessionStart`, `SessionEnd`) | Supported (`SessionStart`, `SessionEnd`) | Supported                             | Full start, end, metadata capture                                 |
| **Task Lifecycle**           | Supported (`PreToolUse`, `PostToolUse`)  | Supported (`BeforeTool`, `AfterTool`)    | Supported                             | Granular start, completion, failure tracking                      |
| **File Changes**             | Supported (`Edit`, `Write`)              | Supported (`write_file`, `edit_file`)    | Supported                             | Path, change type (created/modified/deleted), lines added/removed |
| **Execution Logs**           | Supported (`UserPromptSubmit`, `Bash`)   | Supported (`BeforeAgent`, `run_command`) | Supported                             | Tool inputs, stdout, stderr, progress notes                       |
| **Diagnostics**              | Supported (Tool failure outputs)         | Supported (Tool error responses)         | Supported                             | Errors mapped to `diagnostic.emitted` or `error.occurred`         |
| **Progress Reporting**       | Derived from tool completion ratios      | Derived from agent step progress         | Supported (Native `progress.updated`) | Percentage and step counters                                      |
| **Private Chain-of-Thought** | Blocked / Stripped                       | Blocked / Stripped                       | Blocked / Stripped                    | Security invariant: never exposed to UI                           |

---

## 3. Verified Agent Integrations

### 3.1 Claude Code (`claude-code`)

- **Official Source**: Anthropic Claude Code CLI Documentation & Hook Protocol.
- **Hook Integration**:
  Claude Code supports event hooks defined in `.claude/settings.json`:
  ```json
  {
    "hooks": {
      "SessionStart": "aoe hook claude-code",
      "SessionEnd": "aoe hook claude-code",
      "UserPromptSubmit": "aoe hook claude-code",
      "PreToolUse": "aoe hook claude-code",
      "PostToolUse": "aoe hook claude-code",
      "PostToolUseFailure": "aoe hook claude-code"
    }
  }
  ```
- **Stream Integration**: Claude Code also supports emitting newline-delimited JSON events when invoked with `claude --stream-json`.
- **Mapping Specifications**:
  - `SessionStart` / `session_start` -> `session.started`
  - `SessionEnd` / `session_end` -> `session.ended`
  - `UserPromptSubmit` -> `log.emitted` (info)
  - `PreToolUse` (`Edit`, `Write`, `Read`, `Bash`, `Glob`, `Grep`) -> `task.started`
  - `PostToolUse` with `Edit`/`Write` -> `file.changed` + `task.completed`
  - `PostToolUse` with `Bash` -> `log.emitted` + `task.completed`
  - `PostToolUseFailure` -> `diagnostic.emitted` + `task.failed`

### 3.2 Gemini CLI (`gemini-cli`)

- **Official Source**: Google Gemini Developer CLI Documentation & Hook Specifications.
- **Hook Integration**:
  Gemini CLI supports event hooks configured in `.gemini/settings.json`:
  ```json
  {
    "hooks": {
      "SessionStart": "aoe hook gemini-cli",
      "SessionEnd": "aoe hook gemini-cli",
      "BeforeAgent": "aoe hook gemini-cli",
      "AfterAgent": "aoe hook gemini-cli",
      "BeforeTool": "aoe hook gemini-cli",
      "AfterTool": "aoe hook gemini-cli"
    }
  }
  ```
- **Stream Integration**: Gemini CLI outputs streaming JSON when executed with `gemini --output-format stream-json`.
- **Mapping Specifications**:
  - `SessionStart` / `session_start` -> `session.started`
  - `SessionEnd` / `session_end` -> `session.ended`
  - `BeforeAgent` / `user_message` -> `log.emitted`
  - `BeforeTool` (`write_file`, `edit_file`, `read_file`, `run_command`) -> `task.started`
  - `AfterTool` with file tools -> `file.changed` + `task.completed`
  - `AfterTool` with `run_command` -> `log.emitted` + `task.completed`
  - `AfterTool` with error / `error` event -> `diagnostic.emitted` + `error.occurred` + `task.failed`

### 3.3 Generic JSONL (`generic-jsonl`)

- **Role**: Universal fallback and ingestion pipeline for any agent or tool generating structured JSON lines.
- **Ingestion**: Standard input stream (`stdin`) or JSON line chunks via `JsonlAdapter`.
- **Contract**: Accepts either pre-formatted canonical AOE protocol envelopes (`@zyanx04/protocol`) or generic event objects with `event` and `data` properties.

---

## 4. Unsupported or Out-of-Scope Behaviors

In alignment with AOE architectural standards:

1. **No Proprietary Thought Display**: Thinking tags (`<thought>`, `<scratchpad>`, `<antThinking>`) are aggressively redacted.
2. **No Command Interception or Hijacking**: AOE does not modify or re-execute agent commands.
3. **No Automatic Hook Installation**: Adapters do not write to user configuration directories without explicit user action.
