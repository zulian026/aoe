import React from 'react';
import { Box, Text } from 'ink';
import type { AoeTheme } from '@zyanx04/themes';
import type { SidecarToolActivity, SidecarFileChange, SidecarTaskModel } from '@zyanx04/core';
import { Panel, resolveThemeColor } from '@zyanx04/components';

export interface TimelineEntry {
  id: string;
  category: 'tool' | 'file' | 'task' | 'session';
  title: string;
  detail?: string;
  timestamp: string;
  status?: 'running' | 'completed' | 'failed' | 'info';
}

export interface ActivityTimelineProps {
  toolHistory?: SidecarToolActivity[];
  fileChanges?: SidecarFileChange[];
  tasks?: Record<string, SidecarTaskModel>;
  maxEntries?: number;
  width?: number;
  theme?: AoeTheme;
  noColor?: boolean;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  toolHistory = [],
  fileChanges = [],
  tasks = {},
  maxEntries = 8,
  width,
  theme,
  noColor = false,
}) => {
  const primaryColor = resolveThemeColor('primary', theme, noColor);
  const secondaryColor = resolveThemeColor('secondary', theme, noColor);
  const successColor = resolveThemeColor('success', theme, noColor);
  const warningColor = resolveThemeColor('warning', theme, noColor);
  const errorColor = resolveThemeColor('error', theme, noColor);
  const mutedColor = resolveThemeColor('foregroundMuted', theme, noColor);
  const subtleColor = resolveThemeColor('foregroundSubtle', theme, noColor);

  // Aggregate items into normalized timeline entries
  const entries: TimelineEntry[] = [];

  // Add tasks
  for (const t of Object.values(tasks)) {
    entries.push({
      id: `task_start_${t.id}`,
      category: 'task',
      title: `Task started: ${t.name}`,
      timestamp: t.startedAt,
      status: 'info',
    });
    if (t.completedAt) {
      entries.push({
        id: `task_end_${t.id}`,
        category: 'task',
        title: `Task ${t.status}: ${t.name}`,
        detail: t.metadata?.resultSummary as string | undefined,
        timestamp: t.completedAt,
        status: t.status === 'completed' ? 'completed' : 'failed',
      });
    }
  }

  // Add tool activities
  for (const tool of toolHistory) {
    entries.push({
      id: `tool_${tool.timestamp}_${tool.name}`,
      category: 'tool',
      title: tool.name,
      detail: tool.description,
      timestamp: tool.timestamp,
      status:
        tool.status === 'completed'
          ? 'completed'
          : tool.status === 'failed'
            ? 'failed'
            : 'running',
    });
  }

  // Add file changes
  for (const f of fileChanges) {
    entries.push({
      id: `file_${f.timestamp}_${f.path}`,
      category: 'file',
      title: `${f.action} ${f.path}`,
      detail: f.evidence?.verifiedOnDisk ? 'verified on disk' : undefined,
      timestamp: f.timestamp,
      status: f.action === 'DELETED' ? 'failed' : 'completed',
    });
  }

  // Sort chronologically ascending, then slice the most recent
  entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const visibleEntries = entries.slice(-maxEntries);

  const formatTime = (iso: string): string => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '00:00:00';
      return d.toTimeString().split(' ')[0] ?? iso;
    } catch {
      return iso;
    }
  };

  return (
    <Panel
      title="ACTIVITY TIMELINE"
      metadata={`${entries.length} event(s)`}
      width={width}
      theme={theme}
      noColor={noColor}
    >
      <Box flexDirection="column" width="100%">
        {visibleEntries.length === 0 ? (
          <Box paddingY={1}>
            <Text color={subtleColor} italic>
              No observable activities recorded yet.
            </Text>
          </Box>
        ) : (
          visibleEntries.map((item) => {
            let catColor = primaryColor;
            let catBadge = '[ACT]';
            if (item.category === 'tool') {
              catColor = secondaryColor;
              catBadge = '[TOOL]';
            } else if (item.category === 'file') {
              catColor = successColor;
              catBadge = '[FILE]';
            } else if (item.category === 'task') {
              catColor = primaryColor;
              catBadge = '[TASK]';
            }

            let statusSymbol = '•';
            let statusColor = mutedColor;
            if (item.status === 'completed') {
              statusSymbol = '✔';
              statusColor = successColor;
            } else if (item.status === 'failed') {
              statusSymbol = '✖';
              statusColor = errorColor;
            } else if (item.status === 'running') {
              statusSymbol = '⠋';
              statusColor = warningColor;
            }

            return (
              <Box key={item.id} flexDirection="row" alignItems="center" width="100%">
                <Text color={subtleColor}>{formatTime(item.timestamp)} </Text>
                <Text color={catColor} bold>
                  {catBadge}{' '}
                </Text>
                <Text color={statusColor}>{statusSymbol} </Text>
                <Box flexShrink={1}>
                  <Text wrap="truncate-end">{item.title}</Text>
                </Box>
                {item.detail && (
                  <Text color={subtleColor} wrap="truncate-end">
                    {' '}({item.detail})
                  </Text>
                )}
              </Box>
            );
          })
        )}
      </Box>
    </Panel>
  );
};
