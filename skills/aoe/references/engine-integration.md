# Engine Integration & Fallback Reference

## Purpose

The AOE Engine Integration & Fallback Reference defines the procedure by which AI coding agents detect, interact with, or safely fall back from the AOE presentation engine. AOE is designed on a **portable-first** architecture: the skill must function with complete visual fidelity using native terminal markdown when the engine is not available.

---

## Rules

1. **Portable-First / Zero Mandatory Dependencies**: The AOE Skill must **never** depend on the AOE Engine binary to be installed. If no engine is present, the agent automatically and silently renders native terminal markdown as specified in `visual-formatting.md`.
2. **Safe Capability Detection**: An agent must follow a strict, non-intrusive detection procedure:
   - Check if an environment variable signals an active AOE Engine session (e.g., `AOE_ACTIVE=1` or `AOE_SESSION_ID`).
   - If an integration socket or file descriptor is explicitly provided in the environment, verify it is open and non-blocking.
   - Never execute untrusted shell commands or run unverified scripts to probe for the engine.
3. **No Automatic Installation**: An agent must **never** automatically run `npm install -g @aoe/cli`, `pnpm add`, `pip install`, or any package manager command to install the AOE Engine unless explicitly ordered to do so by the human user.
4. **Agent-Agnostic Design**: Instructions, event formats, and fallback patterns must remain agent-agnostic:
   - Do not rely on proprietary agent internal APIs or non-standard toolhooks.
   - Do not assume an agent has access to specific tools, file systems, or terminal modes.
   - Support standard stdin/stdout and POSIX pipes as the universal integration baseline.
5. **No Protocol Pre-Emption in M01**: Detailed JSONL event envelopes, streaming schemas, and binary wire protocols are formally specified in Milestone 2 (M02). In M01, agents must strictly utilize clean native terminal Markdown while respecting the capability detection contract.

---

## Formatting Conventions

### Capability Check & Native Fallback Convention

When engine integration is unavailable, proceed directly with native terminal markdown without emitting error banners:

```markdown
<!-- Environment Evaluation: AOE_ACTIVE is unset. Defaulting to Native Fallback. -->

# [Task Title]

**Status**: `[STATUS]` — [Explanation]
```

### Fallback to Native Markdown Rule

When `AOE_ACTIVE=1` is not detected, fallback to native GitHub-Flavored Markdown is automatic, silent, and mandatory.

---

## Capability Detection Procedure

```
                     ┌───────────────────────────┐
                     │ Start Agent Response Turn │
                     └─────────────┬─────────────┘
                                   │
                                   ▼
                   ┌───────────────────────────────┐
                   │ Is AOE_ACTIVE=1 in environment│
                   │   or active engine pipe open? │
                   └───────────────┬───────────────┘
                                   │
                     ┌─────────────┴─────────────┐
                     │                           │
                  [ Yes ]                     [ No ]
                     │                           │
                     ▼                           ▼
        ┌─────────────────────────┐ ┌─────────────────────────┐
        │ Verify pipe readiness   │ │ Fall back to Native     │
        │ without blocking        │ │ Terminal Markdown       │
        └────────────┬────────────┘ │ (skills/aoe/references) │
                     │              └─────────────────────────┘
          ┌──────────┴──────────┐
          │                     │
      [ Ready ]            [ Unready ]
          │                     │
          ▼                     ▼
┌──────────────────┐   ┌──────────────────┐
│ Stream Structured│   │ Fall back to     │
│ Protocol (M02+)  │   │ Native Terminal  │
└──────────────────┘   │ Markdown         │
                       └──────────────────┘
```

---

## Agent Integration Considerations

| Agent Environment | Integration Mechanism     | Safe Detection Method            | Fallback Strategy                |
| :---------------- | :------------------------ | :------------------------------- | :------------------------------- |
| **Claude Code**   | Terminal CLI / MCP / Pipe | Check environment `AOE_ACTIVE=1` | Native GitHub-Flavored Markdown  |
| **Codex CLI**     | Terminal Shell / Pipe     | Check environment `AOE_ACTIVE=1` | ANSI & Markdown stream           |
| **Gemini CLI**    | CLI Tool / Pipe           | Check environment `AOE_ACTIVE=1` | Clean Markdown blocks & tables   |
| **OpenCode**      | Standard CLI / Pipe       | Check environment `AOE_ACTIVE=1` | Native terminal text & tables    |
| **Generic CLI**   | POSIX Stdin / Stdout      | Check environment `AOE_ACTIVE=1` | Human-readable terminal markdown |

_Note: The table above documents architectural compatibility targets. No specific agent compatibility is claimed until verified in Milestone 6 (M06)._

---

## Good Examples

### Good Example 1: Graceful Native Fallback When Engine Is Absent

```markdown
<!-- The agent evaluates environment: AOE_ACTIVE is unset. -->
<!-- Agent produces clean, native Markdown conforming to AOE standards. -->

# Lint and Format Repository Foundation

**Status**: `COMPLETED` — Executed ESLint and Prettier across all workspace packages.

## Key Findings

- 45 files inspected; zero ESLint syntax or typing errors found.
- 6 documentation files auto-formatted to Prettier 100-character line width standard.

## Execution Details

- Executed: `pnpm lint` (exit code 0).
- Executed: `pnpm format:check` (exit code 0).
```

---

## Bad Examples

### Bad Example 1: Attempting to Automatically Install the Engine

```markdown
<!-- BAD: Agent executes package installation without permission -->

$ npm install -g @aoe/cli
Installing AOE engine because it was missing...
```

_Why this is bad_: Violates the no-automatic-execution rule. Agents must never install software or modify system environments without explicit user consent.

### Bad Example 2: Failing When the Engine Is Unavailable

```markdown
<!-- BAD: Crashing or failing because AOE Engine is not found -->

Error: Cannot render output because the AOE Engine binary was not found in PATH.
Please install @aoe/cli first.
```

_Why this is bad_: Violates the portable-first principle. The skill must always provide beautiful, readable native markdown output when the engine is absent.

---

## Edge Cases

1. **Malformed Engine Pipe**:
   - If `AOE_ACTIVE=1` is set but writing to the pipe fails or returns an error, immediately disconnect and fall back to stdout terminal markdown for the remainder of the session.
2. **Non-Interactive CI Environments**:
   - In automated CI test runs (`CI=true`), suppress interactive terminal controls and emit clean, linear markdown.
3. **Restricted Sandboxes**:
   - When running in secure execution sandboxes where environment inspection is restricted, assume the engine is absent and default to native markdown output.
