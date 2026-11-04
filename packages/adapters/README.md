# @zyanx04/adapters

Universal agent ingestion, normalization, and stream parsing adapters for AOE (Agent Output Enhancement).

## Overview

`@zyanx04/adapters` translates disparate outputs, hook events, and telemetry formats from AI coding agents (such as Anthropic Claude Code, Google Gemini CLI, and custom agents) into canonical `@zyanx04/protocol` events.

## Supported Adapters

1. **`claude-code`**: Ingests Claude Code CLI telemetry, tool invocations (`PreToolUse`, `PostToolUse`), and hook events (`SessionStart`, `SessionEnd`).
2. **`gemini-cli`**: Ingests Google Gemini CLI tool execution reports, command lifecycle hooks, and system events.
3. **`generic-jsonl`**: Ingests arbitrary JSONL log streams, mapping common event schemas into canonical protocol events.

## Security & Privacy Sanitization

The adapter layer acts as the first line of defense before events enter the engine:

- **Private Thought Stripping** (`stripPrivateReasoning`): Strips `<thought>`, `<scratchpad>`, `<antThinking>`, and `<internal_reasoning>` blocks.
- **Thinking Field Filtering**: Drops JSON payload fields named `thought`, `thoughts`, `scratchpad`, or `reasoning`.
- **Secret Redaction** (`maskSecrets`): Redacts API keys, Bearer tokens, GitHub PATs, AWS credentials, and private keys.

## Installation

```bash
npm install @zyanx04/adapters @zyanx04/protocol
# or
pnpm add @zyanx04/adapters @zyanx04/protocol
```

## Quick Start

```typescript
import { createDefaultAdapterManager } from '@zyanx04/adapters';

const manager = createDefaultAdapterManager();

// Automatically detect adapter and ingest streaming input
const rawAgentInput = {
  hook_type: 'SessionStart',
  cwd: '/workspace/project',
  model: 'claude-3-7-sonnet',
};

const canonicalEvents = await manager.ingest('session-1', rawAgentInput);

for (const event of canonicalEvents) {
  console.log(`Mapped event: ${event.eventType}`);
}
```

## Creating a Custom Adapter

```typescript
import type { AgentAdapter, AdapterSession, IngestContext } from '@zyanx04/adapters';
import type { AoeEvent } from '@zyanx04/protocol';

export class MyCustomAdapter implements AgentAdapter {
  public readonly id = 'my-custom-agent';
  public readonly name = 'My Custom Agent';

  public detect(context: IngestContext): 'high' | 'medium' | 'low' | 'none' {
    return context.header?.includes('my-agent-signature') ? 'high' : 'none';
  }

  public createSession(options: { sessionId: string }): AdapterSession {
    return {
      push(chunk: string): AoeEvent[] {
        // Parse chunk and return canonical AoeEvent[]
        return [];
      },
      end(): AoeEvent[] {
        return [];
      },
    };
  }
}
```

## License

MIT
