import React from 'react';
import { Box, Text } from 'ink';
import type { AoeTheme } from '@aoe/themes';
import { resolveThemeColor } from './utils/theme-resolver.js';
import { useTheme } from './theme-context.js';

export interface PanelProps {
  title?: string;
  metadata?: string;
  width?: number;
  borderStyle?: 'round' | 'single' | 'classic' | 'none';
  theme?: AoeTheme;
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
  theme: explicitTheme,
  noColor = false,
  paddingX,
  paddingY,
  children,
}) => {
  const activeTheme = useTheme(explicitTheme);
  const borderColor = resolveThemeColor('border', activeTheme, noColor);
  const primaryColor = resolveThemeColor('primary', activeTheme, noColor);
  const mutedColor = resolveThemeColor('foregroundMuted', activeTheme, noColor);

  const effectivePaddingX = paddingX ?? activeTheme.tokens.spacing.xs;
  const effectivePaddingY = paddingY ?? activeTheme.tokens.spacing.none;

  const hasHeader = Boolean(title || metadata);

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle={borderStyle === 'none' ? undefined : borderStyle}
      borderColor={borderColor}
      paddingX={effectivePaddingX}
      paddingY={effectivePaddingY}
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
