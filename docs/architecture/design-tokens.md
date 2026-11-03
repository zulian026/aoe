# AOE Design Tokens Specification

## 1. Overview

Design tokens are the foundational visual values of the AOE presentation system. All visual decisions in `@aoe/components` and `@aoe/renderer` are driven by these semantic tokens, eliminating hardcoded hex codes, colors, and styling across the codebase.

---

## 2. Color Palette Tokens (`tokens.colors`)

Every theme defines 16 semantic color tokens. Values can be hex color strings (e.g., `#00bcd4`), ANSI 16 named colors (e.g., `cyan`, `greenBright`), or ANSI 256 color codes.

| Token              | Semantic Purpose                   | Typical Usage                                          |
| ------------------ | ---------------------------------- | ------------------------------------------------------ |
| `background`       | Primary terminal canvas background | Base application background                            |
| `surface`          | Card or container background       | Panel backgrounds, code blocks                         |
| `surfaceMuted`     | Subtle alternating background      | Table alternate rows, active highlights                |
| `foreground`       | Primary body text                  | General text, task titles, file paths                  |
| `foregroundMuted`  | Secondary supporting text          | Timestamps, durations, parent paths, unverified badges |
| `foregroundSubtle` | De-emphasized text                 | Inactive items, faint indicators                       |
| `primary`          | Primary accent / brand color       | Panel headers, table headers, progress bars            |
| `secondary`        | Secondary accent color             | Section titles, summary statistics, highlights         |
| `accent`           | High-visibility attention color    | Special indicators, key callouts                       |
| `selection`        | Selection background / highlight   | Active cursor, highlighted items                       |
| `success`          | Positive outcome / completion      | Completed tasks, added lines (`+`), verified badge     |
| `warning`          | Caution / degradation / estimate   | Modified lines (`~`), estimated progress, warnings     |
| `error`            | Failure / deletion / blocker       | Failed tasks, deleted lines (`-`), error diagnostics   |
| `info`             | Neutral informational telemetry    | Renamed files (`->`), logs, diagnostic info            |
| `border`           | Primary framing border             | Outer panel borders, section dividers                  |
| `borderMuted`      | Subtle / secondary border          | Inner table dividers, sub-item separators              |

---

## 3. Status Color Tokens (`tokens.status`)

Status tokens map directly to task and session lifecycle states:

| Status Token | Lifecycle State    | Meaning                                      |
| ------------ | ------------------ | -------------------------------------------- |
| `idle`       | Inactive / Pending | Task created or enqueued, not yet executing  |
| `running`    | Executing          | Actively executing work                      |
| `blocked`    | Blocked / Waiting  | Awaiting prerequisite task or external input |
| `warning`    | Degraded Execution | Executing with non-fatal warnings            |
| `completed`  | Succeeded          | Execution finished successfully              |
| `failed`     | Failed             | Execution finished with an error             |
| `cancelled`  | Aborted            | Execution halted by user or agent            |

---

## 4. Typography Tokens (`tokens.typography`)

Typography tokens define standard text formatting rules:

| Token       | Type      | Semantic Meaning                                  |
| ----------- | --------- | ------------------------------------------------- |
| `bold`      | `boolean` | Strong visual prominence (headers, active states) |
| `dim`       | `boolean` | Reduced prominence for auxiliary metadata         |
| `italic`    | `boolean` | Secondary emphasis, notes                         |
| `underline` | `boolean` | Hyperlinks and actionable targets                 |

---

## 5. Spacing Scale (`tokens.spacing`)

Terminal interfaces operate in discrete character cell grids. The spacing scale standardizes cell offsets:

| Token  | Columns / Rows | Semantic Usage                      |
| ------ | -------------- | ----------------------------------- |
| `none` | 0              | Flush alignment                     |
| `xs`   | 1              | Minimal separator, inline padding   |
| `sm`   | 2              | Standard list indent, label spacing |
| `md`   | 4              | Section margin, block indent        |
| `lg`   | 8              | Major container separation          |

---

## 6. Symbol Sets (`tokens.symbols`)

Each symbol is defined as a `SymbolPair` containing both a Unicode glyph and an ASCII equivalent for low-capability terminals.

### Status Symbols

| Symbol Token | Unicode | ASCII    | Description                  |
| ------------ | ------- | -------- | ---------------------------- |
| `running`    | `●`     | `*`      | Actively running indicator   |
| `completed`  | `✔`     | `[OK]`   | Successful completion badge  |
| `failure`    | `✖`     | `[FAIL]` | Error / failure badge        |
| `blocked`    | `■`     | `[BLKD]` | Blocked indicator            |
| `warning`    | `▲`     | `[WARN]` | Warning indicator            |
| `info`       | `ℹ`     | `[INFO]` | Informational badge          |
| `idle`       | `○`     | `[IDLE]` | Queued / unstarted indicator |
| `cancelled`  | `—`     | `[CANC]` | Aborted indicator            |

### Tree & Hierarchy Symbols

| Symbol Token     | Unicode | ASCII     | Description                      |
| ---------------- | ------- | --------- | -------------------------------- |
| `treeBranch`     | `├─ `   | `\|-- `   | Intermediate tree item connector |
| `treeLastBranch` | `└─ `   | `` `-- `` | Terminal tree item connector     |
| `treeVertical`   | `│  `   | `\|   `   | Tree continuation vertical bar   |

### Progress Symbols

| Symbol Token     | Unicode | ASCII | Description              |
| ---------------- | ------- | ----- | ------------------------ |
| `progressFilled` | `█`     | `=`   | Filled progress bar cell |
| `progressEmpty`  | `░`     | `-`   | Empty progress bar cell  |

### Metadata & Evidence Badges

| Symbol Token | Unicode  | ASCII    | Description                     |
| ------------ | -------- | -------- | ------------------------------- |
| `disk`       | `✓ disk` | `[disk]` | Verified on disk evidence badge |
| `hypothesis` | `?`      | `?`      | Diagnostic hypothesis tag       |

---

## 7. Legacy Compatibility Tokens

To preserve full compatibility with components and renderers written during M00–M04, every normalized theme also provides flat token aliases on `theme.tokens`:

```typescript
// Legacy flat token mapping
theme.tokens.primary === theme.tokens.colors.primary;
theme.tokens.secondary === theme.tokens.colors.secondary;
theme.tokens.success === theme.tokens.colors.success;
theme.tokens.warning === theme.tokens.colors.warning;
theme.tokens.error === theme.tokens.colors.error;
theme.tokens.info === theme.tokens.colors.info;
theme.tokens.muted === theme.tokens.colors.foregroundMuted;
theme.tokens.border === theme.tokens.colors.border;
theme.tokens.background === theme.tokens.colors.background;
theme.tokens.surface === theme.tokens.colors.surface;
theme.dark === (theme.colorScheme === 'dark');
```
