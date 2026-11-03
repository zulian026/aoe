# AOE Theme Engine Architecture

## 1. Overview & Vision

The AOE Theme Engine (`@aoe/themes`) is a centralized, extensible semantic styling system for terminal user interfaces in AOE (Agent Output Enhancement).

Its purpose is to:

- Decouple all visual and cosmetic decisions from presentation components and rendering infrastructure.
- Provide a strictly validated, deeply immutable design-token contract.
- Support runtime theme switching without restarting session subscriptions or dropping execution state.
- Guarantee full accessibility compliance, color suppression (`NO_COLOR`), force color override (`FORCE_COLOR`), and graceful ASCII fallback across diverse terminal environments.

```text
┌─────────────────────────────────────────────────────────────┐
│                       @aoe/themes                           │
│   Contracts & Zod Schemas │ ThemeRegistry │ Resolver Engine │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
       @aoe/components                  @aoe/renderer
   (ThemeProvider, useTheme)        (Runtime Theme Switching)
               │                               │
               └───────────────┬───────────────┘
                               ▼
                          Terminal UI
```

---

## 2. Package Boundaries & Dependencies

`@aoe/themes` is positioned at the foundational layer of the presentation stack:

- **Zero dependencies on presentation packages**: `@aoe/themes` never imports from `@aoe/components`, `@aoe/renderer`, or `@aoe/core`.
- **Pure data & contracts**: Themes are serializable, schema-validated data structures. No arbitrary executable functions are allowed within theme definitions.
- **Deep immutability**: All registered themes are deep-frozen via `deepFreeze()` upon validation to prevent accidental runtime mutations.

---

## 3. Theme Contract & Design Tokens

Every AOE theme complies with the `AoeThemeSchema` and is typed as `AoeTheme`.

```typescript
export interface AoeTheme {
  id: string; // Unique slug: 'obsidian', 'light', 'high-contrast'
  name: string; // Identifier alias
  displayName: string; // Human-readable label: 'Obsidian Dark'
  description?: string; // Summary of theme aesthetics
  author?: string; // Creator / maintainer
  version: string; // SemVer (e.g. '1.0.0')
  colorScheme: 'dark' | 'light'; // Base color scheme
  tokens: ThemeTokens; // Comprehensive semantic token dictionary
  dark?: boolean; // Backward-compatible boolean alias
}
```

### Token Subsystems

1. **`tokens.colors` (16 Semantic Palette Tokens)**:
   - Surface: `background`, `surface`, `surfaceMuted`
   - Content: `foreground`, `foregroundMuted`, `foregroundSubtle`
   - Brand & Accents: `primary`, `secondary`, `accent`, `selection`
   - Semantic Feedback: `success`, `warning`, `error`, `info`
   - Borders: `border`, `borderMuted`

2. **`tokens.status` (7 Lifecycle State Tokens)**:
   - `idle`, `running`, `blocked`, `warning`, `completed`, `failed`, `cancelled`

3. **`tokens.typography`**:
   - `bold`: boolean
   - `dim`: boolean
   - `italic`: boolean
   - `underline`: boolean

4. **`tokens.spacing`**:
   - `none`: 0
   - `xs`: 1
   - `sm`: 2
   - `md`: 4
   - `lg`: 8

5. **`tokens.symbols` (Unicode & ASCII Pairs)**:
   - Status: `running`, `completed`, `failure`, `blocked`, `warning`, `info`, `idle`, `cancelled`
   - Visual: `bullet`, `check`, `cross`, `triangle`, `circle`, `square`, `dash`
   - Hierarchy: `treeBranch`, `treeLastBranch`, `treeVertical`
   - Progress: `progressFilled`, `progressEmpty`
   - Badges: `disk`, `hypothesis`

---

## 4. Built-In Themes

AOE ships with three built-in themes:

| Theme ID               | Name               | Color Scheme | Target Environment                                                    |
| ---------------------- | ------------------ | ------------ | --------------------------------------------------------------------- |
| `obsidian` _(default)_ | Obsidian Dark      | `dark`       | Deep dark terminals (truecolor / 256-color), cyan/magenta accents     |
| `light`                | AOE Light          | `light`      | Bright / off-white terminals, accessible high-contrast daytime coding |
| `high-contrast`        | High Contrast Dark | `dark`       | Maximum contrast accessibility, ANSI bright primary colors            |

---

## 5. ThemeRegistry

The `ThemeRegistry` provides deterministic theme management:

```typescript
const registry = new ThemeRegistry(); // Pre-populated with built-in themes

// Querying
registry.has('obsidian'); // true
registry.get('light'); // Returns deep-frozen AoeTheme
registry.list(); // Returns array of all registered themes
registry.getDefault(); // Returns default AoeTheme (obsidian)

// Registering Custom Themes
registry.register(customTheme); // Validates and deep-freezes
registry.register(overrideTheme, { replace: true }); // Allows explicit replacement

// Setting Default
registry.setDefault('light');
```

### Safety Guarantees

- **Duplicate ID rejection**: Throws `DuplicateThemeError` unless `{ replace: true }` is explicitly passed.
- **Strict schema validation**: Throws `ThemeValidationError` on missing or malformed tokens.
- **Missing theme safety**: Throws `ThemeNotFoundError` listing available IDs if a requested theme does not exist.

---

## 6. Capability Resolution Engine (`resolver.ts`)

The resolver mediates between theoretical theme tokens and actual terminal capabilities:

1. **`NO_COLOR` Standards**:
   If `NO_COLOR` is present in the environment (and not overridden by `FORCE_COLOR`), all color tokens evaluate to `undefined`, allowing Ink and ANSI formatters to emit plain text.
2. **`FORCE_COLOR` Override**:
   If `FORCE_COLOR` is set (e.g. `FORCE_COLOR=1`), color suppression is disabled even if `NO_COLOR` is present.
3. **Symbol Glyphs**:
   `resolveSymbol(name, theme, unicode)` returns the Unicode glyph if `unicode === true`, or falls back to ASCII text representation (e.g., `✔` vs `[OK]`, `├─ ` vs `|-- `).
4. **Color Depth Fallback**:
   Hex color codes (e.g., `#61afef`) gracefully map to standard ANSI color names in restricted color depth terminals.

---

## 7. Component & Renderer Integration

### Component Integration (`@aoe/components`)

- `ThemeProvider`: Top-level React context provider supplying the active `AoeTheme`.
- `useTheme(explicitTheme?)`: Hook returning active theme from context, falling back to `OBSIDIAN_THEME`.
- All 9 components (`StatusIndicator`, `ProgressBar`, `Panel`, `TaskSummary`, `FileChangeView`, `DiagnosticsPanel`, `ExecutionLog`, `ResultView`, `Table`) consume tokens via `useTheme()` and support explicit `theme` prop override.

### Renderer Integration (`@aoe/renderer`)

- `TerminalRendererOptions.theme` accepts either a theme ID string (`'obsidian' | 'light' | 'high-contrast'`) or an `AoeTheme` object.
- `renderer.setTheme(newTheme)` allows switching themes dynamically at runtime.
- Runtime theme switches immediately trigger a re-render of the latest snapshot without restarting engine subscriptions or resetting task progress.
