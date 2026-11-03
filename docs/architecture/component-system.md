# Component System Architecture

## 1. Overview

The `@aoe/components` package provides typed, modular, and terminal-first presentation components. Each component is decoupled from state-management logic and consumes plain props to format and render information with Ink and terminal text streams.

## 2. Component Catalog

| Component              | Responsibility                                                  | Key Properties                                                                            |
| ---------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **`StatusIndicator`**  | Status badges for sessions and tasks                            | `status`, `label`, `animated`, `spinnerFrame`, `unicode`, `noColor`                       |
| **`ProgressBar`**      | Determinate and indeterminate progress visualization            | `completedWork`, `totalWork`, `verifiedWork`, `isEstimate`, `percentage`, `width`, `mode` |
| **`Panel`**            | Bounded box container with titles and metadata                  | `title`, `metadata`, `width`, `borderStyle`, `noColor`                                    |
| **`TaskSummary`**      | Hierarchical task tree with status and durations                | `tasks`, `maxDepth`, `width`, `unicode`, `noColor`                                        |
| **`FileChangeView`**   | Displays file mutations with deltas and verified evidence       | `changes`, `maxItems`, `width`, `unicode`, `noColor`                                      |
| **`DiagnosticsPanel`** | Groups diagnostics by severity, highlights hypotheses           | `diagnostics`, `maxItems`, `width`, `unicode`, `noColor`                                  |
| **`ExecutionLog`**     | Bounded tail-buffered log stream with secret masking            | `logs`, `maxLines`, `mode`, `noColor`                                                     |
| **`ResultView`**       | Final result cards across artifact, metric, and test categories | `results`, `sessionStatus`, `width`, `unicode`, `noColor`                                 |
| **`Table`**            | Minimal tabular data display                                    | `columns`, `data`, `noColor`                                                              |

## 3. Detailed Component Specifications

### 3.1 StatusIndicator

- **Semantic States**: `running`, `completed`, `failed`, `blocked`, `warning`, `idle`, `cancelled`.
- **Integrity Guarantee**: Never renders `completed` without verified state.
- **Fallbacks**: Renders `[OK]`, `[FAIL]`, `[RUN]`, `[WARN]`, `[BLOCKED]`, `[IDLE]`, `[CANCELLED]` in ASCII mode.

### 3.2 ProgressBar

- **Mathematical Safety**: Defends against division by zero, NaN, and negative total work by entering indeterminate mode (`[----?----]`).
- **Estimation Transparency**: When `isEstimate: true`, labels are explicitly prefixed (e.g. `~45% (est)`).
- **Evidence Verification**: Highlights `verifiedWork` count when distinct from `completedWork`.
- **Clamping**: Bar visual width is clamped to safe minimums and available container width.

### 3.3 TaskSummary

- **Hierarchical Tree**: Renders root tasks and nested child tasks using tree connectors (`├─`, `└─`, `│  `).
- **Depth Clamping**: Clamps visual indentation depth to prevent layout breaks on deeply nested task graphs.
- **Duration**: Formats elapsed execution times cleanly (`450ms`, `1.2s`, `2m 15s`).

### 3.4 FileChangeView

- **Action Badges**: `+ CREATED`, `~ MODIFIED`, `- DELETED`, `-> RENAMED`.
- **Line Deltas**: Formats `(+added -removed)` only when real diff data exists. Never synthesizes deltas.
- **Evidence Semantics**: Emits `[disk]` or `[verified]` only when filesystem verification exists. Unverified claims are flagged as `[unverified]`.
- **Path Compaction**: Safely truncates long paths in the middle (`packages/.../FileChangeView.tsx`).

### 3.5 DiagnosticsPanel

- **Severity Ordering**: Strictly groups and sorts by `error` -> `warning` -> `info`.
- **Hypothesis Distinction**: Flagged explicitly with `[HYPOTHESIS]`. Never misrepresents speculative diagnostics as confirmed errors.
- **Location & Remediation**: Formats `path:line:col`, root cause, and suggested remediation when provided.

### 3.6 ExecutionLog

- **Secret Masking**: Automatically redacts API keys (`sk-...`, `AKIA...`, `ghp_...`), Bearer tokens, passwords, and private keys.
- **Reasoning Suppression**: Filters out internal private thoughts (`<thought>`, `<scratchpad>`) to prevent leaking private agent reasoning.
- **ANSI Sanitization**: Strips dangerous terminal escape sequences (cursor repositions, screen title changes).
- **Bounded Buffer**: Maintains a tail buffer of the most recent lines with hidden count indicators.

### 3.7 ResultView

- **Categories**: `artifact`, `metric`, `summary`, `test_results`.
- **Outcome Status**: Tracks `success`, `failure`, and `incomplete`.
- **Factual Representation**: Does not declare success merely because a result block was rendered.

## 4. Theme & Color Resolution

Components leverage `resolveThemeColor(token, theme, noColor)`:

- Respects `NO_COLOR` environment variable globally.
- Respects component-level `noColor: true` override.
- Maps semantic tokens (`primary`, `secondary`, `success`, `warning`, `error`, `info`, `muted`, `border`) to Obsidian theme palette values.
