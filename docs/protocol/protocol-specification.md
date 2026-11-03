# AOE Universal Event Protocol Specification

## 1. Overview

The **AOE Universal Event Protocol** is a versioned, schema-validated, line-delimited JSON (JSONL) protocol designed to transmit structured operational telemetry from AI coding agents and external tools to the AOE Presentation Engine.

- **Protocol Name**: `aoe`
- **Protocol Version**: `1.0.0`
- **Wire Format**: Line-Delimited JSON (JSONL / NDJSON)
- **Character Encoding**: UTF-8
- **Schema Validation Engine**: Zod (v3.24+)

---

## 2. Event Envelope Structure

Every protocol event conforms to a standardized envelope containing routing and sequencing metadata alongside a typed payload:

```typescript
export interface BaseEnvelope {
  protocolVersion: '1.0.0';
  eventId: string;
  sessionId: string;
  sequence: number;
  timestamp: string;
  eventType: string;
  payload: Record<string, unknown>;
}
```

### Field Definitions

| Field             | Type      | Constraint           | Description                                                         |
| :---------------- | :-------- | :------------------- | :------------------------------------------------------------------ |
| `protocolVersion` | `string`  | Literal `'1.0.0'`    | Major/minor/patch semver string of protocol specification.          |
| `eventId`         | `string`  | Min 1, Max 128 chars | Globally unique event identifier (e.g. `evt_...` or UUIDv4).        |
| `sessionId`       | `string`  | Min 1, Max 128 chars | Unique identifier of the active execution session.                  |
| `sequence`        | `integer` | `≥ 0`                | Monotonically increasing sequence number (0-indexed per session).   |
| `timestamp`       | `string`  | ISO 8601 UTC         | Millisecond-precision UTC timestamp (`YYYY-MM-DDTHH:mm:ss.sssZ`).   |
| `eventType`       | `string`  | Canonical enum       | Dot-notated domain event type (e.g. `task.started`).                |
| `payload`         | `object`  | Discriminated Schema | Strongly-typed payload strictly validated according to `eventType`. |

---

## 3. Envelope Examples

### Valid Envelope Example

```json
{
  "protocolVersion": "1.0.0",
  "eventId": "evt_01h9x7b6_a1b2c3d4",
  "sessionId": "sess_20261103_worker1",
  "sequence": 0,
  "timestamp": "2026-11-03T10:00:00.000Z",
  "eventType": "session.started",
  "payload": {
    "agent": {
      "name": "claude-code",
      "version": "1.2.0"
    },
    "workingDirectory": "/home/zyan/Projects/aoe"
  }
}
```

### Invalid Envelope Examples

#### 1. Unsupported Protocol Version

```json
{
  "protocolVersion": "2.0.0",
  "eventId": "evt_1",
  "sessionId": "sess_1",
  "sequence": 0,
  "timestamp": "2026-11-03T10:00:00.000Z",
  "eventType": "session.started",
  "payload": { "agent": { "name": "codex" }, "workingDirectory": "/app" }
}
```

_Failure Reason_: `protocolVersion` must equal `'1.0.0'`. Protocol version negotiation rejects incompatible major versions.

#### 2. Negative Sequence Number

```json
{
  "protocolVersion": "1.0.0",
  "eventId": "evt_1",
  "sessionId": "sess_1",
  "sequence": -1,
  "timestamp": "2026-11-03T10:00:00.000Z",
  "eventType": "log.emitted",
  "payload": { "level": "info", "message": "Starting" }
}
```

_Failure Reason_: `sequence` must be a non-negative integer.

#### 3. Malformed Timestamp

```json
{
  "protocolVersion": "1.0.0",
  "eventId": "evt_1",
  "sessionId": "sess_1",
  "sequence": 1,
  "timestamp": "yesterday at 5pm",
  "eventType": "log.emitted",
  "payload": { "level": "info", "message": "Starting" }
}
```

_Failure Reason_: `timestamp` must be a valid ISO 8601 UTC formatted string.
