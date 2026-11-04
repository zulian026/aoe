import React from 'react';
import { Box, Text } from 'ink';
import type { AoeTheme } from '@zyanx04/themes';
import type { SidecarTaskModel, SidecarProgress, SidecarToolActivity } from '@zyanx04/core';
import {
  Panel,
  StatusIndicator,
  ProgressBar,
  resolveThemeColor,
  type StatusType,
} from '@zyanx04/components';

export interface CurrentTaskPanelProps {
  task?: SidecarTaskModel;
  overallProgress?: SidecarProgress;
  activeTools?: SidecarToolActivity[];
  width?: number;
  theme?: AoeTheme;
  noColor?: boolean;
}

export const CurrentTaskPanel: React.FC<CurrentTaskPanelProps> = ({
  task,
  overallProgress,
  activeTools = [],
  width,
  theme,
  noColor = false,
}) => {
  const mutedColor = resolveThemeColor('foregroundMuted', theme, noColor);
  const subtleColor = resolveThemeColor('foregroundSubtle', theme, noColor);
  const warningColor = resolveThemeColor('warning', theme, noColor);
  const errorColor = resolveThemeColor('error', theme, noColor);
  const primaryColor = resolveThemeColor('primary', theme, noColor);

  if (!task) {
    return (
      <Panel title="CURRENT TASK" width={width} theme={theme} noColor={noColor}>
        <Box paddingY={1}>
          <Text color={subtleColor} italic>
            No active task currently running. Waiting for agent activity...
          </Text>
        </Box>
      </Panel>
    );
  }

  const taskStatus: StatusType =
    task.status === 'running'
      ? 'running'
      : task.status === 'completed'
        ? 'completed'
        : task.status === 'failed'
          ? 'failed'
          : task.status === 'warning'
            ? 'warning'
            : 'idle';

  // Determine progress source (task-specific or overall)
  const progress = task.progress ?? overallProgress;
  const hasDeterminatePercentage =
    progress &&
    typeof progress.percentage === 'number' &&
    !Number.isNaN(progress.percentage) &&
    progress.percentage !== null;

  // Active tools
  const activeTool: SidecarToolActivity | undefined =
    activeTools.find((t) => t.status === 'executing') ??
    (progress?.currentWork
      ? {
          name: progress.currentWork,
          status: 'executing',
          timestamp: new Date().toISOString(),
          description: undefined,
        }
      : undefined);

  // Check parent relationship from metadata
  const parentTaskId = task.metadata?.parentTaskId as string | undefined;

  return (
    <Panel
      title="CURRENT TASK"
      metadata={`[${task.id}]`}
      width={width}
      theme={theme}
      noColor={noColor}
    >
      <Box flexDirection="column" width="100%">
        {/* Task Name and Status */}
        <Box flexDirection="row" alignItems="center" justifyContent="space-between">
          <Box flexDirection="row" alignItems="center" flexShrink={1}>
            <StatusIndicator status={taskStatus} theme={theme} noColor={noColor} />
            <Box marginLeft={1}>
              <Text bold color={task.status === 'failed' ? errorColor : undefined}>
                {task.name}
              </Text>
            </Box>
          </Box>
          {parentTaskId && (
            <Text color={subtleColor}>
              parent: <Text color={mutedColor}>{parentTaskId}</Text>
            </Text>
          )}
        </Box>

        {/* Active Tool Execution */}
        {activeTool && (
          <Box marginTop={1} flexDirection="row" alignItems="center">
            <Text color={warningColor} bold>
              ⚡ Executing:{' '}
            </Text>
            <Text color={primaryColor}>{activeTool.name}</Text>
            {activeTool.description && (
              <Text color={mutedColor}> — {activeTool.description}</Text>
            )}
          </Box>
        )}

        {/* Progress Section: STRICT INVARIANT */}
        {/* Never fabricate percentage completion! */}
        <Box marginTop={1} flexDirection="column">
          {hasDeterminatePercentage ? (
            <ProgressBar
              percentage={progress.percentage!}
              completedWork={progress.completedWork}
              totalWork={progress.totalWork}
              unit={progress.unit}
              width={Math.min(36, (width ?? 80) - 20)}
              theme={theme}
              noColor={noColor}
            />
          ) : (
            <Box flexDirection="row" alignItems="center">
              <Text color={subtleColor}>Progress: </Text>
              <Text color={task.status === 'running' ? warningColor : mutedColor}>
                {task.status === 'running'
                  ? 'Active · executing task instructions'
                  : task.status === 'completed'
                    ? 'Completed'
                    : task.status === 'failed'
                      ? 'Failed'
                      : 'Idle'}
              </Text>
              <Text color={subtleColor}> (qualitative status · no arbitrary % bar)</Text>
            </Box>
          )}
        </Box>

        {/* Error Display */}
        {task.error && (
          <Box
            marginTop={1}
            paddingX={1}
            borderStyle="single"
            borderColor={errorColor}
            flexDirection="column"
          >
            <Text color={errorColor} bold>
              Error [{task.error.code}]: {task.error.message}
            </Text>
          </Box>
        )}
      </Box>
    </Panel>
  );
};
