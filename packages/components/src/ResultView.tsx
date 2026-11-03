import React from 'react';
import { Box, Text } from 'ink';
import { OBSIDIAN_THEME, type ThemeDefinition } from '@aoe/themes';
import { resolveThemeColor, getSymbol } from './utils/theme-resolver.js';

export type ResultCategoryType = 'artifact' | 'metric' | 'summary' | 'test_results';

export interface ResultItem {
  category: ResultCategoryType;
  title: string;
  description?: string;
  data?: Record<string, unknown>;
  status?: 'success' | 'failure' | 'incomplete';
}

export interface ResultViewProps {
  results: ResultItem[];
  sessionStatus?: string;
  width?: number;
  theme?: ThemeDefinition;
  noColor?: boolean;
  unicode?: boolean;
}

export const ResultView: React.FC<ResultViewProps> = ({
  results,
  sessionStatus,
  width,
  theme = OBSIDIAN_THEME,
  noColor = false,
  unicode = true,
}) => {
  const mutedColor = resolveThemeColor('muted', theme, noColor);
  const successColor = resolveThemeColor('success', theme, noColor);
  const errorColor = resolveThemeColor('error', theme, noColor);
  const warningColor = resolveThemeColor('warning', theme, noColor);
  const infoColor = resolveThemeColor('info', theme, noColor);

  if (!results || results.length === 0) {
    return (
      <Box width={width}>
        <Text color={mutedColor}>No results produced.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={width}>
      <Box flexDirection="row" marginBottom={1}>
        <Text color={successColor} bold>
          Results ({results.length}):
        </Text>
        {sessionStatus ? <Text color={mutedColor}> (Session status: {sessionStatus})</Text> : null}
      </Box>

      {results.map((result, index) => {
        let catBadge = '';
        let catColor = mutedColor;

        switch (result.category) {
          case 'artifact':
            catBadge = '[ARTIFACT]';
            catColor = infoColor;
            break;
          case 'metric':
            catBadge = '[METRIC  ]';
            catColor = warningColor;
            break;
          case 'summary':
            catBadge = '[SUMMARY ]';
            catColor = successColor;
            break;
          case 'test_results':
            catBadge = '[TESTS   ]';
            catColor = infoColor;
            break;
        }

        let statusSymbol = '';
        let statusColor = mutedColor;
        if (result.status === 'success') {
          statusSymbol = `${getSymbol('check', unicode)} `;
          statusColor = successColor;
        } else if (result.status === 'failure') {
          statusSymbol = `${getSymbol('cross', unicode)} `;
          statusColor = errorColor;
        } else if (result.status === 'incomplete') {
          statusSymbol = `${getSymbol('triangle', unicode)} `;
          statusColor = warningColor;
        }

        return (
          <Box
            key={`${result.title}-${index}`}
            flexDirection="column"
            marginBottom={index === results.length - 1 ? 0 : 1}
          >
            <Box flexDirection="row" alignItems="center">
              <Text color={statusColor} bold>
                {statusSymbol}
              </Text>
              <Text color={catColor} bold>
                {catBadge}{' '}
              </Text>
              <Text bold>{result.title}</Text>
            </Box>

            {result.description ? (
              <Box paddingLeft={2}>
                <Text color={mutedColor}>{result.description}</Text>
              </Box>
            ) : null}

            {result.data && Object.keys(result.data).length > 0 ? (
              <Box paddingLeft={2} flexDirection="column">
                {Object.entries(result.data).map(([key, val]) => (
                  <Text key={key} color={mutedColor}>
                    {'  '}&bull; {key}: {String(val)}
                  </Text>
                ))}
              </Box>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
};
