# AOE Bridge Plugin for Antigravity

This directory contains the standalone plugin bundle for Google Antigravity.

## Structure

```text
aoe-bridge/
├── plugin.json       # Plugin manifest
├── hooks.json        # Antigravity lifecycle hooks configuration
└── README.md         # Documentation and configuration reference
```

## How It Works

1. Antigravity discovers this plugin when placed in `.agents/plugins/aoe-bridge` or `~/.gemini/config/plugins/aoe-bridge`.
2. Lifecycle events (`SessionStart`, `PreInvocation`, `PreToolUse`, `PostToolUse`, `Stop`) invoke `aoe bridge --event <EventName>`.
3. The hook bridge reads context JSON on `stdin`, normalizes it into AOE Protocol v1.0.0, and forwards it to a local Unix Domain Socket without blocking the agent.
4. The hook bridge returns the documented Antigravity response (e.g. `{"decision": "allow"}`) on `stdout`.

## Example Configuration

To manually activate this plugin in a workspace without copying files:

```json
// .agents/plugins.json
{
  "entries": [
    {
      "path": "path/to/aoe/plugins/aoe-bridge"
    }
  ]
}
```
