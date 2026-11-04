# @zyanx04/components

Reusable React and Ink terminal UI components for AOE (Agent Output Enhancement).

## Overview

`@zyanx04/components` contains the presentation building blocks used by `@zyanx04/renderer` and interactive terminal applications. Built on Ink 8 and React 19, these components handle layout, text wrapping, secret masking, and terminal sanitization.

## Components

- **`ProgressBar`**: Smooth visual progress indicator supporting percentages, work units, and estimates.
- **`StatusIndicator`**: Semantic execution status badge with optional spinner animation.
- **`TaskSummary`**: Hierarchical task tree rendering with depth indentation and status markers.
- **`FileChangeView`**: Clean file mutation list with disk verification evidence badges (`[✓ disk]`).
- **`DiagnosticsPanel`**: Grouped errors, warnings, and hints with remediation suggestions and hypothesis markers.
- **`ExecutionLog`**: Sliding tail window of execution logs with timestamps and log level badges.
- **`ResultView`**: Structured final summary panel displaying execution metrics, exit codes, and artifacts.
- **`Panel`**: Styled container box with borders and titles.
- **`Table`**: Column-aligned tabular data presenter.

## Built-in Security

Every text string rendered by `@zyanx04/components` automatically undergoes:

- **Terminal Escape Sanitization** (`sanitizeTerminalText`): Strips dangerous OSC sequences, cursor repositioning escapes, unprintable ASCII bytes, and Trojan Source Unicode BiDi overrides.
- **Secret Masking** (`maskSecrets`): Redacts API keys, Bearer tokens, GitHub credentials, AWS access keys, and private keys.

## Installation

```bash
npm install @zyanx04/components @zyanx04/themes react ink
# or
pnpm add @zyanx04/components @zyanx04/themes react ink
```

## Quick Start

```tsx
import React from 'react';
import { render } from 'ink';
import { ProgressBar, StatusIndicator, TaskSummary, ThemeProvider } from '@zyanx04/components';
import { OBSIDIAN_THEME } from '@zyanx04/themes';

const App = () => (
  <ThemeProvider theme={OBSIDIAN_THEME}>
    <StatusIndicator status="running" label="Executing compilation" />
    <ProgressBar completedWork={3} totalWork={10} unit="files" description="Compiling TypeScript" />
  </ThemeProvider>
);

render(<App />);
```

## License

MIT
