import React from 'react';
import { Box } from 'ink';
import type { SessionSnapshot } from '@zyanx04/core';
import { OBSIDIAN_THEME, type AoeTheme, type ThemeDefinition } from '@zyanx04/themes';
import {
  ThemeProvider,
  Panel,
  StatusIndicator,
  ProgressBar,
  TaskSummary,
  FileChangeView,
  DiagnosticsPanel,
  ExecutionLog,
  ResultView,
  type TaskSummaryItem,
  type StatusType,
  type LogItem,
  type ResultItem,
  formatDuration,
} from '@zyanx04/components';

export interface InteractiveAppProps {
  snapshot: SessionSnapshot;
  theme?: AoeTheme | ThemeDefinition;
  noColor?: boolean;
  unicode?: boolean;
  animated?: boolean;
  width?: number;
  logs?: LogItem[];
  results?: ResultItem[];
}

export const InteractiveApp: React.FC<InteractiveAppProps> = ({
  snapshot,
  theme = OBSIDIAN_THEME,
  noColor = false,
  unicode = true,
  animated = false,
  width,
  logs = [],
  results = [],
}) => {
  // Map session status to StatusType
  const sessionStatus: StatusType =
    snapshot.status === 'active'
      ? 'running'
      : snapshot.status === 'completed'
        ? 'completed'
        : snapshot.status === 'failed'
          ? 'failed'
          : snapshot.status === 'cancelled'
            ? 'cancelled'
            : 'idle';

  // Build task tree from rootTaskIds
  const buildTaskTree = (taskIds: readonly string[]): TaskSummaryItem[] => {
    const items: TaskSummaryItem[] = [];
    for (const id of taskIds) {
      const task = snapshot.tasks.get(id);
      if (!task) continue;

      const taskStatus: StatusType =
        task.status === 'running'
          ? 'running'
          : task.status === 'completed'
            ? 'completed'
            : task.status === 'failed'
              ? 'failed'
              : task.status === 'blocked'
                ? 'blocked'
                : task.status === 'warning'
                  ? 'warning'
                  : 'idle';

      const item: TaskSummaryItem = {
        id: task.id,
        name: task.name,
        status: taskStatus,
        depth: task.depth,
        durationMs: task.durationMs,
        progress: task.progress
          ? {
              percentage: task.progress.percentage ?? undefined,
              isEstimate: task.progress.isEstimate,
            }
          : undefined,
        children: task.childTaskIds ? buildTaskTree(task.childTaskIds) : undefined,
      };
      items.push(item);
    }
    return items;
  };

  const taskTree = buildTaskTree(snapshot.rootTaskIds);

  const durationStr = snapshot.durationMs ? formatDuration(snapshot.durationMs) : '0ms';
  const agentStr = snapshot.agent?.name ? ` [${snapshot.agent.name}]` : '';

  return (
    <ThemeProvider theme={theme}>
      <Box flexDirection="column" width={width}>
        {/* Session Header Panel */}
        <Panel
          title={`AOE Session ${snapshot.sessionId}${agentStr}`}
          metadata={`Duration: ${durationStr}`}
          borderStyle="round"
          theme={theme}
          noColor={noColor}
        >
          <Box flexDirection="row" alignItems="center" marginBottom={1}>
            <StatusIndicator
              status={sessionStatus}
              label={`Session ${snapshot.status.toUpperCase()}`}
              theme={theme}
              noColor={noColor}
              unicode={unicode}
              animated={animated}
            />
          </Box>

          {/* Overall Progress */}
          {snapshot.progress ? (
            <Box marginBottom={1}>
              <ProgressBar
                completedWork={snapshot.progress.completedWork}
                totalWork={snapshot.progress.totalWork}
                verifiedWork={snapshot.progress.verifiedWork}
                isEstimate={snapshot.progress.isEstimate}
                percentage={snapshot.progress.percentage ?? undefined}
                unit={snapshot.progress.unit}
                description={snapshot.progress.description}
                width={30}
                theme={theme}
                noColor={noColor}
                unicode={unicode}
              />
            </Box>
          ) : null}

          {/* Task Summary */}
          <Box marginBottom={1}>
            <TaskSummary tasks={taskTree} theme={theme} noColor={noColor} unicode={unicode} />
          </Box>

          {/* File Changes (if any) */}
          {snapshot.fileChanges && snapshot.fileChanges.length > 0 ? (
            <Box marginBottom={1}>
              <FileChangeView
                changes={[...snapshot.fileChanges]}
                theme={theme}
                noColor={noColor}
                unicode={unicode}
              />
            </Box>
          ) : null}

          {/* Diagnostics (if any) */}
          {snapshot.diagnostics && snapshot.diagnostics.length > 0 ? (
            <Box marginBottom={1}>
              <DiagnosticsPanel
                diagnostics={[...snapshot.diagnostics]}
                theme={theme}
                noColor={noColor}
                unicode={unicode}
              />
            </Box>
          ) : null}

          {/* Execution Logs (if any) */}
          {logs.length > 0 ? (
            <Box marginBottom={1}>
              <ExecutionLog logs={logs} theme={theme} noColor={noColor} />
            </Box>
          ) : null}

          {/* Results (if any) */}
          {results.length > 0 ? (
            <Box>
              <ResultView
                results={results}
                sessionStatus={snapshot.status}
                theme={theme}
                noColor={noColor}
                unicode={unicode}
              />
            </Box>
          ) : null}
        </Panel>
      </Box>
    </ThemeProvider>
  );
};
