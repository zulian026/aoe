# External CLI & Agent Integration Guide

This document describes how to integrate external AI coding agents, CI/CD runners, and developer pipelines with the `aoe` CLI.

---

## 1. Claude Code Integration

Anthropic Claude Code supports executing external commands upon lifecycle events via hooks in `.claude/settings.json`.

### Configuration Example

Add the following to `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": "aoe pipe --agent claude-code",
    "SessionEnd": "aoe pipe --agent claude-code",
    "PreToolUse": "aoe pipe --agent claude-code",
    "PostToolUse": "aoe pipe --agent claude-code",
    "PostToolUseFailure": "aoe pipe --agent claude-code"
  }
}
```

When Claude Code executes a tool (such as `Edit`, `Write`, or `Bash`), Claude Code delivers the hook payload to `stdin` of `aoe pipe`, which translates it into canonical AOE tasks, progress bars, and file modifications.

---

## 2. Gemini CLI Integration

Google Gemini CLI supports lifecycle hooks configured in `.gemini/settings.json`.

### Configuration Example

Add the following to `.gemini/settings.json`:

```json
{
  "hooks": {
    "SessionStart": "aoe pipe --agent gemini-cli",
    "SessionEnd": "aoe pipe --agent gemini-cli",
    "BeforeAgent": "aoe pipe --agent gemini-cli",
    "AfterAgent": "aoe pipe --agent gemini-cli",
    "BeforeTool": "aoe pipe --agent gemini-cli",
    "AfterTool": "aoe pipe --agent gemini-cli"
  }
}
```

---

## 3. Generic JSONL Piping

For custom agents, internal coding bots, or CI test runners:

### Shell Pipe

```bash
python generate_events.py | aoe pipe --agent generic-jsonl
```

### Pre-formatted Canonical Protocol Envelopes

If your system directly produces canonical AOE Protocol v1.0.0 JSON lines:

```bash
cat canonical_events.jsonl | aoe render --format auto
```

---

## 4. Headless CI / CD Environments

In automated pipelines (GitHub Actions, GitLab CI, Buildkite):

- Set `CI=true` or use `--format static` to guarantee linear non-interactive output without screen redrawing or ANSI cursor escapes.
- Use `aoe doctor` as an environment gatekeeper to verify node, dependencies, themes, and configuration validity before launching agent runs.
