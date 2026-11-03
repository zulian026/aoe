import React from 'react';
import { Box, Text } from 'ink';
import { OBSIDIAN_THEME, type ThemeDefinition } from '@aoe/themes';
import { resolveThemeColor } from './utils/theme-resolver.js';

export interface TableColumn<T = Record<string, unknown>> {
  key: keyof T | string;
  header: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
}

export interface TableProps<T = Record<string, unknown>> {
  columns: TableColumn<T>[];
  data: T[];
  theme?: ThemeDefinition;
  noColor?: boolean;
}

export const Table = <T extends Record<string, unknown>>({
  columns,
  data,
  theme = OBSIDIAN_THEME,
  noColor = false,
}: TableProps<T>): React.ReactElement => {
  const primaryColor = resolveThemeColor('primary', theme, noColor);
  const mutedColor = resolveThemeColor('muted', theme, noColor);

  return (
    <Box flexDirection="column">
      {/* Header Row */}
      <Box
        flexDirection="row"
        borderBottom={true}
        borderColor={resolveThemeColor('border', theme, noColor)}
      >
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
