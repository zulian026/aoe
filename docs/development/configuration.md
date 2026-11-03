# AOE Configuration System

This document outlines the user configuration schema, filesystem paths, atomic write semantics, and management conventions for AOE.

---

## 1. Configuration File Locations

AOE resolves the configuration file path based on platform-standard directory conventions:

- **Linux / POSIX**:
  - If `$XDG_CONFIG_HOME` is set: `$XDG_CONFIG_HOME/aoe/config.json`
  - Otherwise: `~/.config/aoe/config.json`
- **macOS**:
  - `~/Library/Application Support/aoe/config.json`
- **Windows**:
  - `%APPDATA%\aoe\config.json` (e.g. `C:\Users\<user>\AppData\Roaming\aoe\config.json`)
- **Environment Override**:
  - Setting `AOE_CONFIG_PATH=/path/to/custom/config.json` explicitly overrides all platform heuristics (useful for testing and containerized CI).

---

## 2. Configuration Schema

AOE configuration is validated using Zod against the following structure:

```json
{
  "version": 1,
  "theme": "obsidian",
  "output": {
    "mode": "auto",
    "showTimestamps": false
  },
  "adapters": {
    "autoDetect": true,
    "minimumConfidence": "high"
  }
}
```

### Property Reference

| Property                     | Type      | Default      | Description                                                                                                         |
| ---------------------------- | --------- | ------------ | ------------------------------------------------------------------------------------------------------------------- |
| `version`                    | `number`  | `1`          | Configuration schema version (must be `1`).                                                                         |
| `theme`                      | `string`  | `"obsidian"` | Default presentation theme (`obsidian`, `light`, `high-contrast`).                                                  |
| `output.mode`                | `string`  | `"auto"`     | Default rendering mode: `"auto"`, `"interactive"`, or `"static"`.                                                   |
| `output.showTimestamps`      | `boolean` | `false`      | Display wall-clock timestamps on log and diagnostic entries.                                                        |
| `adapters.autoDetect`        | `boolean` | `true`       | Enable heuristic auto-detection when `--agent auto` is used.                                                        |
| `adapters.minimumConfidence` | `string`  | `"high"`     | Minimum confidence threshold required to adopt an auto-detected agent: `"exact"`, `"high"`, `"medium"`, or `"low"`. |

---

## 3. Atomic Updates

When configuration changes are persisted (e.g. via `aoe theme set <name>`):

1. The new configuration object is validated against `AoeConfigSchema`.
2. The serialized JSON is written to a temporary sibling file (`config.json.tmp.<timestamp>.<rand>`).
3. The temporary file is atomically renamed to `config.json`.

This prevents configuration corruption during unexpected power losses, interrupts, or disk exhaustion.

---

## 4. Security Principles

- **No Secrets**: AOE configuration files must never store passwords, API keys, Bearer tokens, or credentials.
- **Read-Only Fallback**: If `config.json` does not exist, AOE operates smoothly with safe built-in defaults without modifying the filesystem.
- **Fail-Safe Validation**: If `config.json` contains invalid JSON or schema errors, AOE alerts the user via `aoe doctor` or stderr without automatically overwriting user edits.
