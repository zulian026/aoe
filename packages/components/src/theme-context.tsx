import React, { createContext, useContext } from 'react';
import { OBSIDIAN_THEME, type AoeTheme } from '@aoe/themes';

const ThemeContext = createContext<AoeTheme>(OBSIDIAN_THEME);

export interface ThemeProviderProps {
  theme?: AoeTheme;
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  theme = OBSIDIAN_THEME,
  children,
}) => {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

export function useTheme(explicitTheme?: AoeTheme): AoeTheme {
  const contextTheme = useContext(ThemeContext);
  return explicitTheme ?? contextTheme ?? OBSIDIAN_THEME;
}
