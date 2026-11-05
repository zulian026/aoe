import React from 'react';
import { Box, Text } from 'ink';
import type { AoeTheme } from '@zyanx04/themes';
import type { SidecarDiagnostic } from '@zyanx04/core';
import { Panel, resolveThemeColor } from '@zyanx04/components';

export interface DiagnosticsPanelProps {
  diagnostics?: SidecarDiagnostic[];
  sequenceStats?: {
    lastSequence: number;
    totalEventsReceived: number;
    duplicateCount: number;
    gapCount: number;
    outOfOrderCount: number;
  };
  maxEntries?: number;
  width?: number;
  theme?: AoeTheme;
  noColor?: boolean;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  diagnostics = [],
  sequenceStats,
  maxEntries = 4,
  width,
  theme,
  noColor = false,
}) => {
  const successColor = resolveThemeColor('success', theme, noColor);
  const warningColor = resolveThemeColor('warning', theme, noColor);
  const errorColor = resolveThemeColor('error', theme, noColor);
  const infoColor = resolveThemeColor('info', theme, noColor);
  const mutedColor = resolveThemeColor('foregroundMuted', theme, noColor);
  const subtleColor = resolveThemeColor('foregroundSubtle', theme, noColor);

  const hasAnomalies =
    (sequenceStats &&
      (sequenceStats.duplicateCount > 0 ||
        sequenceStats.gapCount > 0 ||
        sequenceStats.outOfOrderCount > 0)) ||
    diagnostics.some((d) => d.level === 'warning' || d.level === 'error');

  const visibleDiagnostics = diagnostics
    .filter((d) => d.level === 'warning' || d.level === 'error')
    .slice(-maxEntries);

  return (
    <Panel
      title="DIAGNOSTICS & INTEGRITY"
      metadata={
        sequenceStats
          ? `seq #${sequenceStats.lastSequence >= 0 ? sequenceStats.lastSequence : 0} (${sequenceStats.totalEventsReceived} events)`
          : undefined
      }
      width={width}
      theme={theme}
      noColor={noColor}
    >
      <Box flexDirection="column" width="100%">
        {/* Stream health status */}
        <Box flexDirection="row" alignItems="center">
          <Box flexShrink={0}>
            <Text color={hasAnomalies ? warningColor : successColor} bold>
              {hasAnomalies ? '⚠ ANOMALIES DETECTED: ' : '✔ STREAM HEALTHY: '}
            </Text>
          </Box>
          {sequenceStats ? (
            <Text color={mutedColor}>
              {sequenceStats.totalEventsReceived} events processed | {sequenceStats.gapCount} gap(s)
              | {sequenceStats.duplicateCount} duplicate(s) | {sequenceStats.outOfOrderCount}{' '}
              out-of-order
            </Text>
          ) : (
            <Text color={mutedColor}>Monitoring protocol event stream</Text>
          )}
        </Box>

        {/* Detailed diagnostic messages */}
        {visibleDiagnostics.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            {visibleDiagnostics.map((d, idx) => {
              const levelColor =
                d.level === 'error' ? errorColor : d.level === 'warning' ? warningColor : infoColor;
              const badge = `[${d.level.toUpperCase()}]`;

              return (
                <Box key={idx} flexDirection="row" alignItems="center" width="100%">
                  <Text color={levelColor} bold>
                    {badge}{' '}
                  </Text>
                  {d.code && <Text color={subtleColor}>[{d.code}] </Text>}
                  <Box flexShrink={1}>
                    <Text wrap="truncate-end">{d.message}</Text>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Panel>
  );
};
