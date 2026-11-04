import React from 'react';
import { Box, Text } from 'ink';
import type { AoeTheme } from '@zyanx04/themes';
import type { SidecarFileChange } from '@zyanx04/core';
import { Panel, resolveThemeColor } from '@zyanx04/components';

export interface FileChangesPanelProps {
  fileChanges?: SidecarFileChange[];
  maxEntries?: number;
  width?: number;
  theme?: AoeTheme;
  noColor?: boolean;
}

export const FileChangesPanel: React.FC<FileChangesPanelProps> = ({
  fileChanges = [],
  maxEntries = 5,
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

  // Group counts by action
  let created = 0;
  let modified = 0;
  let deleted = 0;
  let renamed = 0;

  for (const f of fileChanges) {
    if (f.action === 'CREATED') created += 1;
    else if (f.action === 'MODIFIED') modified += 1;
    else if (f.action === 'DELETED') deleted += 1;
    else if (f.action === 'RENAMED') renamed += 1;
  }

  const summaryParts: string[] = [];
  if (created > 0) summaryParts.push(`${created} created`);
  if (modified > 0) summaryParts.push(`${modified} modified`);
  if (deleted > 0) summaryParts.push(`${deleted} deleted`);
  if (renamed > 0) summaryParts.push(`${renamed} renamed`);
  const summaryStr = summaryParts.length > 0 ? summaryParts.join(', ') : '0 changes';

  const visibleChanges = fileChanges.slice(-maxEntries);

  return (
    <Panel
      title="FILE CHANGES"
      metadata={summaryStr}
      width={width}
      theme={theme}
      noColor={noColor}
    >
      <Box flexDirection="column" width="100%">
        {visibleChanges.length === 0 ? (
          <Box paddingY={0}>
            <Text color={subtleColor} italic>
              No file modifications recorded.
            </Text>
          </Box>
        ) : (
          visibleChanges.map((change, idx) => {
            let actionColor = warningColor;
            let actionBadge = '[MODIFIED]';

            if (change.action === 'CREATED') {
              actionColor = successColor;
              actionBadge = '[CREATED] ';
            } else if (change.action === 'DELETED') {
              actionColor = errorColor;
              actionBadge = '[DELETED] ';
            } else if (change.action === 'RENAMED') {
              actionColor = infoColor;
              actionBadge = '[RENAMED] ';
            }

            return (
              <Box key={idx} flexDirection="row" alignItems="center" width="100%">
                <Text color={actionColor} bold>
                  {actionBadge}
                </Text>
                <Box flexShrink={1}>
                  <Text wrap="truncate-end">{change.path}</Text>
                </Box>
                {change.evidence?.verifiedOnDisk && (
                  <Text color={successColor}> [verified on disk]</Text>
                )}
                {change.description && (
                  <Text color={mutedColor}> — {change.description}</Text>
                )}
              </Box>
            );
          })
        )}
      </Box>
    </Panel>
  );
};
