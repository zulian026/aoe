import React from 'react';
import { Box, Text } from 'ink';
import { OBSIDIAN_THEME, type ThemeDefinition } from '@aoe/themes';
import { resolveThemeColor } from './utils/theme-resolver.js';

export interface PanelProps {
  title?: string;
  metadata?: string;
  width?: number;
  borderStyle?: 'round' | 'single' | 'classic' | 'none';
  theme?: ThemeDefinition;
  noColor?: boolean;
  paddingX?: number;
  paddingY?: number;
  children?: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  metadata,
  width,
  borderStyle = 'round',
  theme = OBSIDIAN_THEME,
  noColor = false,
  paddingX = 1,
  paddingY = 0,
  children,
}) => {
  const borderColor = resolveThemeColor('border', theme, noColor);
  const primaryColor = resolveThemeColor('primary', theme, noColor);
  const mutedColor = resolveThemeColor('muted', theme, noColor);

  const hasHeader = Boolean(title || metadata);

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle={borderStyle === 'none' ? undefined : borderStyle}
      borderColor={borderColor}
      paddingX={paddingX}
      paddingY={paddingY}
    >
      {hasHeader ? (
        <Box
          flexDirection="row"
          justifyContent="space-between"
          marginBottom={children ? 1 : 0}
          width="100%"
        >
          {title ? (
            <Text bold color={primaryColor}>
              {title}
            </Text>
          ) : (
            <Box />
          )}
          {metadata ? <Text color={mutedColor}>{metadata}</Text> : null}
        </Box>
      ) : null}
      {children}
    </Box>
  );
};
