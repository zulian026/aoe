# AOE Universal Event Protocol — Serialization & Wire Format

## 1. Wire Format Specifications

The AOE Universal Event Protocol uses **Line-Delimited JSON (JSONL / NDJSON)** over standard streams (pipes, sockets, or stdin/stdout).

- **Line Delimiter**: `\n` (ASCII `0x0A` / Line Feed).
- **Encoding**: UTF-8 without byte order mark (BOM).
- **Max Event Size**: Recommended maximum line length is 1 MB. Large payloads (such as file diffs or logs) should be chunked across events or referenced via artifact paths.
- **Embedded Newlines**: Event JSON bodies must never contain raw unescaped newlines. Internal newlines (e.g. in log messages or stack traces) must be escaped as `\n`.

---

## 2. Serialization API

Exported by `@zyanx04/protocol`:

```typescript
import {
  serializeEvent,
  parseEvent,
  safeParseEvent,
  validateEvent,
  parseEventStream,
} from '@zyanx04/protocol';
```

### `serializeEvent(event, options?)`

Serializes a typed `AoeEvent` into a single JSON line:

```typescript
const jsonLine = serializeEvent(event, { newline: true, validate: true });
```

- **Deterministic Key Ordering**: Object keys are recursively sorted lexicographically to produce deterministic, reproducible byte representations.
- **Validation on Serialization**: Validates against Zod schema prior to serialization unless `validate: false` is explicitly passed.

### `parseEvent(line)`

Parses a single JSONL line into a validated `AoeEvent`. Throws `ProtocolError` on syntax error, empty line, or schema mismatch:

```typescript
try {
  const event = parseEvent(rawLine);
} catch (err) {
  if (err instanceof ProtocolError) {
    console.error(`Error [${err.code}]:`, err.message);
  }
}
```

### `safeParseEvent(line)`

Non-throwing parser returning a discriminated union:

```typescript
const result = safeParseEvent(rawLine);
if (result.success) {
  handleEvent(result.data);
} else {
  handleError(result.error);
}
```

---

## 3. Stream Parsing & Partial Line Buffering

In network pipes or streaming subprocesses, chunks rarely align perfectly with line boundaries. `parseEventStream` maintains an internal string buffer to reassemble split lines across chunk boundaries:

```typescript
import { parseEventStream } from '@zyanx04/protocol';

async function ingestStream(chunks: AsyncIterable<string>) {
  for await (const event of parseEventStream(chunks, {
    skipMalformed: false, // Invariant: no silent data loss by default
    onError: (err, rawLine) => {
      console.error('Failed to parse line:', rawLine, err);
    },
  })) {
    processEvent(event);
  }
}
```

### Chunk Reassembly Mechanism

```
Chunk 1: '{"protocolVersion":"1.0.0","eventId":"evt_1","sess'
         ▲
         └── Incomplete line buffered in memory

Chunk 2: 'ionId":"s1","sequence":0,"timestamp":"2026-11-03T10:00:00.000Z","eventType":"session.started","payload":{"agent":{"name":"codex"},"workingDirectory":"/app"}}\n'
         ▲
         └── Buffer concatenated, complete line extracted and emitted
```

---

## 4. Error Handling & ProtocolError Codes

All parsing failures raise or return a typed `ProtocolError`:

| Error Code          | Trigger Condition                                                                       |
| :------------------ | :-------------------------------------------------------------------------------------- |
| `EMPTY_LINE_ERROR`  | An empty string or whitespace-only line was passed to `parseEvent`.                     |
| `JSON_SYNTAX_ERROR` | Line contains invalid JSON (unclosed brackets, unescaped characters, truncated syntax). |
| `VALIDATION_ERROR`  | JSON syntax is valid, but payload or envelope violates Zod schema rules.                |

---

## 5. Wire Examples

### Valid Stream Fragment (2 lines)

```jsonl
{"eventId":"evt_1","eventType":"session.started","payload":{"agent":{"name":"claude-code"},"workingDirectory":"/app"},"protocolVersion":"1.0.0","sequence":0,"sessionId":"sess_100","timestamp":"2026-11-03T10:00:00.000Z"}
{"eventId":"evt_2","eventType":"task.started","payload":{"taskId":"task_1","taskName":"Compile Project"},"protocolVersion":"1.0.0","sequence":1,"sessionId":"sess_100","timestamp":"2026-11-03T10:00:01.000Z"}
```

### Invalid Stream Lines (Handled with ProtocolError)

```jsonl
// Invalid Line 1: Truncated JSON
{"protocolVersion":"1.0.0","eventId":"evt_1"

// Invalid Line 2: Empty line


// Invalid Line 3: Schema failure (sequence is string instead of number)
{"protocolVersion":"1.0.0","eventId":"evt_3","sessionId":"s1","sequence":"zero","timestamp":"2026-11-03T10:00:00.000Z","eventType":"session.started","payload":{"agent":{"name":"agent"},"workingDirectory":"/app"}}
```
