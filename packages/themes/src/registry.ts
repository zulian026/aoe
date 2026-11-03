import type { AoeTheme, ThemeMetadata } from './contracts.js';
import { BUILTIN_THEMES } from './builtin/index.js';
import { validateTheme, deepFreeze } from './validator.js';
import { DuplicateThemeError, ThemeNotFoundError } from './errors.js';

export interface RegisterThemeOptions {
  replace?: boolean;
}

export class ThemeRegistry {
  private readonly themes: Map<string, AoeTheme> = new Map();
  private defaultThemeId = 'obsidian';

  constructor() {
    this.registerBuiltinThemes();
  }

  private registerBuiltinThemes(): void {
    for (const theme of BUILTIN_THEMES) {
      this.themes.set(theme.id, theme);
    }
  }

  /**
   * Registers a theme in the registry after validation.
   */
  public register(themeInput: unknown, options: RegisterThemeOptions = {}): AoeTheme {
    const validated = validateTheme(themeInput);

    if (this.themes.has(validated.id) && !options.replace) {
      throw new DuplicateThemeError(validated.id);
    }

    this.themes.set(validated.id, validated);
    return validated;
  }

  /**
   * Retrieves a theme by its ID. Throws ThemeNotFoundError if not found.
   */
  public get(id: string): AoeTheme {
    const theme = this.themes.get(id);
    if (!theme) {
      throw new ThemeNotFoundError(id, this.getRegisteredIds());
    }
    // Return frozen reference
    return deepFreeze(theme);
  }

  /**
   * Checks if a theme exists in the registry.
   */
  public has(id: string): boolean {
    return this.themes.has(id);
  }

  /**
   * Lists metadata for all registered themes.
   */
  public list(): ThemeMetadata[] {
    return Array.from(this.themes.values()).map((theme) => ({
      id: theme.id,
      name: theme.name,
      version: theme.version,
      description: theme.description,
      colorScheme: theme.colorScheme,
    }));
  }

  /**
   * Returns array of registered theme IDs.
   */
  public getRegisteredIds(): string[] {
    return Array.from(this.themes.keys());
  }

  /**
   * Returns the current default theme.
   */
  public getDefault(): AoeTheme {
    return this.get(this.defaultThemeId);
  }

  /**
   * Sets the default theme ID.
   */
  public setDefault(id: string): void {
    if (!this.themes.has(id)) {
      throw new ThemeNotFoundError(id, this.getRegisteredIds());
    }
    this.defaultThemeId = id;
  }

  /**
   * Resets registry to initial state with built-in themes.
   */
  public reset(): void {
    this.themes.clear();
    this.defaultThemeId = 'obsidian';
    this.registerBuiltinThemes();
  }
}

/**
 * Creates and returns a fresh ThemeRegistry instance initialized with built-in themes.
 */
export function createDefaultRegistry(): ThemeRegistry {
  return new ThemeRegistry();
}

/**
 * Canonical default singleton registry for seamless usage when global context is desired.
 */
export const defaultRegistry = new ThemeRegistry();
