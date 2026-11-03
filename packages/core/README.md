# @aoe/core

Core state management, event ingestion, and session lifecycle engine for AOE (Agent Output Enhancement).

## Overview

`@aoe/core` transforms validated canonical protocol events (`@aoe/protocol`) into structured, stateful session data. It maintains task hierarchies, aggregates progress metrics, verifies file changes, enforces lifecycle state transitions, and emits immutable session snapshots.

## Features

- **Session Management**: Tracks independent sessions with explicit status transitions (`active`, `completed`, `failed`, `cancelled`).
- **Sequence Integrity & Deduplication**: Detects missing or duplicate events and enforces sequence ordering via a bounded buffer.
- **Hierarchical Tasks**: Supports arbitrary task tree depth with parent-child relationships and status aggregation.
- **Progress Tracking**: Aggregates completion percentages, estimates, and work units.
- **File Change State**: Tracks file additions, modifications, renames, and disk evidence verification.
- **Immutable Snapshots**: Emits frozen state snapshots to subscribers on every state change.

## Installation

```bash
npm install @aoe/core @aoe/protocol
# or
pnpm add @aoe/core @aoe/protocol
```

## Quick Start

```typescript
import { Engine, type SessionSnapshot } from '@aoe/core';
import type { AoeEvent } from '@aoe/protocol';

const engine = new Engine();

// Subscribe to state updates for a session
const unsubscribe = engine.subscribe('session-1', (snapshot: SessionSnapshot) => {
  console.log(`Session status: ${snapshot.status}`);
  console.log(`Active tasks: ${snapshot.tasks.length}`);
});

// Ingest canonical events
engine.processEvent({
  protocolVersion: '1.0.0',
  eventId: 'evt-1',
  sessionId: 'session-1',
  sequence: 1,
  timestamp: new Date().toISOString(),
  eventType: 'session.started',
  payload: {
    workingDirectory: '/home/user/project',
    agent: { name: 'claude-code', version: '1.0.0' },
  },
});

// Retrieve an immediate state snapshot
const snapshot = engine.getSessionSnapshot('session-1');
```

## Architecture

- `Engine`: Primary public façade orchestrating event processing, deduplication, and subscriber dispatching.
- `SessionManager`: Manages session instances, lifecycle state transitions, and sequence trackers.
- `SequenceTracker`: Tracks sequential event ordering and buffers out-of-order events.
- `TaskManager`: Manages hierarchical task trees and status propagation.
- `ProgressTracker`: Tracks multi-step progress, estimates, and verified units.
- `StateDispatcher`: Publishes immutable session snapshots to listeners.

## License

MIT
