# @aoe/renderer

Hybrid terminal rendering engine orchestrating interactive Ink apps and linear static outputs for AOE (Agent Output Enhancement).

## Overview

`@aoe/renderer` connects `@aoe/core` state management with `@aoe/components` presentation. It intelligently selects between **Interactive TTY** rendering (using Ink 8 and React 19) and **Static Non-TTY** rendering (using line-buffered plain text), guaranteeing clean output in every terminal environment.

## Features

- **Hybrid Mode Selection**:
  - `auto`: Automatically detects whether the output stream is an interactive TTY, a CI runner, or a pipe, choosing `interactive` or `static`.
  - `interactive`: Uses full-screen Ink rendering with animated status spinners and live progress updates.
  - `static`: Uses `StaticRenderer` to emit clean linear text without cursor movement escapes—ideal for CI pipelines, log files, or dumb terminals.
- **Environment Detection**: Detects `isTTY`, `isCI`, `supportsColor`, `getColorDepth`, and terminal dimensions, clamping columns/rows to safe minimums.
- **Color & Style Fallbacks**: Respects `NO_COLOR` and `FORCE_COLOR` specifications.
- **Alternate Screen & Cursor Management**: Gracefully saves and restores terminal cursor state upon exit or interruption.

## Installation

```bash
npm install @aoe/renderer @aoe/core @aoe/components @aoe/themes
# or
pnpm add @aoe/renderer @aoe/core @aoe/components @aoe/themes
```

## Quick Start

```typescript
import { TerminalRenderer, StaticRenderer } from '@aoe/renderer';
import { Engine } from '@aoe/core';

const engine = new Engine();

// Create interactive renderer bound to an engine session
const renderer = new TerminalRenderer({
  engine,
  sessionId: 'session-1',
  mode: 'auto',
  theme: 'obsidian',
});

await renderer.start();

// Update engine state...
// renderer updates terminal dynamically!

// Conclude and restore terminal
await renderer.stop();
```

### Direct Static Rendering

```typescript
import { StaticRenderer } from '@aoe/renderer';

const staticRenderer = new StaticRenderer({
  stream: process.stdout,
  noColor: false,
});

staticRenderer.render(snapshot);
```

## License

MIT
