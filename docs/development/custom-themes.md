# Creating and Registering Custom Themes

## 1. Overview

AOE features an extensible Theme Engine that allows developers and consumers to define, validate, and register custom visual themes.

All custom themes are strictly validated against `AoeThemeSchema` and deep-frozen upon registration to guarantee runtime immutability and presentation safety.

---

## 2. Defining a Custom Theme

A custom theme is a pure JavaScript object adhering to the `AoeTheme` contract:

```typescript
import { type AoeTheme, OBSIDIAN_THEME } from '@aoe/themes';

export const SOLARIZED_DARK_THEME: AoeTheme = {
  id: 'solarized-dark',
  name: 'solarized-dark',
  displayName: 'Solarized Dark',
  description: 'Precision colors for machines and people based on Ethan Schoonover palette',
  author: 'AOE Community',
  version: '1.0.0',
  colorScheme: 'dark',
  tokens: {
    colors: {
      background: '#002b36',
      surface: '#073642',
      surfaceMuted: '#586e75',
      foreground: '#839496',
      foregroundMuted: '#657b83',
      foregroundSubtle: '#586e75',
      primary: '#268bd2',
      secondary: '#2aa198',
      accent: '#d33682',
      selection: '#073642',
      success: '#859900',
      warning: '#b58900',
      error: '#dc322f',
      info: '#2aa198',
      border: '#586e75',
      borderMuted: '#073642',
    },
    status: {
      idle: '#586e75',
      running: '#268bd2',
      blocked: '#b58900',
      warning: '#cb4b16',
      completed: '#859900',
      failed: '#dc322f',
      cancelled: '#657b83',
    },
    typography: {
      bold: true,
      dim: true,
      italic: false,
      underline: false,
    },
    spacing: {
      none: 0,
      xs: 1,
      sm: 2,
      md: 4,
      lg: 8,
    },
    symbols: {
      ...OBSIDIAN_THEME.tokens.symbols, // Re-use standard symbols or customize
    },
  },
};
```

---

## 3. Validating and Registering Themes

### Using `ThemeRegistry`

```typescript
import { defaultRegistry, validateTheme, ThemeRegistry } from '@aoe/themes';
import { SOLARIZED_DARK_THEME } from './solarized-dark.js';

// 1. Validate independently if needed
const validated = validateTheme(SOLARIZED_DARK_THEME);
console.log(Object.isFrozen(validated)); // true

// 2. Register into the global default registry
defaultRegistry.register(SOLARIZED_DARK_THEME);

// 3. Or create an isolated registry instance
const customRegistry = new ThemeRegistry();
customRegistry.register(SOLARIZED_DARK_THEME);
```

### Registration Options

- **Duplicate Prevention**: Attempting to register an already-registered theme ID throws `DuplicateThemeError`.
- **Replacement**: Pass `{ replace: true }` to explicitly overwrite an existing registration:
  ```typescript
  defaultRegistry.register(UPDATED_THEME, { replace: true });
  ```

---

## 4. Consuming Custom Themes

### In `TerminalRenderer`

```typescript
import { TerminalRenderer } from '@aoe/renderer';

// Option A: Specify registered theme ID
const renderer = new TerminalRenderer({
  theme: 'solarized-dark',
});

// Option B: Pass theme object directly
const renderer2 = new TerminalRenderer({
  theme: SOLARIZED_DARK_THEME,
});

// Option C: Switch theme dynamically at runtime
renderer.setTheme('solarized-dark');
```

### In React Presentation Components

```tsx
import React from 'react';
import { ThemeProvider, Panel, StatusIndicator } from '@aoe/components';
import { SOLARIZED_DARK_THEME } from './solarized-dark.js';

export const MyTerminalApp = () => {
  return (
    <ThemeProvider theme={SOLARIZED_DARK_THEME}>
      <Panel title="Solarized Execution">
        <StatusIndicator status="running" label="Processing build..." />
      </Panel>
    </ThemeProvider>
  );
};
```

---

## 5. Design Best Practices

1. **High Contrast**: Ensure body text (`foreground`) maintains a contrast ratio of at least 4.5:1 against `background` and `surface`.
2. **Accessible Status Colors**: Avoid subtle pastel tones for `error` and `warning` states.
3. **Always Provide ASCII Fallbacks**: When providing custom symbols, always include an ASCII alternative that fits within typical monospace widths (1–6 characters).
4. **Respect `NO_COLOR`**: Never bypass the resolver functions to hardcode ANSI escape sequences in custom components. Always use semantic token keys.
