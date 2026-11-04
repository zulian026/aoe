import React from 'react';
import { Box, Text } from 'ink';
import type { AoeTheme } from '@zyanx04/themes';
import { resolveThemeColor } from './utils/theme-resolver.js';
import { useTheme } from './theme-context.js';

export interface TableColumn<T = Record<string, unknown>> {
  key: keyof T | string;
  header: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
}

export interface TableProps<T = Record<string, unknown>> {
  columns: TableColumn<T>[];
  data: T[];
  theme?: AoeTheme;
  noColor?: boolean;
}

export const Table = <T extends Record<string, unknown>>({
  columns,
  data,
  theme: explicitTheme,
  noColor = false,
}: TableProps<T>): React.ReactElement => {
  const activeTheme = useTheme(explicitTheme);
  const primaryColor = resolveThemeColor('primary', activeTheme, noColor);
  const mutedColor = resolveThemeColor('foregroundMuted', activeTheme, noColor);
  const borderColor = resolveThemeColor('border', activeTheme, noColor);

  return (
    <Box flexDirection="column">
      {/* Header Row */}
      <Box flexDirection="row" borderBottom={true} borderColor={borderColor}>
        {columns.map((col, idx) => (
          <Box key={String(col.key) || idx} width={col.width ?? 15} paddingRight={1}>
            <Text bold color={primaryColor}>
              {col.header}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Data Rows */}
      {data.map((row, rowIdx) => (
        <Box key={rowIdx} flexDirection="row">
          {columns.map((col, colIdx) => {
            const rawVal = row[col.key as keyof T];
            const strVal = rawVal !== undefined && rawVal !== null ? String(rawVal) : '';
            return (
              <Box key={String(col.key) || colIdx} width={col.width ?? 15} paddingRight={1}>
                <Text color={mutedColor}>{strVal}</Text>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
};
