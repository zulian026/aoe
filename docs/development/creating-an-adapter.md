# Creating a New Agent Adapter

This guide details how to implement, test, and register a new agent integration adapter in AOE using the `@zyanx04/adapters` framework.

---

## 1. Overview

An adapter bridges an external agent’s proprietary execution data to canonical AOE Protocol events.

```text
External Agent Output -> AgentAdapter.normalize() -> Canonical AoeEvents -> AdapterManager -> Engine
```

When building an adapter, follow these guidelines:

1. **Never perform side-effects**: Do not run shell commands or execute agent binaries.
2. **Never expose private thoughts**: Use `stripPrivateReasoning` or `sanitizeAgentText` on all free-form text.
3. **Mask sensitive tokens**: Use `maskSecrets` to redact passwords, JWTs, and API keys.
4. **Enforce monotonic sequences**: Always allocate sequence numbers via `session.nextSequence()`.

---

## 2. Implementing the Contract

Create a class that implements `AgentAdapter`:

```typescript
import {
  AgentAdapter,
  AdapterContext,
  AdapterDetectionResult,
  AdapterLifecycleState,
  AdapterSession,
  sanitizeAgentText,
} from '@zyanx04/adapters';
import { AoeEvent, PROTOCOL_VERSION } from '@zyanx04/protocol';

export class CustomAgentAdapter implements AgentAdapter {
  public readonly id = 'custom-agent';
  public readonly name = 'Custom Agent Adapter';
  public readonly version = '0.1.0';
  public state: AdapterLifecycleState = 'uninitialized';

  public initialize(context?: AdapterContext): void {
    this.state = 'ready';
  }

  public detect(context: AdapterContext): AdapterDetectionResult {
    // 1. Check environment variables
    if (context.env?.CUSTOM_AGENT_ACTIVE === 'true') {
      return { detected: true, confidence: 'high', details: 'CUSTOM_AGENT_ACTIVE set' };
    }

    // 2. Check metadata
    if (context.metadata?.agent === 'custom-agent') {
      return { detected: true, confidence: 'high' };
    }

    return { detected: false, confidence: 'none' };
  }

  public normalize(input: unknown, session: AdapterSession): AoeEvent[] {
    const raw = typeof input === 'string' ? JSON.parse(input) : input;
    const events: AoeEvent[] = [];

    if (raw.type === 'job_started') {
      events.push({
        protocolVersion: PROTOCOL_VERSION,
        eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        sessionId: session.sessionId,
        sequence: session.nextSequence(),
        timestamp: new Date().toISOString(),
        eventType: 'task.started',
        payload: {
          taskId: session.mapTaskId(raw.jobId),
          taskName: sanitizeAgentText(raw.title || 'Execute Job'),
        },
      });
    }

    return events;
  }

  public dispose(): void {
    this.state = 'disposed';
  }
}
```

---

## 3. Key Implementation Requirements

### 3.1 Task Mapping & Sequence Guarantees

Use `session.mapTaskId(agentTaskId)` to map proprietary agent IDs into canonical AOE task IDs. Always call `session.nextSequence()` to populate the envelope `sequence` field.

### 3.2 Error Handling

Throw domain-specific typed errors:

- `AdapterParsingError`: When raw input cannot be parsed (e.g. malformed JSON).
- `AdapterValidationError`: When payload schema fails validation.
- `AdapterSessionError`: When session state operations fail.

### 3.3 Data Sanitization

Sanitize all agent strings before constructing payload fields:

```typescript
import { sanitizeAgentText, maskSecrets, stripPrivateReasoning } from '@zyanx04/adapters';

const safeMessage = sanitizeAgentText(rawEvent.message);
```

---

## 4. Testing Your Adapter

Write unit and integration tests using `vitest`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createAdapterSession } from '@zyanx04/adapters';
import { CustomAgentAdapter } from './custom-agent-adapter.js';

describe('CustomAgentAdapter', () => {
  let adapter: CustomAgentAdapter;

  beforeEach(() => {
    adapter = new CustomAgentAdapter();
    adapter.initialize();
  });

  it('detects high confidence when env is set', () => {
    const result = adapter.detect({ env: { CUSTOM_AGENT_ACTIVE: 'true' } });
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe('high');
  });

  it('normalizes job_started into task.started', () => {
    const session = createAdapterSession({ adapterId: adapter.id, agentName: 'custom' });
    const events = adapter.normalize(
      { type: 'job_started', jobId: 'j1', title: 'Compile' },
      session,
    );

    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('task.started');
    expect(events[0].sequence).toBe(1);
    expect((events[0].payload as any).taskName).toBe('Compile');
  });
});
```

---

## 5. Registering with the Manager

Register your adapter instance with `AdapterManager`:

```typescript
import { AdapterManager } from '@zyanx04/adapters';
import { CustomAgentAdapter } from './custom-agent-adapter.js';

const manager = new AdapterManager();
const customAdapter = new CustomAgentAdapter();

manager.registerAdapter(customAdapter);

// Discover best adapter for current environment
const detection = manager.detectAdapter({
  env: process.env,
});

console.log(`Detected: ${detection.adapter?.id} (confidence: ${detection.confidence})`);
```
