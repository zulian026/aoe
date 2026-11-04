# Terminal Compatibility & Accessibility Guide

## 1. Environment Detection Strategy

The AOE Terminal Renderer is built to operate reliably across modern interactive terminals, minimal terminal emulators, CI build environments, and piped Unix filters.

```typescript
import {
  detectEnvironmentCapabilities,
  isTTY,
  isCI,
  supportsColor,
  getColorDepth,
  getTerminalDimensions,
} from '@zyanx04/renderer';

const caps = detectEnvironmentCapabilities(process.stdout);
console.log(caps);
// {
//   isTTY: true,
//   isCI: false,
//   hasColor: true,
//   colorDepth: 24,
//   dimensions: { columns: 120, rows: 40 },
//   supportsAlternateScreen: true
// }
```

## 2. Color Standards & Accessibility

### A. The `NO_COLOR` Specification

In accordance with [no-color.org](https://no-color.org/):

- If `process.env.NO_COLOR` is set and non-empty, all ANSI color codes are completely disabled.
- Status, progress, and badges fall back to textual indicators (`[OK]`, `[FAIL]`, `[RUN]`, `[WARN]`, `[BLOCKED]`).

### B. The `FORCE_COLOR` Specification

- If `process.env.FORCE_COLOR` is set and not `'0'`, color output is forced on even when stdout is not detected as a TTY.

### C. Terminal Color Depth Fallbacks

- **24-bit TrueColor**: Full hex colors from Obsidian palette (`#00F090`, `#FFB800`, `#FF3366`, `#00D2FF`, `#8A2BE2`).
- **8-bit / 256 Colors**: Mapped by Ink/chalk.
- **4-bit / 16 Colors**: Mapped to standard ANSI color names.
- **Monochrome / 1-bit**: Plain text formatting with no color sequences.

## 3. Terminal Dimensions & Resize Handling

### Clamping & Fallbacks

When running in environments where terminal size cannot be probed (e.g. headless child processes, mocked streams, or virtual terminals):

- Columns default to `80`, rows default to `24`.
- Columns are clamped to a minimum safe width of `20`.
- Rows are clamped to a minimum safe height of `5`.

### Dynamic Window Resizing

1. Listeners are registered to `stdout.on('resize')`.
2. Upon receipt of window size change, dimensions are updated via `getTerminalDimensions()`.
3. The active `SessionSnapshot` is rerendered with new width boundaries, re-wrapping text and recalculating progress bar widths.
4. Listeners are removed cleanly upon `renderer.stop()`.

## 4. TTY vs Non-TTY Matrix

| Feature                    | Interactive TTY               | Non-TTY / Pipe / CI    |
| -------------------------- | ----------------------------- | ---------------------- |
| **Render Mode**            | `interactive` (Ink)           | `static` (Linear text) |
| **Progress Animation**     | Live update (same line / box) | Incremental snapshot   |
| **Alternate Screen**       | Supported (`\x1b[?1049h`)     | Never activated        |
| **Cursor Repositioning**   | Used by Ink layout            | Never emitted          |
| **Screen Clearing**        | Used on resize / update       | Never emitted          |
| **ANSI Control Stripping** | Safe rendering                | Fully sanitized        |

## 5. Known Limitations & Edge Cases

1. **Terminal Emulators without TrueColor**:
   - Some legacy terminal emulators on older Linux/Windows distributions do not support 24-bit TrueColor. Colors are automatically quantized to 256 or 16 colors.
2. **Extremely Narrow Terminals (< 40 columns)**:
   - In terminals narrower than 40 columns, long task names or paths will truncate aggressively to prevent layout wrapping artifacts.
3. **Piped Output Formatting**:
   - When piped into tools like `grep` or `less`, static mode emits newline-terminated plain text to preserve stream compatibility without escape character mangling.
