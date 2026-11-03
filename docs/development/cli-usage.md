# AOE CLI Usage Guide

This guide details how to build, run, and use the official `aoe` command-line executable.

---

## 1. Local Build and Execution

Inside the AOE repository:

```bash
# Build all packages and CLI binary
pnpm build

# Run the CLI directly via Node
node apps/cli/dist/bin.js --help

# Or run via pnpm
pnpm --filter @aoe/cli exec aoe --help
```

---

## 2. Command Reference

### 2.1 `aoe render`

Reads canonical AOE Protocol JSONL events from standard input, validates them against `@aoe/protocol`, and renders live execution state using `@aoe/core` and `@aoe/renderer`.

```bash
# Render from a file
cat events.jsonl | aoe render

# Specify a custom theme
aoe render --theme light < events.jsonl

# Force static linear output mode (useful for CI/pipes)
aoe render --format static < events.jsonl
```

#### Options:

- `-t, --theme <name>`: Visual theme identifier (`obsidian`, `light`, `high-contrast`). Default: user config or `obsidian`.
- `-f, --format <mode>` / `-m, --mode <mode>`: Output mode: `auto` (default), `interactive`, or `static`.
- `--verbose`: Enable detailed error and stack trace output.

---

### 2.2 `aoe pipe`

The universal ingestion entrypoint for receiving external AI coding agent output and normalizing it into AOE presentation via `@aoe/adapters`.

```bash
# Explicit Claude Code hook payload
cat claude-hook.json | aoe pipe --agent claude-code

# Explicit Gemini CLI hook payload
cat gemini-hook.json | aoe pipe --agent gemini-cli

# Generic JSONL stream
cat stream.jsonl | aoe pipe --agent generic-jsonl

# Auto-detection mode (inspects environment and metadata)
agent-command | aoe pipe --agent auto
```

#### Supported Agents:

- `claude-code`: Anthropic Claude Code hook payloads (`SessionStart`, `PreToolUse`, `PostToolUse`, `SessionEnd`).
- `gemini-cli`: Google Gemini Developer CLI hook payloads (`SessionStart`, `BeforeTool`, `AfterTool`, `SessionEnd`).
- `generic-jsonl`: Universal JSONL stream of canonical protocol events.
- `auto`: Automatically detects the active agent based on environment variables and metadata.

---

### 2.3 `aoe theme`

Inspect and manage visual presentation themes.

```bash
# List all registered themes with active theme marked
aoe theme list

# Display current active theme
aoe theme current

# Inspect detailed color tokens and symbols for a theme
aoe theme show obsidian
aoe theme show high-contrast

# Change and persist the default theme
aoe theme set light
```

---

### 2.4 `aoe doctor`

Performs end-to-end diagnostic checks on the runtime, dependencies, configurations, themes, adapters, and skill definitions.

```bash
aoe doctor
```

#### Verification Categories:

1. **Runtime**: Node.js version ($\ge$ 18) and CLI protocol version.
2. **Configuration**: File accessibility and Zod schema validation.
3. **Themes**: Theme registry and built-in themes (`obsidian`, `light`, `high-contrast`).
4. **Adapters**: Active registration of `claude-code`, `gemini-cli`, and `generic-jsonl`.
5. **Terminal**: TTY status, `NO_COLOR`, `FORCE_COLOR`, and interactive suitability.
6. **Skill**: Verification of `skills/aoe/SKILL.md` accessibility.

---

### 2.5 `aoe skill`

Inspect and locate the standalone, portable AOE Skill definition.

```bash
# Output the raw contents of SKILL.md
aoe skill
aoe skill show

# Print the absolute filesystem path to SKILL.md
aoe skill path
```

---

## 3. Exit Codes and Troubleshooting

| Exit Code | Meaning           | Common Cause                                       | Resolution                                                      |
| --------- | ----------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| `0`       | Success           | Normal operation                                   | No action needed.                                               |
| `2`       | Invalid Arguments | Unknown flag or non-piped stdin on `render`/`pipe` | Ensure input is piped via stdin, e.g. `cat file \| aoe render`. |
| `3`       | Protocol Error    | Input JSONL failed `@aoe/protocol` schema          | Ensure payloads conform to AOE Protocol v1.0.0 envelopes.       |
| `4`       | Adapter Error     | Unknown agent or auto-detection failed             | Pass `--agent <name>` explicitly.                               |
| `5`       | Config Error      | Malformed user `config.json`                       | Check JSON formatting in `$XDG_CONFIG_HOME/aoe/config.json`.    |
| `6`       | Environment Error | Missing dependencies or `SKILL.md`                 | Run `aoe doctor` for exact diagnostic details.                  |
| `130`     | SIGINT            | Terminated via Ctrl+C                              | Normal user interruption.                                       |
| `143`     | SIGTERM           | Terminated via SIGTERM                             | Normal process termination.                                     |
