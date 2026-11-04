import React from 'react';
import { Box, Text } from 'ink';
import type { AoeTheme } from '@zyanx04/themes';
import { resolveThemeColor } from './utils/theme-resolver.js';
import { maskSecrets, sanitizeTerminalText } from './utils/sanitize.js';
import { useTheme } from './theme-context.js';

export type LogLevelType = 'debug' | 'info' | 'warn' | 'error';

export interface LogItem {
  level: LogLevelType;
  message: string;
  timestamp?: string | number;
  meta?: Record<string, unknown>;
}

export interface ExecutionLogProps {
  logs: LogItem[];
  maxLines?: number;
  mode?: 'compact' | 'expanded';
  theme?: AoeTheme;
  noColor?: boolean;
}

export const ExecutionLog: React.FC<ExecutionLogProps> = ({
  logs,
  maxLines = 10,
  mode = 'compact',
  theme: explicitTheme,
  noColor = false,
}) => {
  const activeTheme = useTheme(explicitTheme);
  const mutedColor = resolveThemeColor('foregroundMuted', activeTheme, noColor);
  const infoColor = resolveThemeColor('info', activeTheme, noColor);
  const warningColor = resolveThemeColor('warning', activeTheme, noColor);
  const errorColor = resolveThemeColor('error', activeTheme, noColor);

  if (!logs || logs.length === 0) {
    return (
      <Box>
        <Text color={mutedColor}>No execution logs.</Text>
      </Box>
    );
  }

  // Filter out any potential internal reasoning/scratchpad tags if passed in logs
  const safeLogs = logs.filter((log) => {
    const msg = log.message.toLowerCase();
    if (msg.includes('<thought>') || msg.includes('</thought>')) return false;
    if (msg.includes('<scratchpad>') || msg.includes('</scratchpad>')) return false;
    return true;
  });

  // Bounded buffer: keep the most recent maxLines
  const total = safeLogs.length;
  const startIndex = Math.max(0, total - maxLines);
  const displayed = safeLogs.slice(startIndex);
  const hiddenCount = startIndex;

  return (
    <Box flexDirection="column">
      {hiddenCount > 0 ? (
        <Box marginBottom={0}>
          <Text color={mutedColor}>... ({hiddenCount} earlier log entries hidden)</Text>
        </Box>
      ) : null}

      {displayed.map((log, index) => {
        let levelColor = mutedColor;
        let levelTag = '[INFO ]';

        switch (log.level) {
          case 'debug':
            levelTag = '[DEBUG]';
            levelColor = mutedColor;
            break;
          case 'info':
            levelTag = '[INFO ]';
            levelColor = infoColor;
            break;
          case 'warn':
            levelTag = '[WARN ]';
            levelColor = warningColor;
            break;
          case 'error':
            levelTag = '[ERROR]';
            levelColor = errorColor;
            break;
        }

        // Sanitize and mask secrets
        const sanitizedMsg = sanitizeTerminalText(maskSecrets(log.message));

        // Format timestamp if present
        let timeStr = '';
        if (log.timestamp) {
          if (typeof log.timestamp === 'number') {
            const d = new Date(log.timestamp);
            timeStr = `${d.toTimeString().split(' ')[0]} `;
          } else if (typeof log.timestamp === 'string') {
            // ISO or time string
            timeStr = log.timestamp.includes('T')
              ? `${log.timestamp.split('T')[1].slice(0, 8)} `
              : `${log.timestamp} `;
          }
        }

        return (
          <Box key={`${log.timestamp}-${index}`} flexDirection="row">
            {timeStr ? <Text color={mutedColor}>{timeStr}</Text> : null}
            <Text color={levelColor} bold>
              {levelTag}{' '}
            </Text>
            <Text>{sanitizedMsg}</Text>
            {mode === 'expanded' && log.meta ? (
              <Text color={mutedColor}> {JSON.stringify(log.meta)}</Text>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
};
