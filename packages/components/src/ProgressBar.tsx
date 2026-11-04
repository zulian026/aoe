import React from 'react';
import { Box, Text } from 'ink';
import type { AoeTheme } from '@zyanx04/themes';
import { resolveThemeColor, getSymbol } from './utils/theme-resolver.js';
import { clamp } from './utils/sanitize.js';
import { useTheme } from './theme-context.js';

export interface ProgressBarProps {
  completedWork?: number;
  totalWork?: number;
  verifiedWork?: number;
  isEstimate?: boolean;
  percentage?: number;
  width?: number;
  mode?: 'compact' | 'detailed';
  unit?: string;
  description?: string;
  theme?: AoeTheme;
  noColor?: boolean;
  unicode?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  completedWork,
  totalWork,
  verifiedWork,
  isEstimate = false,
  percentage,
  width = 20,
  mode = 'detailed',
  unit,
  description,
  theme: explicitTheme,
  noColor = false,
  unicode = true,
}) => {
  const activeTheme = useTheme(explicitTheme);
  const barWidth = clamp(width, 5, 80);

  // Determine if progress is determinate or indeterminate
  let safePct: number | null = null;
  const isIndeterminate =
    percentage === undefined &&
    (totalWork === undefined || totalWork === null || totalWork <= 0 || Number.isNaN(totalWork));

  if (!isIndeterminate) {
    if (typeof percentage === 'number' && !Number.isNaN(percentage)) {
      safePct = clamp(Math.round(percentage), 0, 100);
    } else if (
      typeof completedWork === 'number' &&
      typeof totalWork === 'number' &&
      totalWork > 0 &&
      !Number.isNaN(completedWork)
    ) {
      safePct = clamp(Math.round((completedWork / totalWork) * 100), 0, 100);
    }
  }

  const primaryColor = resolveThemeColor('primary', activeTheme, noColor);
  const successColor = resolveThemeColor('success', activeTheme, noColor);
  const warningColor = resolveThemeColor('warning', activeTheme, noColor);
  const mutedColor = resolveThemeColor('foregroundMuted', activeTheme, noColor);

  // If indeterminate, render unknown progress bar
  if (safePct === null) {
    const pad = Math.max(1, Math.floor((barWidth - 3) / 2));
    const emptyChar = getSymbol('progressEmpty', unicode, activeTheme);
    const indetBar = `[${emptyChar.repeat(pad)}?${emptyChar.repeat(pad)}]`;

    return (
      <Box flexDirection="row" alignItems="center">
        <Text color={warningColor}>{indetBar}</Text>
        <Text color={mutedColor}> (indeterminate)</Text>
        {description ? <Text color={mutedColor}> {description}</Text> : null}
      </Box>
    );
  }

  // Build the bar representation
  const filledCount = clamp(Math.round((safePct / 100) * barWidth), 0, barWidth);
  const emptyCount = barWidth - filledCount;
  const filledChar = getSymbol('progressFilled', unicode, activeTheme);
  const emptyChar = getSymbol('progressEmpty', unicode, activeTheme);

  const filledStr = filledChar.repeat(filledCount);
  const emptyStr = emptyChar.repeat(emptyCount);

  const isComplete = safePct === 100;
  const barColor = isComplete ? successColor : isEstimate ? warningColor : primaryColor;

  // Percentage badge
  const pctText = isEstimate ? `~${safePct}% (est)` : `${safePct}%`;

  // Details
  let detailsText = '';
  if (mode === 'detailed') {
    if (completedWork !== undefined && totalWork !== undefined) {
      const unitLabel = unit ? ` ${unit}` : '';
      detailsText = ` (${completedWork}/${totalWork}${unitLabel})`;
    } else if (unit) {
      detailsText = ` (${unit})`;
    }
    if (verifiedWork !== undefined && verifiedWork !== completedWork) {
      detailsText += ` [verified: ${verifiedWork}]`;
    }
  }

  return (
    <Box flexDirection="row" alignItems="center">
      <Text color={mutedColor}>[</Text>
      <Text color={barColor}>{filledStr}</Text>
      <Text color={mutedColor}>{emptyStr}</Text>
      <Text color={mutedColor}>] </Text>
      <Text color={isEstimate ? warningColor : mutedColor} bold={isComplete}>
        {pctText}
      </Text>
      {detailsText ? <Text color={mutedColor}>{detailsText}</Text> : null}
      {description ? <Text color={mutedColor}> - {description}</Text> : null}
    </Box>
  );
};
