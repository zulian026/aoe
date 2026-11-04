# @zyanx04/protocol

Canonical event protocol definitions, schemas, and streaming JSONL serialization for AOE (Agent Output Enhancement).

## Overview

`@zyanx04/protocol` defines the versioned, validated event envelope and canonical event schemas that AI coding agents and external tools use to communicate structured execution telemetry to the AOE Engine.

Protocol Version: **1.0.0**

## Features

- **Strict Validation**: All envelopes and payloads are validated via Zod schemas.
- **Deterministic Serialization**: JSON object keys are sorted deterministically for reproducible hashing and logging.
- **Streaming JSONL Parser**: Asynchronous generator parsing chunks of lines with configurable record byte limits (`maxLineLengthBytes`) to guard against buffer exhaustion attacks.
- **Canonical Event Types**: Standardized schemas covering sessions, tasks, progress, file changes, diagnostics, logs, and results.

## Installation

```bash
npm install @zyanx04/protocol
# or
pnpm add @zyanx04/protocol
```

## Quick Start

```typescript
import { parseEventStream, serializeEvent, validateEvent, type AoeEvent } from '@zyanx04/protocol';

// Validate an unknown event object
const rawEvent = {
  protocolVersion: '1.0.0',
  eventId: 'evt-100',
  sessionId: 'sess-01',
  sequence: 1,
  timestamp: new Date().toISOString(),
  eventType: 'log.emitted',
  payload: {
    level: 'info',
    message: 'Compiling source files...',
  },
};

const validEvent: AoeEvent = validateEvent(rawEvent);

// Serialize to canonical JSONL string
const line: string = serializeEvent(validEvent);

// Stream parsing
async function* getChunks() {
  yield line;
}

for await (const event of parseEventStream(getChunks())) {
  console.log(`Received event #${event.sequence}: ${event.eventType}`);
}
```

## Supported Event Types

| Event Type           | Purpose                        | Key Payload Fields                         |
| -------------------- | ------------------------------ | ------------------------------------------ |
| `session.started`    | Begins an execution session    | `agent`, `workingDirectory`                |
| `session.ended`      | Concludes an execution session | `status`, `exitCode`, `summary`            |
| `task.started`       | Initiates a task or subtask    | `taskId`, `taskName`, `parentTaskId`       |
| `task.updated`       | Updates task status or message | `taskId`, `status`, `message`              |
| `task.completed`     | Marks a task successful        | `taskId`, `durationMs`                     |
| `task.failed`        | Marks a task failed            | `taskId`, `error`                          |
| `progress.updated`   | Reports progress metrics       | `completedWork`, `totalWork`, `isEstimate` |
| `file.changed`       | Tracks filesystem mutations    | `action`, `path`, `evidence`               |
| `diagnostic.emitted` | Emits compiler/linter warnings | `severity`, `message`, `location`          |
| `log.emitted`        | General execution logs         | `level`, `message`, `stream`               |
| `result.produced`    | Emits execution artifacts      | `category`, `data`                         |
| `error.occurred`     | Reports unexpected errors      | `severity`, `message`, `stack`             |

## License

MIT
