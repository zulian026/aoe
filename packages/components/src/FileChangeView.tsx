import React from 'react';
import { Box, Text } from 'ink';
import { OBSIDIAN_THEME, type ThemeDefinition } from '@aoe/themes';
import { resolveThemeColor, getSymbol } from './utils/theme-resolver.js';
import { truncatePath } from './utils/sanitize.js';

export type FileActionType = 'CREATED' | 'MODIFIED' | 'DELETED' | 'RENAMED';

export interface FileChangeItem {
  action: FileActionType;
  path: string;
  oldPath?: string;
  lineDelta?: {
    added?: number;
    removed?: number;
  };
  evidence?: {
    verifiedOnDisk?: boolean;
    hash?: string;
    sizeBytes?: number;
  };
  description?: string;
}

export interface FileChangeViewProps {
  changes: FileChangeItem[];
  maxItems?: number;
  width?: number;
  theme?: ThemeDefinition;
  noColor?: boolean;
  unicode?: boolean;
}

export const FileChangeView: React.FC<FileChangeViewProps> = ({
  changes,
  maxItems = 15,
  width,
  theme = OBSIDIAN_THEME,
  noColor = false,
  unicode = true,
}) => {
  const mutedColor = resolveThemeColor('muted', theme, noColor);
  const successColor = resolveThemeColor('success', theme, noColor);
  const warningColor = resolveThemeColor('warning', theme, noColor);
  const errorColor = resolveThemeColor('error', theme, noColor);
  const infoColor = resolveThemeColor('info', theme, noColor);

  if (!changes || changes.length === 0) {
    return (
      <Box width={width}>
        <Text color={mutedColor}>No file changes recorded.</Text>
      </Box>
    );
  }

  const displayedChanges = changes.slice(0, maxItems);
  const hiddenCount = changes.length - displayedChanges.length;

  return (
    <Box flexDirection="column" width={width}>
      <Box flexDirection="row" marginBottom={1}>
        <Text color={infoColor} bold>
          File Changes ({changes.length}):
        </Text>
      </Box>

      {displayedChanges.map((change, index) => {
        let actionBadge = '';
        let badgeColor = mutedColor;

        switch (change.action) {
          case 'CREATED':
            actionBadge = '+ CREATED ';
            badgeColor = successColor;
            break;
          case 'MODIFIED':
            actionBadge = '~ MODIFIED';
            badgeColor = warningColor;
            break;
          case 'DELETED':
            actionBadge = '- DELETED ';
            badgeColor = errorColor;
            break;
          case 'RENAMED':
            actionBadge = '-> RENAMED';
            badgeColor = infoColor;
            break;
          default:
            actionBadge = '? UNKNOWN ';
            badgeColor = mutedColor;
            break;
        }

        // Line deltas (only if provided)
        let deltaText = '';
        if (change.lineDelta) {
          const added = change.lineDelta.added ?? 0;
          const removed = change.lineDelta.removed ?? 0;
          deltaText = ` (+${added} -${removed})`;
        }

        // Evidence badge
        const isVerified = change.evidence?.verifiedOnDisk === true;
        const evidenceBadge = isVerified ? ` [${getSymbol('disk', unicode)}]` : ' [unverified]';
        const evidenceColor = isVerified ? successColor : mutedColor;

        // Display path
        const displayPath = change.oldPath
          ? `${truncatePath(change.oldPath, 25)} -> ${truncatePath(change.path, 25)}`
          : truncatePath(change.path, 40);

        return (
          <Box key={`${change.path}-${index}`} flexDirection="row" alignItems="center">
            <Text color={badgeColor} bold>
              {actionBadge}{' '}
            </Text>
            <Text>{displayPath}</Text>
            {deltaText ? <Text color={mutedColor}>{deltaText}</Text> : null}
            <Text color={evidenceColor}>{evidenceBadge}</Text>
          </Box>
        );
      })}

      {hiddenCount > 0 ? (
        <Box marginTop={1}>
          <Text color={mutedColor}>... and {hiddenCount} more file changes.</Text>
        </Box>
      ) : null}
    </Box>
  );
};
