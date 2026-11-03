import { z } from 'zod';

export const ThemeTokensSchema = z.object({
  primary: z.string(),
  secondary: z.string(),
  accent: z.string(),
  success: z.string(),
  warning: z.string(),
  error: z.string(),
  info: z.string(),
  muted: z.string(),
  background: z.string().optional(),
  surface: z.string().optional(),
  border: z.string(),
});

export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;

export const ThemeDefinitionSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  dark: z.boolean(),
  tokens: ThemeTokensSchema,
});

export type ThemeDefinition = z.infer<typeof ThemeDefinitionSchema>;

export const OBSIDIAN_THEME: ThemeDefinition = {
  name: 'obsidian',
  displayName: 'Obsidian Dark',
  dark: true,
  tokens: {
    primary: '#8A2BE2',
    secondary: '#00D2FF',
    accent: '#BD00FF',
    success: '#00F090',
    warning: '#FFB800',
    error: '#FF3366',
    info: '#00B4D8',
    muted: '#6C757D',
    background: '#0D1117',
    surface: '#161B22',
    border: '#30363D',
  },
};
