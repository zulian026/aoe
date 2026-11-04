import React from 'react';
import { Box, Text } from 'ink';
import type { AoeTheme } from '@zyanx04/themes';
import type { SidecarConnectionStatus } from '@zyanx04/core';
import { resolveThemeColor, formatDuration } from '@zyanx04/components';
import { ConnectionStatus } from './ConnectionStatus.js';

export interface SessionHeaderProps {
  sessionId?: string;
  agent?: { name: string; version?: string; environment?: string };
  connectionStatus: SidecarConnectionStatus | 'session_ended';
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  width?: number;
  theme?: AoeTheme;
  noColor?: boolean;
}

export const SessionHeader: React.FC<SessionHeaderProps> = ({
  sessionId,
  agent,
  connectionStatus,
  startedAt,
  endedAt,
  durationMs: explicitDurationMs,
  width = 80,
  theme,
  noColor = false,
}) => {
  const primaryColor = resolveThemeColor('primary', theme, noColor);
  const mutedColor = resolveThemeColor('foregroundMuted', theme, noColor);
  const subtleColor = resolveThemeColor('foregroundSubtle', theme, noColor);
  const secondaryColor = resolveThemeColor('secondary', theme, noColor);
  const borderColor = resolveThemeColor('border', theme, noColor);

  // Shorten session ID for clean terminal display
  const shortSessionId = sessionId
    ? sessionId.length > 16
      ? `${sessionId.slice(0, 10)}...${sessionId.slice(-4)}`
      : sessionId
    : 'no_session';

  // Calculate actual elapsed duration
  let durationStr: string | null = null;
  if (typeof explicitDurationMs === 'number' && explicitDurationMs >= 0) {
    durationStr = formatDuration(explicitDurationMs);
  } else if (startedAt) {
    const end = endedAt ? new Date(endedAt).getTime() : Date.now();
    const start = new Date(startedAt).getTime();
    const elapsed = Math.max(0, end - start);
    durationStr = formatDuration(elapsed);
  }

  const isNarrow = width < 90;

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      paddingY={0}
      marginBottom={1}
    >
      <Box
        flexDirection={isNarrow ? 'column' : 'row'}
        justifyContent="space-between"
        alignItems={isNarrow ? 'flex-start' : 'center'}
        width="100%"
      >
        {/* Left: Branding & Agent */}
        <Box flexDirection="row" alignItems="center" flexShrink={0}>
          <Text bold color={primaryColor}>
            AOE SIDECAR
          </Text>
          <Text color={subtleColor}> v1.0.0 </Text>
          {agent?.name && (
            <Box marginLeft={1}>
              <Text color={secondaryColor} bold>
                [{agent.name}
                {agent.version ? `@${agent.version}` : ''}]
              </Text>
            </Box>
          )}
        </Box>

        {/* Right / Second row: Session ID, Duration, Connection */}
        <Box flexDirection="row" alignItems="center" flexShrink={0} marginTop={isNarrow ? 1 : 0}>
          <Text color={mutedColor}>ID: </Text>
          <Text color={subtleColor}>{shortSessionId} </Text>
          {durationStr && (
            <Box marginRight={1}>
              <Text color={mutedColor}>⏱ {durationStr} </Text>
            </Box>
          )}
          <ConnectionStatus status={connectionStatus} theme={theme} noColor={noColor} />
        </Box>
      </Box>
    </Box>
  );
};
