# Visual Formatting Reference

## Purpose

The AOE Visual Formatting Reference establishes layout, typography, and glyph standards for terminal presentation. Whether rendered through a full-featured terminal emulator or a minimal CI log viewer, outputs must remain clean, scannable, and visually coherent without breaking line wrapping or rendering garbled symbols.

---

## Rules

1. **Standard Markdown Foundation**: Always use GitHub Flavored Markdown (GFM) constructs: tables, fenced code blocks with language identifiers, blockquotes, and lists.
2. **Terminal Width Awareness**: Target standard 80-to-100 column terminal widths. Keep table columns compact and avoid excessively long continuous horizontal strings that wrap awkwardly.
3. **Glyph Hierarchy & ASCII Fallback**:
   - Primary (Unicode): Use standard Unicode symbols: `✓` (success), `✖` (failure), `▲` (warning), `●` (in progress), `○` (pending), `→` (transition).
   - Fallback (ASCII): When terminal UTF-8 support is uncertain or absent, degrade cleanly to ASCII: `[v]`, `[x]`, `[!]`, `[*]`, `[ ]`, `->`.
4. **Semantic Color Tokens**: Rely on semantic token concepts rather than hardcoded ANSI escape sequences in markdown text:
   - Success / Done: Green / `#00F090`
   - Failure / Error: Red / `#FF3366`
   - Warning: Amber / `#FFB800`
   - Info / Accent: Cyan / Blue / `#00D2FF`
   - Muted / Neutral: Slate Gray / `#6C757D`
5. **No Visual Bloat**: Avoid gratuitous ASCII art, giant banners, rainbow text effects, or nested boxes that consume terminal vertical real estate unnecessarily.

---

## Formatting Conventions

### Compact Markdown Tables

```markdown
| Indicator | State   | Scope     | Description             |
| :-------: | :------ | :-------- | :---------------------- |
|    `✓`    | Success | `auth`    | Password hash verified  |
|    `✖`    | Failure | `session` | Token signature expired |
|    `▲`    | Warning | `cache`   | TTL threshold reached   |
```

### Callouts and Alerts

Use GitHub-style alert blockquotes for key notices:

```markdown
> [!NOTE] Background context, implementation details, or explanations
> [!TIP] Performance optimizations, best practices, or efficiency suggestions
> [!IMPORTANT] Essential requirements, critical steps, or must-know information
> [!WARNING] Breaking changes, compatibility issues, or potential problems
> [!CAUTION] High-risk actions that could cause data loss or security vulnerabilities
```

---

## Good Examples

### Good Example 1: Balanced Density Table with Status Glyphs

```markdown
### Test Suite Summary

| Status | Suite               | Tests | Duration | Exit Code |
| :----: | :------------------ | :---: | :------: | :-------: |
|  `✓`   | `packages/protocol` |  3/3  |   14ms   |     0     |
|  `✓`   | `packages/themes`   |  1/1  |   8ms    |     0     |
|  `✓`   | `packages/core`     |  2/2  |   11ms   |     0     |
|  `✓`   | `apps/cli`          |  1/1  |   18ms   |     0     |
```

### Good Example 2: Clean Section Hierarchy with Code Blocks

````markdown
## Configuration Changes

Updated server port fallback in `src/config.ts`:

```typescript
export const PORT = Number(process.env.PORT ?? 3000);
```
````

> [!NOTE] The fallback defaults to port `3000` when running in development mode.

````

---

## Bad Examples

### Bad Example 1: Huge ASCII Banners & Broken Formatting

```markdown
<!-- BAD: Giant ASCII banner wasting vertical space and overflowing terminal width -->
  ____  _   _  ____ ____ _____ ____ ____  _
 / ___|| | | |/ ___/ ___| ____/ ___/ ___|| |
 \___ \| | | | |  | |   |  _| \___ \___ \| |
  ___) | |_| | |__| |___| |___ ___) |__) |_|
 |____/ \___/ \____\____|_____|____/____/(_)
````

_Why this is bad_: Consumes 10+ vertical terminal lines without delivering technical value and wraps horribly on smaller screens.

### Bad Example 2: Wide Tables with Overflow

```markdown
<!-- BAD: Extremely wide columns that cause chaotic terminal line wraps -->

| Id | Super Long Complete Absolute File Path Across The Entire User Filesystem Directory Structure | Raw Stack Trace Log With Hundreds Of Characters Per Line |
```

_Why this is bad_: Triggers multi-line horizontal wrapping that shreds table readability on standard 80-column screens.

---

## Edge Cases

1. **Monochrome Terminals (No ANSI Color)**:
   - Structure text so meaning is never communicated solely through color. Always pair color with text or glyphs (`[x] Failure` rather than just a red dot).
2. **Narrow Viewports (Mobile / Split Panes < 60 columns)**:
   - When output is viewed in narrow split terminal panes, prefer bulleted key-value lists over wide markdown tables.
3. **Piped Output / Non-TTY Redirects**:
   - When redirecting to a file (`> output.log`), standard markdown remains clean and human-readable without raw ANSI escape artifacts.
