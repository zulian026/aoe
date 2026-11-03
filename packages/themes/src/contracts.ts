import { z } from 'zod';

/**
 * Validates a color value (Hex, RGB/RGBA string, or standard ANSI name).
 */
export const ColorValueSchema = z
  .string()
  .min(1, 'Color value cannot be empty')
  .refine(
    (val) => {
      // Hex pattern (#fff, #ffffff, #ffffffff)
      if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(val)) {
        return true;
      }
      // RGB / RGBA
      if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)$/i.test(val)) {
        return true;
      }
      // Standard ANSI color names
      const namedColors = [
        'black',
        'red',
        'green',
        'yellow',
        'blue',
        'magenta',
        'cyan',
        'white',
        'gray',
        'grey',
        'blackbright',
        'redbright',
        'greenbright',
        'yellowbright',
        'bluebright',
        'magentabright',
        'cyanbright',
        'whitebright',
      ];
      return namedColors.includes(val.toLowerCase());
    },
    {
      message:
        'Invalid color format. Must be a valid Hex (#RGB or #RRGGBB), rgb/rgba string, or standard ANSI color name.',
    },
  );

export type ColorValue = z.infer<typeof ColorValueSchema>;

/**
 * Semantic theme color palette.
 */
export const ThemeColorsSchema = z.object({
  background: ColorValueSchema,
  surface: ColorValueSchema,
  surfaceMuted: ColorValueSchema,

  foreground: ColorValueSchema,
  foregroundMuted: ColorValueSchema,
  foregroundSubtle: ColorValueSchema,

  primary: ColorValueSchema,
  secondary: ColorValueSchema,

  success: ColorValueSchema,
  warning: ColorValueSchema,
  error: ColorValueSchema,
  info: ColorValueSchema,

  border: ColorValueSchema,
  borderMuted: ColorValueSchema,

  accent: ColorValueSchema,
  selection: ColorValueSchema,
});

export type ThemeColors = z.infer<typeof ThemeColorsSchema>;

/**
 * Semantic status colors mapping.
 */
export const ThemeStatusColorsSchema = z.object({
  idle: ColorValueSchema,
  running: ColorValueSchema,
  blocked: ColorValueSchema,
  warning: ColorValueSchema,
  completed: ColorValueSchema,
  failed: ColorValueSchema,
  cancelled: ColorValueSchema,
});

export type ThemeStatusColors = z.infer<typeof ThemeStatusColorsSchema>;

/**
 * Typography styling attributes.
 */
export const TypographyStyleSchema = z.object({
  bold: z.boolean().optional(),
  dim: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
});

export type TypographyStyle = z.infer<typeof TypographyStyleSchema>;

/**
 * Semantic typography scale.
 */
export const ThemeTypographySchema = z.object({
  heading: TypographyStyleSchema,
  body: TypographyStyleSchema,
  muted: TypographyStyleSchema,
  emphasis: TypographyStyleSchema,
  code: TypographyStyleSchema,
  label: TypographyStyleSchema,
});

export type ThemeTypography = z.infer<typeof ThemeTypographySchema>;

/**
 * Semantic terminal spacing scale (in terminal character columns/rows).
 */
export const ThemeSpacingSchema = z.object({
  none: z.literal(0),
  xs: z.number().nonnegative(),
  sm: z.number().nonnegative(),
  md: z.number().nonnegative(),
  lg: z.number().nonnegative(),
  xl: z.number().nonnegative(),
});

export type ThemeSpacing = z.infer<typeof ThemeSpacingSchema>;

/**
 * Symbol pair supporting Unicode and ASCII fallback variants.
 */
export const SymbolPairSchema = z.object({
  unicode: z.string().min(1),
  ascii: z.string().min(1),
});

export type SymbolPair = z.infer<typeof SymbolPairSchema>;

/**
 * Semantic terminal symbols dictionary.
 */
export const ThemeSymbolsSchema = z.object({
  success: SymbolPairSchema,
  failure: SymbolPairSchema,
  warning: SymbolPairSchema,
  information: SymbolPairSchema,
  running: SymbolPairSchema,
  pending: SymbolPairSchema,
  completed: SymbolPairSchema,
  blocked: SymbolPairSchema,
  cancelled: SymbolPairSchema,
  treeBranch: SymbolPairSchema,
  treeLastBranch: SymbolPairSchema,
  treeVertical: SymbolPairSchema,
  progressFilled: SymbolPairSchema,
  progressEmpty: SymbolPairSchema,
  disk: SymbolPairSchema,
  hypothesis: SymbolPairSchema,
});

export type ThemeSymbols = z.infer<typeof ThemeSymbolsSchema>;

/**
 * Complete Theme Tokens container with backward-compatible legacy properties.
 */
export const ThemeTokensSchema = z.object({
  colors: ThemeColorsSchema,
  status: ThemeStatusColorsSchema,
  typography: ThemeTypographySchema,
  spacing: ThemeSpacingSchema,
  symbols: ThemeSymbolsSchema,

  // Legacy flat color compatibility properties
  primary: ColorValueSchema.optional(),
  secondary: ColorValueSchema.optional(),
  accent: ColorValueSchema.optional(),
  success: ColorValueSchema.optional(),
  warning: ColorValueSchema.optional(),
  error: ColorValueSchema.optional(),
  info: ColorValueSchema.optional(),
  muted: ColorValueSchema.optional(),
  background: ColorValueSchema.optional(),
  surface: ColorValueSchema.optional(),
  border: ColorValueSchema.optional(),
});

export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;

/**
 * Complete AOE Theme Contract.
 */
export const AoeThemeSchema = z.object({
  id: z
    .string()
    .min(1, 'Theme ID cannot be empty')
    .regex(
      /^[a-z0-9-]+$/,
      'Theme ID must contain only lowercase alphanumeric characters and hyphens',
    ),
  name: z.string().min(1, 'Theme name is required'),
  version: z.string().min(1, 'Theme version is required'),
  description: z.string().optional(),
  colorScheme: z.enum(['dark', 'light']),
  // Legacy aliases
  displayName: z.string().optional(),
  dark: z.boolean().optional(),
  tokens: ThemeTokensSchema,
});

export type AoeTheme = z.infer<typeof AoeThemeSchema>;

// Backward compatibility alias
export const ThemeDefinitionSchema = AoeThemeSchema;
export type ThemeDefinition = AoeTheme;

/**
 * Metadata record for listing registered themes.
 */
export interface ThemeMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  colorScheme: 'dark' | 'light';
}
