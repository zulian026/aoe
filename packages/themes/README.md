# @aoe/themes

Theme engine, semantic design tokens, and color resolution for AOE (Agent Output Enhancement).

## Overview

`@aoe/themes` defines the visual design tokens, color palette contracts, contrast compliance algorithms, and theme registry for terminal rendering.

## Features

- **Semantic Design Tokens**: Standardized token keys (`primary`, `secondary`, `success`, `error`, `warning`, `muted`, `accent`).
- **Dual Symbol Sets**: Built-in support for both Unicode symbols (`✔`, `✖`, `●`) and ASCII fallbacks (`[OK]`, `[FAIL]`, `[RUN]`).
- **Contrast Validation**: Evaluates terminal contrast ratios against WCAG AA guidelines to prevent unreadable text.
- **Built-in Themes**:
  - `obsidian`: High-polish dark theme with cyan/blue accents (default).
  - `light`: Clean, paper-style theme for light terminal backgrounds.
  - `high-contrast`: Bold, accessible palette for low-visibility environments.
- **Extensible Registry**: Register and resolve custom third-party themes.

## Installation

```bash
npm install @aoe/themes
# or
pnpm add @aoe/themes
```

## Quick Start

```typescript
import {
  defaultRegistry,
  resolveTheme,
  OBSIDIAN_THEME,
  LIGHT_THEME,
  HIGH_CONTRAST_THEME,
  type AoeTheme,
} from '@aoe/themes';

// Retrieve a registered theme by name
const theme: AoeTheme = defaultRegistry.getTheme('obsidian');

// Resolve theme colors with fallback logic
const resolved = resolveTheme('obsidian', {
  unicode: true,
  noColor: false,
});

console.log('Success token color:', resolved.colors.success);
console.log('Running symbol:', resolved.symbols.running);
```

## Creating a Custom Theme

```typescript
import { registerTheme, validateTheme, type ThemeDefinition } from '@aoe/themes';

const myTheme: ThemeDefinition = {
  id: 'cyberpunk',
  name: 'Cyberpunk Neon',
  mode: 'dark',
  tokens: {
    colors: {
      primary: '#ff007f',
      secondary: '#00f0ff',
      success: '#00ff66',
      error: '#ff0033',
      warning: '#ffee00',
      info: '#00f0ff',
      muted: '#707070',
      border: '#333355',
    },
    symbols: {/* symbol definitions */},
  },
};

validateTheme(myTheme);
registerTheme(myTheme);
```

## License

MIT
