# @zyanx04/cli

The official command-line interface executable for AOE (Agent Output Enhancement).

## Overview

`@zyanx04/cli` is the entrypoint binary (`aoe`) that connects stdin streaming, adapter normalization, core engine state tracking, and terminal rendering into a fast, reliable CLI workflow.

## Installation

```bash
# Global installation
npm install -g @zyanx04/cli

# Direct execution via npx
npx @zyanx04/cli doctor

# Local project installation
npm install -D @zyanx04/cli
# or
pnpm add -D @zyanx04/cli
```

> [!IMPORTANT]
> Always execute via `npx @zyanx04/cli` or global `aoe` after installing `@zyanx04/cli`.
> Do **NOT** invoke `npx aoe`, as the unqualified package `aoe` on the public npm registry belongs to an unrelated legacy package from 2017.

## Commands

### `aoe render`

Renders canonical AOE JSONL events from standard input.

```bash
cat events.jsonl | aoe render
aoe render --theme light < events.jsonl
aoe render --mode static < events.jsonl
```

### `aoe pipe`

Adapts raw AI agent output or generic JSONL logs from standard input.

```bash
# Auto-detect agent format
agent-run | aoe pipe

# Explicit agent format
cat claude-hook.json | aoe pipe --agent claude-code
cat gemini-hook.json | aoe pipe --agent gemini-cli
cat stream.jsonl | aoe pipe --agent generic-jsonl
```

### `aoe bridge`

Executes the non-blocking hook bridge translating agent lifecycle events into canonical protocol events:

```bash
aoe bridge --event PreToolUse < hook-payload.json
```

### `aoe sidecar`

Attaches an independent terminal sidecar presentation layer to monitor active agent sessions in real time:

```bash
aoe sidecar
aoe sidecar --listen --socket /tmp/aoe-session.sock
aoe sidecar --once --json
```

### `aoe theme`

Manages terminal themes and color palettes.

```bash
aoe theme list
aoe theme current
aoe theme show obsidian
aoe theme set high-contrast
```

### `aoe doctor`

Runs comprehensive diagnostic checks on your environment, configuration, and terminal capabilities.

```bash
aoe doctor
aoe doctor --json
```

### `aoe skill`

Displays or locates the bundled standalone AOE Skill definition.

```bash
aoe skill show
aoe skill path
```

### `aoe version`

Displays CLI executable and canonical protocol versions.

```bash
aoe version
# or
aoe --version
```

## Configuration

Configuration is automatically read and written to:

- **Linux**: `~/.config/aoe/config.json` (or `$XDG_CONFIG_HOME/aoe/config.json`)
- **macOS**: `~/Library/Application Support/aoe/config.json`
- **Windows**: `%APPDATA%\aoe\config.json`
- **Custom Path**: Defined via `$AOE_CONFIG_PATH`

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
    "defaultAgent": "auto",
    "minimumConfidence": "high"
  }
}
```

## License

MIT
