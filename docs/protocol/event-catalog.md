# AOE Universal Event Protocol — Event Catalog

This catalog details the twelve canonical events supported by the AOE Universal Event Protocol (`v1.0.0`). Every event is validated via Zod schemas in `@aoe/protocol`.

---

## 1. Session Domain Events

### `session.started`

- **Purpose**: Signals session initialization and provides agent metadata.
- **Payload Schema**:
  - `agent`: `{ name: string, version?: string, environment?: string }` (Required)
  - `workingDirectory`: string (Required)
  - `parentSessionId`: string (Optional)
  - `metadata`: record (Optional)
- **Valid Example**:
  ```json
  {
    "protocolVersion": "1.0.0",
    "eventId": "evt_sess_start_01",
    "sessionId": "sess_100",
    "sequence": 0,
    "timestamp": "2026-11-03T10:00:00.000Z",
    "eventType": "session.started",
    "payload": {
      "agent": { "name": "gemini-cli", "version": "2.4.0" },
      "workingDirectory": "/workspace"
    }
  }
  ```
- **Invalid Example**:
  ```json
  {
    "eventType": "session.started",
    "payload": { "workingDirectory": "/workspace" }
  }
  ```
  _(Fails: missing required `agent.name` object)._

---

### `session.ended`

- **Purpose**: Signals normal, failed, or cancelled completion of an active session.
- **Payload Schema**:
  - `status`: `'completed' | 'failed' | 'cancelled'` (Required)
  - `exitCode`: integer (Optional)
  - `durationMs`: non-negative integer (Optional)
  - `summary`: string (Optional)
  - `stats`: `{ tasksTotal?, tasksCompleted?, tasksFailed?, filesChanged?, errorsCount?, warningsCount? }` (Optional)
- **Valid Example**:
  ```json
  {
    "protocolVersion": "1.0.0",
    "eventId": "evt_sess_end_01",
    "sessionId": "sess_100",
    "sequence": 24,
    "timestamp": "2026-11-03T10:05:00.000Z",
    "eventType": "session.ended",
    "payload": {
      "status": "completed",
      "durationMs": 300000,
      "stats": { "tasksTotal": 4, "tasksCompleted": 4, "filesChanged": 6 }
    }
  }
  ```

---

## 2. Task Lifecycle Domain Events

### `task.started`

- **Purpose**: Registers and starts an atomic or composite unit of work.
- **Payload Schema**:
  - `taskId`: string (Required)
  - `taskName`: string (Required)
  - `description`: string (Optional)
  - `parentTaskId`: string (Optional)
  - `depth`: non-negative integer (Optional)
  - `metadata`: record (Optional)
- **Valid Example**:
  ```json
  {
    "protocolVersion": "1.0.0",
    "eventId": "evt_task_01",
    "sessionId": "sess_100",
    "sequence": 1,
    "timestamp": "2026-11-03T10:00:01.000Z",
    "eventType": "task.started",
    "payload": {
      "taskId": "task_auth_01",
      "taskName": "Implement JWT Middleware",
      "description": "Construct token verification filter"
    }
  }
  ```

---

### `task.updated`

- **Purpose**: Updates intermediate status or message of an active task.
- **Payload Schema**:
  - `taskId`: string (Required)
  - `status`: `'idle' | 'running' | 'blocked' | 'warning'` (Required)
  - `message`: string (Optional)
  - `reason`: string (Optional)
- **Valid Example**:
  ```json
  {
    "protocolVersion": "1.0.0",
    "eventId": "evt_task_02",
    "sessionId": "sess_100",
    "sequence": 2,
    "timestamp": "2026-11-03T10:00:10.000Z",
    "eventType": "task.updated",
    "payload": {
      "taskId": "task_auth_01",
      "status": "running",
      "message": "Generating RSA key pairs"
    }
  }
  ```

---

### `task.completed`

- **Purpose**: Terminal completion of a task. Requires verification assertion.
- **Payload Schema**:
  - `taskId`: string (Required)
  - `resultSummary`: string (Required)
  - `verified`: boolean (Required)
  - `durationMs`: non-negative integer (Optional)
  - `deliverables`: string array (Optional)
- **Valid Example**:
  ```json
  {
    "protocolVersion": "1.0.0",
    "eventId": "evt_task_03",
    "sessionId": "sess_100",
    "sequence": 5,
    "timestamp": "2026-11-03T10:01:00.000Z",
    "eventType": "task.completed",
    "payload": {
      "taskId": "task_auth_01",
      "resultSummary": "JWT middleware verified with 8 unit tests",
      "verified": true,
      "durationMs": 59000
    }
  }
  ```

---

### `task.failed`

- **Purpose**: Terminal failure or unrecoverable error during task execution.
- **Payload Schema**:
  - `taskId`: string (Required)
  - `error`: `{ code: string, message: string, stack?: string }` (Required)
  - `durationMs`: non-negative integer (Optional)
  - `recoverable`: boolean (Optional)
- **Valid Example**:
  ```json
  {
    "protocolVersion": "1.0.0",
    "eventId": "evt_task_fail_01",
    "sessionId": "sess_100",
    "sequence": 6,
    "timestamp": "2026-11-03T10:01:10.000Z",
    "eventType": "task.failed",
    "payload": {
      "taskId": "task_auth_01",
      "error": {
        "code": "ERR_CRYPTO_UNSUPPORTED",
        "message": "Node crypto engine lacks required curve algorithm"
      },
      "recoverable": false
    }
  }
  ```

---

## 3. Progress Domain Events

### `progress.updated`

- **Purpose**: Reports deterministic progress metrics. Strictly validates progress integrity.
- **Payload Schema**:
  - `completedWork`: non-negative number (Required)
  - `isEstimate`: boolean (Required)
  - `totalWork`: positive number (Optional)
  - `currentWork`: string (Optional)
  - `verifiedWork`: non-negative number (Optional)
  - `unit`: string (Optional)
  - `description`: string (Optional)
  - `taskId`: string (Optional)
- **Integrity Refinements**:
  - When `isEstimate` is `false` and `totalWork` is defined: `completedWork <= totalWork`.
  - When `verifiedWork` is defined: `verifiedWork <= completedWork`.
- **Valid Example**:
  ```json
  {
    "protocolVersion": "1.0.0",
    "eventId": "evt_prog_01",
    "sessionId": "sess_100",
    "sequence": 3,
    "timestamp": "2026-11-03T10:00:20.000Z",
    "eventType": "progress.updated",
    "payload": {
      "taskId": "task_auth_01",
      "completedWork": 4,
      "totalWork": 8,
      "isEstimate": false,
      "verifiedWork": 4,
      "unit": "suites",
      "currentWork": "Running integration suite 5"
    }
  }
  ```
- **Invalid Example**:
  ```json
  {
    "eventType": "progress.updated",
    "payload": {
      "completedWork": 10,
      "totalWork": 8,
      "isEstimate": false
    }
  }
  ```
  _(Fails: `completedWork (10)` exceeds `totalWork (8)` when `isEstimate` is false)._

---

## 4. Log Domain Events

### `log.emitted`

- **Purpose**: Structured output emission from process execution or compilers.
- **Payload Schema**:
  - `level`: `'debug' | 'info' | 'warn' | 'error'` (Required)
  - `message`: string (Required)
  - `stream`: `'stdout' | 'stderr'` (Optional)
  - `source`: string (Optional)
  - `taskId`: string (Optional)
  - `metadata`: record (Optional)
- **Valid Example**:
  ```json
  {
    "protocolVersion": "1.0.0",
    "eventId": "evt_log_01",
    "sessionId": "sess_100",
    "sequence": 4,
    "timestamp": "2026-11-03T10:00:25.000Z",
    "eventType": "log.emitted",
    "payload": {
      "level": "info",
      "message": "TypeScript compilation succeeded in 420ms",
      "stream": "stdout",
      "source": "tsc"
    }
  }
  ```

---

## 5. File Change Domain Events

### `file.changed`

- **Purpose**: Reports verified file modifications.
- **Payload Schema**:
  - `action`: `'CREATED' | 'MODIFIED' | 'DELETED' | 'RENAMED'` (Required)
  - `path`: string (Required)
  - `evidence`: `{ verifiedOnDisk: boolean, hash?: string, sizeBytes?: number }` (Required)
  - `oldPath`: string (Required only when `action === 'RENAMED'`)
  - `lineDelta`: `{ added: integer, removed: integer }` (Optional)
  - `description`: string (Optional)
  - `taskId`: string (Optional)
- **Valid Example**:
  ```json
  {
    "protocolVersion": "1.0.0",
    "eventId": "evt_file_01",
    "sessionId": "sess_100",
    "sequence": 7,
    "timestamp": "2026-11-03T10:02:00.000Z",
    "eventType": "file.changed",
    "payload": {
      "action": "CREATED",
      "path": "src/auth/jwt.ts",
      "lineDelta": { "added": 64, "removed": 0 },
      "evidence": { "verifiedOnDisk": true, "sizeBytes": 1820 },
      "description": "JWT creation and verification routines"
    }
  }
  ```
- **Invalid Example**:
  ```json
  {
    "eventType": "file.changed",
    "payload": {
      "action": "RENAMED",
      "path": "src/new.ts",
      "evidence": { "verifiedOnDisk": true }
    }
  }
  ```
  _(Fails: `RENAMED` action requires `oldPath`)._

---

## 6. Diagnostic Domain Events

### `diagnostic.emitted`

- **Purpose**: Reports compiler diagnostics, lint notices, or runtime warnings.
- **Payload Schema**:
  - `severity`: `'error' | 'warning' | 'info'` (Required)
  - `message`: string (Required)
  - `isHypothesis`: boolean (Required)
  - `code`: string (Optional)
  - `location`: `{ path: string, line: integer, column?: integer, endLine?: integer, endColumn?: integer }` (Optional)
  - `rootCause`: string (Optional)
  - `suggestedRemediation`: string (Optional)
  - `taskId`: string (Optional)
- **Valid Example**:
  ```json
  {
    "protocolVersion": "1.0.0",
    "eventId": "evt_diag_01",
    "sessionId": "sess_100",
    "sequence": 8,
    "timestamp": "2026-11-03T10:02:15.000Z",
    "eventType": "diagnostic.emitted",
    "payload": {
      "severity": "error",
      "code": "TS2339",
      "message": "Property 'token' does not exist on type 'UserSession'",
      "isHypothesis": false,
      "location": { "path": "src/auth/jwt.ts", "line": 42, "column": 18 },
      "rootCause": "UserSession interface has not been updated with optional token field",
      "suggestedRemediation": "Add 'token?: string' to UserSession in src/types.ts"
    }
  }
  ```

---

## 7. Result Domain Events

### `result.produced`

- **Purpose**: Emits verified deliverable outcomes, metrics, or test summaries.
- **Payload Schema**:
  - `category`: `'artifact' | 'metric' | 'summary' | 'test_results'` (Required)
  - `title`: string (Required)
  - `data`: record (Required)
  - `artifactPath`: string (Optional)
  - `taskId`: string (Optional)
- **Valid Example**:
  ```json
  {
    "protocolVersion": "1.0.0",
    "eventId": "evt_res_01",
    "sessionId": "sess_100",
    "sequence": 9,
    "timestamp": "2026-11-03T10:03:00.000Z",
    "eventType": "result.produced",
    "payload": {
      "category": "test_results",
      "title": "Authentication Integration Suite",
      "data": { "passed": 18, "failed": 0, "durationMs": 1420 }
    }
  }
  ```

---

## 8. Operational Error Domain Events

### `error.occurred`

- **Purpose**: Emits system or unhandled operational errors outside normal task execution.
- **Payload Schema**:
  - `code`: string (Required)
  - `message`: string (Required)
  - `severity`: `'fatal' | 'recoverable'` (Required)
  - `details`: record (Optional)
  - `stack`: string (Optional)
  - `suggestedAction`: string (Optional)
  - `taskId`: string (Optional)
- **Valid Example**:
  ```json
  {
    "protocolVersion": "1.0.0",
    "eventId": "evt_err_01",
    "sessionId": "sess_100",
    "sequence": 10,
    "timestamp": "2026-11-03T10:03:30.000Z",
    "eventType": "error.occurred",
    "payload": {
      "code": "ERR_DISK_EXHAUSTION",
      "message": "Temporary directory has insufficient space for build artifacts",
      "severity": "fatal",
      "suggestedAction": "Clean /tmp directory or allocate additional disk storage"
    }
  }
  ```
