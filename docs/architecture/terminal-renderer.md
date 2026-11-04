# Terminal Renderer Architecture

## 1. Overview

The AOE Terminal Renderer (`@zyanx04/renderer`) coordinates presentation of structured AI coding agent execution states in terminal environments. It subscribes to immutable state updates (`SessionSnapshot`) produced by `@zyanx04/core` and renders them through modular UI components (`@zyanx04/components`) using Ink, Yoga, and ANSI streams.

```
AI Agent / Event Producer
          │
          ▼
   @zyanx04/protocol
          │
          ▼
      @zyanx04/core (SessionSnapshot)
          │
          ▼
    @zyanx04/renderer (Orchestrator)
    ├── Mode Detection (auto | interactive | static)
    ├── Terminal Environment (TTY, CI, NO_COLOR, Resize)
    └── Lifecycle & Restoration (SIGINT, SIGTERM, Screen Buffers)
          │
          ▼
    @zyanx04/components (Presentation Elements)
    └── Terminal UI (Interactive Ink or Linear Static Stream)
```

## 2. Package Responsibilities & Boundaries

- **`@zyanx04/core`**: Owns business and session execution state, ingests protocol events, sequence integrity, deduplication, and snapshot immutability. Contains zero terminal rendering logic.
- **`@zyanx04/renderer`**: Coordinates rendering lifecycle, manages subscriptions to the core engine, resolves TTY/non-TTY modes, monitors terminal dimensions and signals (`SIGWINCH`, `SIGINT`, `SIGTERM`), and isolates rendering exceptions.
- **`@zyanx04/components`**: Provides reusable, typed presentation components (status badges, progress bars, task summaries, file changes, diagnostics, logs, results). Contains no dependencies on Core Engine internals.
- **`@zyanx04/themes`**: Supplies semantic design tokens and color palettes (such as Obsidian theme).

## 3. Public API Specification

### Instantiation & Options

```typescript
import { Engine } from '@zyanx04/core';
import { TerminalRenderer, type TerminalRendererOptions } from '@zyanx04/renderer';

const engine = new Engine();
const sessionId = 'sess_abc123';

const renderer = new TerminalRenderer({
  engine,
  sessionId,
  mode: 'auto', // 'auto' | 'interactive' | 'static'
  theme: OBSIDIAN_THEME,
  useAlternateScreen: false,
  animated: false,
  noColor: false,
  unicode: true,
});

await renderer.start();

// Optionally append log entries or results dynamically
renderer.addLog({ level: 'info', message: 'API connection established' });
renderer.addResult({ category: 'summary', title: 'Task Completed' });

// Stop rendering and clean up resources
await renderer.stop();
```

### Methods

| Method                     | Signature       | Description                                                                                             |
| -------------------------- | --------------- | ------------------------------------------------------------------------------------------------------- |
| `start()`                  | `Promise<void>` | Resolves mode, hooks terminal resize/signals, subscribes to engine session, and renders initial state.  |
| `renderSnapshot(snapshot)` | `void`          | Renders an update using either interactive or static renderer.                                          |
| `addLog(log)`              | `void`          | Appends a structured log entry and rerenders.                                                           |
| `addResult(result)`        | `void`          | Appends a structured result item and rerenders.                                                         |
| `stop()`                   | `Promise<void>` | Unsubscribes from engine, unhooks resize/signal listeners, unmounts Ink UI, and restores cursor/screen. |
| `initialize()`             | `Promise<void>` | Backward-compatible alias for `start()`.                                                                |
| `render(state)`            | `void`          | Backward-compatible method accepting `RenderState` or `SessionSnapshot`.                                |
| `dispose()`                | `Promise<void>` | Backward-compatible alias for `stop()`.                                                                 |

## 4. Rendering Modes

### A. Auto Mode (`mode: 'auto'`)

Inspects runtime terminal environment capabilities via `isInteractiveSuitable()`:

- If standard output is a TTY and not in CI (`CI=true`) and not a dumb terminal (`TERM=dumb`), selects **Interactive Mode**.
- Otherwise, automatically falls back to **Static Mode**.

### B. Interactive Mode (`mode: 'interactive'`)

- Employs Ink 8 and React 19 to render an interactive full-screen or inline layout.
- Rerenders reactively when `engine` dispatches new `SessionSnapshot` updates.
- Supports optional alternate screen buffer (`\x1b[?1049h` / `\x1b[?1049l`).
- Restores terminal cursor visibility upon exit.

### C. Static Mode (`mode: 'static'`)

- Linear text and ANSI formatting suitable for headless CI runners, pipes, or file redirection (`aoe-output | tee run.log`).
- Emits clean incremental status lines upon state transitions without clearing screens or moving cursors.
- Strips ANSI sequences when `NO_COLOR` is detected or terminal is monochrome.

## 5. Signal Handling and Lifecycle Cleanup

1. **`SIGWINCH` (Terminal Resize)**:
   - When stdout fires `resize`, `TerminalRenderer` recalculates available dimensions and rerenders the active snapshot.
   - Resize listeners are cleanly detached upon calling `stop()`.
2. **`SIGINT` / `SIGTERM` (Process Termination)**:
   - Listeners are attached during `start()` to trap termination signals.
   - Upon signal receipt, `renderer.stop()` unmounts Ink instances, restores the main screen buffer, unhides the cursor (`\x1b[?25h`), and terminates with standard exit codes (130 for SIGINT, 143 for SIGTERM).

## 6. Error Isolation & Fault Tolerance

Rendering errors are caught and isolated in `renderSnapshot()`:

- A failure in rendering or formatting never throws back into the Core Engine pipeline.
- State integrity in `@zyanx04/core` remains strictly protected.
