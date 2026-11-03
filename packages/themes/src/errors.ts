import type { z } from 'zod';

export class ThemeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ThemeError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface ValidationErrorDetail {
  path: string;
  message: string;
  code: string;
}

export class ThemeValidationError extends ThemeError {
  public readonly issues: ValidationErrorDetail[];

  constructor(message: string, zodError?: z.ZodError) {
    const issues: ValidationErrorDetail[] = zodError
      ? zodError.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        }))
      : [];

    const issueDetails =
      issues.length > 0
        ? `: ${issues.map((i) => `[${i.path || 'root'}]: ${i.message}`).join(', ')}`
        : '';

    super(`${message}${issueDetails}`);
    this.name = 'ThemeValidationError';
    this.issues = issues;
  }
}

export class ThemeNotFoundError extends ThemeError {
  public readonly themeId: string;
  public readonly availableThemes: readonly string[];

  constructor(themeId: string, availableThemes: readonly string[] = []) {
    const availableStr =
      availableThemes.length > 0 ? ` Available themes: ${availableThemes.join(', ')}` : '';
    super(`Theme with ID '${themeId}' was not found in the registry.${availableStr}`);
    this.name = 'ThemeNotFoundError';
    this.themeId = themeId;
    this.availableThemes = [...availableThemes];
  }
}

export class DuplicateThemeError extends ThemeError {
  public readonly themeId: string;

  constructor(themeId: string) {
    super(
      `Theme with ID '${themeId}' is already registered. Use { replace: true } if you intend to overwrite it.`,
    );
    this.name = 'DuplicateThemeError';
    this.themeId = themeId;
  }
}
