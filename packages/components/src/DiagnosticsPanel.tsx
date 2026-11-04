import React from 'react';
import { Box, Text } from 'ink';
import type { AoeTheme } from '@zyanx04/themes';
import { resolveThemeColor, getSymbol } from './utils/theme-resolver.js';
import { truncatePath, maskSecrets, sanitizeTerminalText } from './utils/sanitize.js';
import { useTheme } from './theme-context.js';

export type DiagnosticSeverityType = 'error' | 'warning' | 'info';

export interface DiagnosticLocationInfo {
  path: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface DiagnosticItem {
  severity: DiagnosticSeverityType;
  message: string;
  code?: string;
  location?: DiagnosticLocationInfo;
  isHypothesis?: boolean;
  rootCause?: string;
  suggestedRemediation?: string;
}

export interface DiagnosticsPanelProps {
  diagnostics: DiagnosticItem[];
  maxItems?: number;
  width?: number;
  theme?: AoeTheme;
  noColor?: boolean;
  unicode?: boolean;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  diagnostics,
  maxItems = 10,
  width,
  theme: explicitTheme,
  noColor = false,
  unicode = true,
}) => {
  const activeTheme = useTheme(explicitTheme);
  const mutedColor = resolveThemeColor('foregroundMuted', activeTheme, noColor);
  const errorColor = resolveThemeColor('error', activeTheme, noColor);
  const warningColor = resolveThemeColor('warning', activeTheme, noColor);
  const infoColor = resolveThemeColor('info', activeTheme, noColor);

  if (!diagnostics || diagnostics.length === 0) {
    return (
      <Box width={width}>
        <Text color={mutedColor}>No diagnostics recorded.</Text>
      </Box>
    );
  }

  // Sort: errors first, then warnings, then info
  const sorted = [...diagnostics].sort((a, b) => {
    const order: Record<DiagnosticSeverityType, number> = { error: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  const displayed = sorted.slice(0, maxItems);
  const hiddenCount = sorted.length - displayed.length;

  return (
    <Box flexDirection="column" width={width}>
      <Box flexDirection="row" marginBottom={1}>
        <Text color={errorColor} bold>
          Diagnostics ({diagnostics.length}):
        </Text>
      </Box>

      {displayed.map((diag, index) => {
        let badge = '';
        let badgeColor = mutedColor;

        if (diag.severity === 'error') {
          badge = getSymbol('cross', unicode, activeTheme);
          badgeColor = errorColor;
        } else if (diag.severity === 'warning') {
          badge = getSymbol('triangle', unicode, activeTheme);
          badgeColor = warningColor;
        } else {
          badge = getSymbol('circle', unicode, activeTheme);
          badgeColor = infoColor;
        }

        const hypothesisTag = diag.isHypothesis ? ' [HYPOTHESIS]' : '';

        // Format location if available
        let locText = '';
        if (diag.location?.path) {
          const p = truncatePath(diag.location.path, 30);
          const line = diag.location.line !== undefined ? `:${diag.location.line}` : '';
          const col = diag.location.column !== undefined ? `:${diag.location.column}` : '';
          locText = `${p}${line}${col}`;
        }

        return (
          <Box
            key={`${diag.message}-${index}`}
            flexDirection="column"
            marginBottom={index === displayed.length - 1 ? 0 : 1}
          >
            <Box flexDirection="row" alignItems="center">
              <Text color={badgeColor} bold>
                {badge}{' '}
              </Text>
              <Text bold color={badgeColor}>
                {diag.severity.toUpperCase()}
              </Text>
              {hypothesisTag ? (
                <Text color={warningColor} bold>
                  {hypothesisTag}
                </Text>
              ) : null}
              {diag.code ? <Text color={mutedColor}> [{diag.code}]</Text> : null}
              {locText ? <Text color={mutedColor}> at {locText}</Text> : null}
            </Box>

            <Box paddingLeft={2}>
              <Text>{sanitizeTerminalText(maskSecrets(diag.message))}</Text>
            </Box>

            {diag.rootCause ? (
              <Box paddingLeft={2}>
                <Text color={mutedColor}>
                  Root cause: {sanitizeTerminalText(maskSecrets(diag.rootCause))}
                </Text>
              </Box>
            ) : null}

            {diag.suggestedRemediation ? (
              <Box paddingLeft={2}>
                <Text color={infoColor}>
                  Remediation: {sanitizeTerminalText(maskSecrets(diag.suggestedRemediation))}
                </Text>
              </Box>
            ) : null}
          </Box>
        );
      })}

      {hiddenCount > 0 ? (
        <Box marginTop={1}>
          <Text color={mutedColor}>... and {hiddenCount} more diagnostics hidden.</Text>
        </Box>
      ) : null}
    </Box>
  );
};
