import React from 'react';
import { Box, Text } from 'ink';
import type { AoeTheme } from '@zyanx04/themes';
import { resolveStatusColor, resolveThemeColor, getSymbol } from './utils/theme-resolver.js';
import { useTheme } from './theme-context.js';

export type StatusType =
  'running' | 'completed' | 'failed' | 'blocked' | 'warning' | 'idle' | 'cancelled';

export interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  animated?: boolean;
  spinnerFrame?: number;
  theme?: AoeTheme;
  noColor?: boolean;
  unicode?: boolean;
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  animated = false,
  spinnerFrame = 0,
  theme: explicitTheme,
  noColor = false,
  unicode = true,
}) => {
  const activeTheme = useTheme(explicitTheme);

  let symbolText = '';

  switch (status) {
    case 'running':
      if (animated && unicode) {
        const frameIndex = Math.abs(spinnerFrame) % SPINNER_FRAMES.length;
        symbolText = SPINNER_FRAMES[frameIndex];
      } else {
        symbolText = getSymbol('running', unicode, activeTheme);
      }
      break;

    case 'completed':
      symbolText = getSymbol('completed', unicode, activeTheme);
      break;

    case 'failed':
      symbolText = getSymbol('failure', unicode, activeTheme);
      break;

    case 'blocked':
      symbolText = getSymbol('blocked', unicode, activeTheme);
      break;

    case 'warning':
      symbolText = getSymbol('warning', unicode, activeTheme);
      break;

    case 'idle':
      symbolText = unicode ? getSymbol('pending', true, activeTheme) : '[IDLE]';
      break;

    case 'cancelled':
      symbolText = unicode ? getSymbol('cancelled', true, activeTheme) : '[CANCELLED]';
      break;

    default:
      symbolText = unicode ? '?' : '[?]';
      break;
  }

  const textColor = resolveStatusColor(status, activeTheme, noColor);
  const labelColor = resolveThemeColor('foregroundMuted', activeTheme, noColor);

  return (
    <Box flexDirection="row" alignItems="center">
      <Text color={textColor} bold={status === 'completed' || status === 'failed'}>
        {symbolText}
      </Text>
      {label ? <Text color={labelColor}> {label}</Text> : null}
    </Box>
  );
};
