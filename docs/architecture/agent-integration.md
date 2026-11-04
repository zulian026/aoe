# Agent Integration Architecture

This document describes the universal adapter architecture implemented in `@zyanx04/adapters` (Milestone 06) for the AOE (Agent Output Enhancement) system.

## 1. Architectural Role and Boundaries

AOE separates execution intelligence from presentation. External AI coding agents (such as Claude Code, Gemini CLI, Cursor, or custom pipelines) emit proprietary event formats, JSON streams, or CLI hook payloads.

The `@zyanx04/adapters` package serves as the bridge:

- It normalizes heterogenous, proprietary inputs into canonical, validated AOE protocol envelopes (`@zyanx04/protocol`).
- It manages session correlation, monotonic sequence numbers, and task lifecycles without leaking vendor-specific abstractions into `@zyanx04/core`.
- It enforces strict privacy and security policies (scrubbing secrets, eliminating chain-of-thought scratchpads, and forbidding command execution).

```text
       External AI Coding Agents (Claude Code, Gemini CLI, Generic JSONL)
                                    |
                                    v (Proprietary Hooks / Stream JSON)
                          +-------------------+
                          |  @zyanx04/adapters    |
                          |  (AdapterManager) |
                          +---------+---------+
                                    |
                                    v (Canonical Protocol Envelopes)
                          +-------------------+
                          |  @zyanx04/protocol    |
                          +---------+---------+
                                    |
                                    v (Validated AoeEvent Stream)
                          +-------------------+
                          |    @zyanx04/core      |
                          | (Session/Task/UI) |
                          +---------+---------+
                                    |
                                    v (Immutable SessionSnapshot)
                          +-------------------+
                          |  @zyanx04/renderer    |
                          +---------+---------+
                                    |
                                    v (Design Tokens / Themes)
                          +-------------------+
                          |  @zyanx04/components  |
                          +---------+---------+
                                    |
                                    v
                               Terminal UI
```

---

## 2. Core Contracts & Types

### 2.1 AgentAdapter

Every integration implements the `AgentAdapter` interface:

```typescript
export interface AgentAdapter {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly state: AdapterLifecycleState;

  initialize(context?: AdapterContext): Promise<void> | void;
  detect(context: AdapterContext): AdapterDetectionResult;
  normalize(input: unknown, session: AdapterSession): AoeEvent[] | Promise<AoeEvent[]>;
  dispose(): Promise<void> | void;
}
```

### 2.2 AdapterLifecycleState

Adapters transition across well-defined lifecycle states:

- `uninitialized`: Adapter has been instantiated but not yet configured.
- `ready`: Adapter is initialized, dependencies validated, and ready for sessions.
- `active`: Adapter is actively processing events for one or more sessions.
- `paused`: Temporarily suspended from processing events.
- `disposed`: Tear-down complete; all resources released.

### 2.3 AdapterContext

Detection and initialization pass a read-only environment context:

```typescript
export interface AdapterContext {
  readonly env?: Record<string, string | undefined>;
  readonly cwd?: string;
  readonly argv?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}
```

### 2.4 AdapterDetectionResult

Detection produces a deterministic confidence score:

- `'high'`: Explicit environment variables, exact CLI binary flags, or specific hook payload signatures matched.
- `'medium'`: Ambient workspace configuration or directory structures found (e.g. `.claude/` or `.gemini/`).
- `'low'`: Fallback heuristic match (e.g., standard JSON/JSONL stream format).
- `'none'`: No indicators present.

### 2.5 AdapterSession

The `AdapterSession` encapsulates session identity, monotonic sequence progression, and task mapping:

```typescript
export interface AdapterSession {
  readonly sessionId: string;
  readonly adapterId: string;
  readonly agentName: string;
  readonly status: AdapterSessionStatus; // 'active' | 'ended' | 'disposed'
  readonly metadata: Readonly<Record<string, unknown>>;

  nextSequence(): number;
  currentSequence(): number;
  mapTaskId(agentTaskId: string): string;
  getOriginalTaskId(aoeTaskId: string): string | undefined;
  end(): void;
  dispose(): void;
}
```

---

## 3. Adapter Lifecycle Manager (`AdapterManager`)

The `AdapterManager` orchestrates the ecosystem of adapters:

1. **Registration**: Validates uniqueness and registers adapter instances.
2. **Detection Cascade**: Iterates registered adapters and evaluates detection confidence (`high` -> `medium` -> `low`), falling back to `generic-jsonl` if ambiguous.
3. **Session Routing**: Binds sessions to specific adapters and tracks active sessions.
4. **Event Ingestion**: Ingests raw chunks or structured objects, delegates normalization to the bound adapter, and dispatches resulting `AoeEvent` objects to registered listeners.
5. **Failure Isolation**: Errors thrown by an adapter or hook payload parser are caught, wrapped into typed `AdapterError` instances, and isolated—preventing cascading engine failures.
6. **Resource Cleanup**: Disposes individual sessions and adapters cleanly on teardown.

---

## 4. Sequence Integrity and Task Correlation

### Monotonic Sequence Numbers

The AOE Protocol requires strictly monotonic, gapless sequence numbers per session (`1, 2, 3, ...`). Individual agent tools or streaming logs may emit unordered or sparse IDs. The `AdapterSession` maintains an internal sequence counter and guarantees that every emitted event increments monotonically.

### Task Correlation

Agents like Claude Code and Gemini CLI identify tasks by tool use IDs (e.g. `toolu_01...` or `call_abc...`). The adapter session maps these foreign IDs to canonical AOE task identifiers (`task_1`, `task_2`, ...) while retaining reverse lookups for diagnostics.

---

## 5. Security & Privacy Guarantees

AOE adapters enforce strict privacy and security invariants:

1. **Credential Masking (`maskSecrets`)**:
   - Bearer / JWT tokens are replaced with `Bearer [REDACTED]`.
   - Anthropic / OpenAI keys (`sk-...`) are replaced with `sk-[REDACTED]`.
   - Google API keys (`AIza...`) are replaced with `AIza[REDACTED]`.
   - AWS credentials (`AKIA...`) are masked.
   - Key-value pairs (`api_key=...`, `password=...`, `auth_token=...`) are sanitized.

2. **Elimination of Private Reasoning (`stripPrivateReasoning`)**:
   - Model chain-of-thought scratchpads (`<thought>`, `<scratchpad>`, `<antThinking>`, `<internal_reasoning>`) are completely stripped before reaching the protocol layer.
   - Pure-reasoning payloads emit no visible logs.

3. **Control Character Sanitization (`sanitizeAgentText`)**:
   - Unprintable ANSI/ASCII control codes (`\x00-\x08`, `\x0B-\x0C`, `\x0E-\x1F`) are removed while preserving necessary formatting (`\n`, `\r`, `\t`).

4. **Zero Execution Policy**:
   - Adapters **never** execute shell commands, launch sub-processes, or automatically mutate files or configuration. Adapters are purely passive ingestion and normalization pipelines.
