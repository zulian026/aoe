import React from 'react';
import { Box, Text } from 'ink';
import type { AoeTheme } from '@aoe/themes';
import { StatusIndicator, type StatusType } from './StatusIndicator.js';
import { resolveThemeColor, getSymbol } from './utils/theme-resolver.js';
import { formatDuration, clamp } from './utils/sanitize.js';
import { useTheme } from './theme-context.js';

export interface TaskSummaryItem {
  id: string;
  name: string;
  status: StatusType;
  depth?: number;
  durationMs?: number;
  progress?: {
    percentage?: number;
    isEstimate?: boolean;
  };
  children?: TaskSummaryItem[];
}

export interface TaskSummaryProps {
  tasks: TaskSummaryItem[];
  maxDepth?: number;
  width?: number;
  theme?: AoeTheme;
  noColor?: boolean;
  unicode?: boolean;
}

export const TaskSummary: React.FC<TaskSummaryProps> = ({
  tasks,
  maxDepth = 3,
  width,
  theme: explicitTheme,
  noColor = false,
  unicode = true,
}) => {
  const activeTheme = useTheme(explicitTheme);
  const mutedColor = resolveThemeColor('foregroundMuted', activeTheme, noColor);
  const secondaryColor = resolveThemeColor('secondary', activeTheme, noColor);

  if (!tasks || tasks.length === 0) {
    return (
      <Box width={width}>
        <Text color={mutedColor}>No tasks registered.</Text>
      </Box>
    );
  }

  // Aggregate counts
  let completedCount = 0;
  let runningCount = 0;
  let failedCount = 0;
  let otherCount = 0;

  const countTasks = (items: TaskSummaryItem[]) => {
    for (const item of items) {
      if (item.status === 'completed') completedCount++;
      else if (item.status === 'running') runningCount++;
      else if (item.status === 'failed') failedCount++;
      else otherCount++;

      if (item.children && item.children.length > 0) {
        countTasks(item.children);
      }
    }
  };
  countTasks(tasks);

  const totalCount = completedCount + runningCount + failedCount + otherCount;

  // Flatten tree with depth and indentation connectors
  interface FlattenedTask {
    item: TaskSummaryItem;
    depth: number;
    isLastChild: boolean;
  }

  const flattened: FlattenedTask[] = [];

  const flatten = (items: TaskSummaryItem[], currentDepth: number) => {
    const effectiveDepth = clamp(currentDepth, 0, maxDepth);
    items.forEach((item, index) => {
      const isLastChild = index === items.length - 1;
      flattened.push({ item, depth: effectiveDepth, isLastChild });

      if (item.children && item.children.length > 0) {
        flatten(item.children, effectiveDepth + 1);
      }
    });
  };
  flatten(tasks, 0);

  return (
    <Box flexDirection="column" width={width}>
      {/* Header stats summary */}
      <Box flexDirection="row" marginBottom={1}>
        <Text color={secondaryColor} bold>
          Tasks ({totalCount}):{' '}
        </Text>
        <Text color={mutedColor}>
          {completedCount} completed, {runningCount} running, {failedCount} failed
          {otherCount > 0 ? `, ${otherCount} other` : ''}
        </Text>
      </Box>

      {/* Hierarchical list */}
      {flattened.map(({ item, depth, isLastChild }) => {
        const indentSpaces = '  '.repeat(depth);
        const connector =
          depth > 0
            ? isLastChild
              ? getSymbol('treeLastBranch', unicode, activeTheme)
              : getSymbol('treeBranch', unicode, activeTheme)
            : '';

        const durationText = item.durationMs ? ` (${formatDuration(item.durationMs)})` : '';
        const progressText =
          item.progress?.percentage !== undefined
            ? ` [${item.progress.isEstimate ? '~' : ''}${item.progress.percentage}%]`
            : '';

        return (
          <Box key={item.id} flexDirection="row" alignItems="center">
            <Text color={mutedColor}>
              {indentSpaces}
              {connector}
            </Text>
            <StatusIndicator
              status={item.status}
              theme={activeTheme}
              noColor={noColor}
              unicode={unicode}
            />
            <Text bold={depth === 0}> {item.name}</Text>
            {progressText ? <Text color={mutedColor}>{progressText}</Text> : null}
            {durationText ? <Text color={mutedColor}>{durationText}</Text> : null}
          </Box>
        );
      })}
    </Box>
  );
};
