import React, { useState, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import type {
  SidecarConsumer,
  SidecarReadModelSnapshot,
  SidecarConnectionStatus,
} from '@zyanx04/core';
import { OBSIDIAN_THEME, type AoeTheme, type ThemeDefinition } from '@zyanx04/themes';
import { ThemeProvider, resolveThemeColor } from '@zyanx04/components';

import { SessionHeader } from './SessionHeader.js';
import { CurrentTaskPanel } from './CurrentTaskPanel.js';
import { ActivityTimeline } from './ActivityTimeline.js';
import { VerificationPanel } from './VerificationPanel.js';
import { FileChangesPanel } from './FileChangesPanel.js';
import { DiagnosticsPanel } from './DiagnosticsPanel.js';

export interface SidecarAppProps {
  consumer?: SidecarConsumer;
  snapshot?: SidecarReadModelSnapshot;
  connectionStatus?: SidecarConnectionStatus | 'session_ended';
  theme?: AoeTheme | ThemeDefinition;
  noColor?: boolean;
  unicode?: boolean;
  terminalWidth?: number;
}

const DEFAULT_EMPTY_SNAPSHOT: SidecarReadModelSnapshot = {
  status: 'uninitialized',
  isTerminated: false,
  tasks: {},
  rootTaskIds: [],
  activeTools: [],
  toolHistory: [],
  fileChanges: [],
  verificationStatus: {
    verified: false,
    evidenceCount: 0,
    evidenceList: [],
  },
  diagnostics: [],
  sequenceStats: {
    lastSequence: -1,
    totalEventsReceived: 0,
    duplicateCount: 0,
    gapCount: 0,
    outOfOrderCount: 0,
  },
};

export const SidecarApp: React.FC<SidecarAppProps> = ({
  consumer,
  snapshot: initialSnapshot,
  connectionStatus: initialConnStatus,
  theme = OBSIDIAN_THEME,
  noColor = false,
  terminalWidth: explicitWidth,
}) => {
  const { stdout } = useStdout();
  const activeTheme = theme as AoeTheme;

  // Track reactive read-model state
  const [snapshot, setSnapshot] = useState<SidecarReadModelSnapshot>(() => {
    if (initialSnapshot) return initialSnapshot;
    if (consumer) return consumer.getSnapshot();
    return DEFAULT_EMPTY_SNAPSHOT;
  });

  // Track reactive connection status
  const [connectionStatus, setConnectionStatus] = useState<
    SidecarConnectionStatus | 'session_ended'
  >(() => {
    if (initialConnStatus) return initialConnStatus;
    if (snapshot.isTerminated) return 'session_ended';
    if (consumer) return consumer.getStatus();
    return 'idle';
  });

  // Subscribe to live consumer updates if consumer provided
  useEffect(() => {
    if (!consumer) return;

    const onStateUpdate = (snap: SidecarReadModelSnapshot) => {
      setSnapshot(snap);
      if (snap.isTerminated) {
        setConnectionStatus('session_ended');
      }
    };

    const onStatusUpdate = (st: SidecarConnectionStatus) => {
      if (snapshot.isTerminated) {
        setConnectionStatus('session_ended');
      } else {
        setConnectionStatus(st);
      }
    };

    consumer.on('state', onStateUpdate);
    consumer.on('status', onStatusUpdate);

    return () => {
      consumer.off('state', onStateUpdate);
      consumer.off('status', onStatusUpdate);
    };
  }, [consumer, snapshot.isTerminated]);

  // Determine terminal width
  const outCols = (stdout as unknown as { columns?: number })?.columns ?? process.stdout?.columns;
  const columns = explicitWidth ?? (outCols ? Math.max(40, outCols) : 80);
  const isNarrow = columns < 100;

  const subtleColor = resolveThemeColor('foregroundSubtle', activeTheme, noColor);

  // Active task resolution
  const activeTask =
    snapshot.currentTask ??
    (snapshot.activeTaskId ? snapshot.tasks[snapshot.activeTaskId] : undefined);

  return (
    <ThemeProvider theme={activeTheme}>
      <Box flexDirection="column" width={columns} paddingX={0}>
        {/* 1. Session Header */}
        <SessionHeader
          sessionId={snapshot.sessionId}
          agent={snapshot.agent}
          connectionStatus={connectionStatus}
          startedAt={snapshot.startedAt}
          endedAt={snapshot.endedAt}
          durationMs={snapshot.durationMs}
          width={columns}
          theme={activeTheme}
          noColor={noColor}
        />

        {/* 2. Current Task Panel */}
        <CurrentTaskPanel
          task={activeTask}
          overallProgress={snapshot.overallProgress}
          activeTools={snapshot.activeTools}
          width={columns}
          theme={activeTheme}
          noColor={noColor}
        />

        {/* 3. Middle Section: Activity Timeline & Verification / Files */}
        {isNarrow ? (
          // Narrow Layout: Stack all panels vertically
          <Box flexDirection="column" width={columns}>
            <ActivityTimeline
              toolHistory={snapshot.toolHistory}
              fileChanges={snapshot.fileChanges}
              tasks={snapshot.tasks}
              width={columns}
              theme={activeTheme}
              noColor={noColor}
            />
            <VerificationPanel
              verificationStatus={snapshot.verificationStatus}
              sessionStatus={snapshot.status}
              hasActiveTasks={Boolean(snapshot.activeTaskId)}
              width={columns}
              theme={activeTheme}
              noColor={noColor}
            />
            <FileChangesPanel
              fileChanges={snapshot.fileChanges}
              width={columns}
              theme={activeTheme}
              noColor={noColor}
            />
          </Box>
        ) : (
          // Standard / Wide Layout: 2 Columns
          <Box flexDirection="row" width={columns} justifyContent="space-between">
            {/* Left Column: Timeline */}
            <Box flexDirection="column" width={Math.floor(columns * 0.58)}>
              <ActivityTimeline
                toolHistory={snapshot.toolHistory}
                fileChanges={snapshot.fileChanges}
                tasks={snapshot.tasks}
                width={Math.floor(columns * 0.58)}
                theme={activeTheme}
                noColor={noColor}
              />
            </Box>

            {/* Right Column: Verification & File Changes */}
            <Box flexDirection="column" width={Math.floor(columns * 0.41)}>
              <VerificationPanel
                verificationStatus={snapshot.verificationStatus}
                sessionStatus={snapshot.status}
                hasActiveTasks={Boolean(snapshot.activeTaskId)}
                width={Math.floor(columns * 0.41)}
                theme={activeTheme}
                noColor={noColor}
              />
              <FileChangesPanel
                fileChanges={snapshot.fileChanges}
                width={Math.floor(columns * 0.41)}
                theme={activeTheme}
                noColor={noColor}
              />
            </Box>
          </Box>
        )}

        {/* 4. Diagnostics & Integrity Panel */}
        <DiagnosticsPanel
          diagnostics={snapshot.diagnostics}
          sequenceStats={snapshot.sequenceStats}
          width={columns}
          theme={activeTheme}
          noColor={noColor}
        />

        {/* 5. Footer Hint */}
        <Box
          flexDirection="row"
          justifyContent="space-between"
          width={columns}
          paddingX={1}
          marginTop={0}
        >
          <Text color={subtleColor}>[AOE Sidecar] Ctrl+C to detach cleanly from session</Text>
          <Text color={subtleColor}>Real-time IPC streaming</Text>
        </Box>
      </Box>
    </ThemeProvider>
  );
};
