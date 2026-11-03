# Generic JSONL Integration

The `generic-jsonl` adapter in `@aoe/adapters` provides a robust, streamable ingestion mechanism for any AI coding agent, script, or CI pipeline that emits line-delimited JSON (JSONL).

---

## 1. Overview & Ingestion Architecture

The JSONL integration is split into two core layers:

1. **`JsonlParser`**: A streaming chunk-based line parser that handles line splitting, CRLF/LF normalization, buffer size bounds, and malformed JSON recovery.
2. **`JsonlAdapter`**: An `AgentAdapter` implementation that normalizes parsed objects into canonical `@aoe/protocol` envelopes.

```text
Stream Input (Chunks) -> [JsonlParser] -> Valid JSON Lines -> [JsonlAdapter] -> Canonical AoeEvents
```

---

## 2. Line Buffering & Safety Limits

### Bounded Line Size

To defend against memory exhaustion and uncontrolled buffer allocation, `JsonlParser` enforces a strict line length limit:

- **Default Limit**: `1,048,576` bytes (1 MB).
- **Behavior**: If an incoming stream chunk exceeds the limit without encountering a newline delimiter, the parser throws an `AdapterParsingError` and clears the buffer.

### Line Ending Normalization

The parser natively supports both Unix (`\n`) and Windows (`\r\n`) line endings. Carriage return characters (`\r`) at line ends are stripped prior to JSON parsing.

### Incremental Chunk Handling

Data can arrive in arbitrary byte chunks (e.g. splitting across JSON object boundaries). Unfinished lines are held in an internal buffer until the next chunk or until `flush()` is invoked.

### Flush Behavior

Calling `parser.flush()` forces any remaining non-empty buffered text to be parsed as a final line. If the final buffered text is invalid JSON, an `AdapterParsingError` is raised and the buffer is cleared.

---

## 3. Supported Input Formats

The `generic-jsonl` adapter supports two input formats:

### 3.1 Canonical AOE Protocol Envelopes (Direct Ingestion)

If the JSON object already matches the `@aoe/protocol` specification, the adapter validates the envelope and ingests it directly:

```json
{"protocolVersion":"1.0.0","eventId":"evt_01","sessionId":"sess_1","sequence":1,"timestamp":"2026-11-03T12:00:00.000Z","eventType":"session.started","payload":{"agentName":"custom-agent","agentVersion":"1.0.0"}}
{"protocolVersion":"1.0.0","eventId":"evt_02","sessionId":"sess_1","sequence":2,"timestamp":"2026-11-03T12:00:01.000Z","eventType":"task.started","payload":{"taskId":"task_1","taskName":"Compile Project"}}
{"protocolVersion":"1.0.0","eventId":"evt_03","sessionId":"sess_1","sequence":3,"timestamp":"2026-11-03T12:00:02.000Z","eventType":"task.completed","payload":{"taskId":"task_1","verified":true,"resultSummary":"Build succeeded"}}
```

### 3.2 Generic / Simplified Event Objects

For third-party agents emitting simplified JSON events with `event` (or `type`) and payload data:

```json
{"event":"start","agent":"my-agent"}
{"event":"task_start","taskId":"build","name":"Building binary"}
{"event":"progress","taskId":"build","percentage":50,"current":5,"total":10}
{"event":"file_change","path":"src/index.ts","action":"modified","added":12,"removed":2}
{"event":"task_complete","taskId":"build","summary":"Built in 1.2s"}
{"event":"end"}
```

The adapter maps these simplified forms to canonical `@aoe/protocol` events:

- `start` / `session_start` -> `session.started`
- `task_start` -> `task.started`
- `progress` -> `progress.updated`
- `file_change` -> `file.changed`
- `task_complete` -> `task.completed`
- `task_fail` -> `task.failed`
- `log` -> `log.emitted`
- `error` -> `error.occurred`
- `end` / `session_end` -> `session.ended`

---

## 4. Usage Example

```typescript
import { JsonlAdapter, createAdapterSession } from '@aoe/adapters';

const adapter = new JsonlAdapter();
const session = createAdapterSession({
  adapterId: adapter.id,
  agentName: 'custom-ci-agent',
});

// Process incoming chunk from process.stdin
const chunk = `{"event":"task_start","taskId":"test-1","name":"Unit Tests"}\n`;
const events = adapter.normalize(chunk, session);

for (const event of events) {
  console.log(`[AOE Canonical Event] ${event.eventType} (seq: ${event.sequence})`);
}
```
