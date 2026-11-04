import React from 'react';
import { Box, Text } from 'ink';
import type { AoeTheme } from '@zyanx04/themes';
import type { SidecarConnectionStatus } from '@zyanx04/core';
import { resolveThemeColor } from '@zyanx04/components';

export interface ConnectionStatusProps {
  status: SidecarConnectionStatus | 'session_ended';
  attempt?: number;
  theme?: AoeTheme;
  noColor?: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  attempt,
  theme,
  noColor = false,
}) => {
  const successColor = resolveThemeColor('success', theme, noColor);
  const warningColor = resolveThemeColor('warning', theme, noColor);
  const mutedColor = resolveThemeColor('foregroundMuted', theme, noColor);
  const infoColor = resolveThemeColor('info', theme, noColor);

  let label = 'IDLE';
  let color = mutedColor;
  let symbol = '○';

  switch (status) {
    case 'connected':
      label = 'CONNECTED';
      color = successColor;
      symbol = '●';
      break;
    case 'connecting':
      label = 'CONNECTING';
      color = warningColor;
      symbol = '◌';
      break;
    case 'reconnecting':
      label = attempt ? `RECONNECTING (#${attempt})` : 'RECONNECTING';
      color = warningColor;
      symbol = '⟳';
      break;
    case 'session_ended':
      label = 'SESSION_ENDED';
      color = infoColor;
      symbol = '■';
      break;
    case 'closed':
    case 'idle':
    default:
      label = 'DISCONNECTED';
      color = mutedColor;
      symbol = '○';
      break;
  }

  return (
    <Box flexDirection="row" alignItems="center">
      <Text color={color} bold>
        {symbol} {label}
      </Text>
    </Box>
  );
};
