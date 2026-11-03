import React from 'react';
import { Box, Text } from 'ink';
import { OBSIDIAN_THEME, type ThemeDefinition } from '@aoe/themes';
import { resolveThemeColor, getSymbol } from './utils/theme-resolver.js';

export type StatusType =
  'running' | 'completed' | 'failed' | 'blocked' | 'warning' | 'idle' | 'cancelled';

export interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  animated?: boolean;
  spinnerFrame?: number;
  theme?: ThemeDefinition;
  noColor?: boolean;
  unicode?: boolean;
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  animated = false,
  spinnerFrame = 0,
  theme = OBSIDIAN_THEME,
  noColor = false,
  unicode = true,
}) => {
  let symbolText = '';
  let colorToken: keyof typeof theme.tokens = 'muted';

  switch (status) {
    case 'running':
      colorToken = 'warning';
      if (animated && unicode) {
        const frameIndex = Math.abs(spinnerFrame) % SPINNER_FRAMES.length;
        symbolText = SPINNER_FRAMES[frameIndex];
      } else {
        symbolText = unicode ? getSymbol('bullet', true) : '[RUN]';
      }
      break;

    case 'completed':
      colorToken = 'success';
      symbolText = unicode ? getSymbol('check', true) : '[OK]';
      break;

    case 'failed':
      colorToken = 'error';
      symbolText = unicode ? getSymbol('cross', true) : '[FAIL]';
      break;

    case 'blocked':
      colorToken = 'warning';
      symbolText = unicode ? getSymbol('square', true) : '[BLOCKED]';
      break;

    case 'warning':
      colorToken = 'warning';
      symbolText = unicode ? getSymbol('triangle', true) : '[WARN]';
      break;

    case 'idle':
      colorToken = 'muted';
      symbolText = unicode ? getSymbol('circle', true) : '[IDLE]';
      break;

    case 'cancelled':
      colorToken = 'muted';
      symbolText = unicode ? getSymbol('dash', true) : '[CANCELLED]';
      break;

    default:
      colorToken = 'muted';
      symbolText = unicode ? '?' : '[?]';
      break;
  }

  const textColor = resolveThemeColor(colorToken, theme, noColor);
  const labelColor = resolveThemeColor('muted', theme, noColor);

  return (
    <Box flexDirection="row" alignItems="center">
      <Text color={textColor} bold={status === 'completed' || status === 'failed'}>
        {symbolText}
      </Text>
      {label ? <Text color={labelColor}> {label}</Text> : null}
    </Box>
  );
};
