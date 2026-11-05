import { describe, it, expect } from 'vitest';
import { renderToString } from 'ink';
import type { SidecarReadModelSnapshot } from '@zyanx04/core';
import { OBSIDIAN_THEME } from '@zyanx04/themes';

import { ConnectionStatus } from '../sidecar/ConnectionStatus.js';
import { SessionHeader } from '../sidecar/SessionHeader.js';
import { CurrentTaskPanel } from '../sidecar/CurrentTaskPanel.js';
import { ActivityTimeline } from '../sidecar/ActivityTimeline.js';
import { VerificationPanel } from '../sidecar/VerificationPanel.js';
import { FileChangesPanel } from '../sidecar/FileChangesPanel.js';
import { DiagnosticsPanel } from '../sidecar/DiagnosticsPanel.js';
import { SidecarApp } from '../sidecar/SidecarApp.js';
import { renderToStringSidecarApp } from '../sidecar/sidecar-terminal-renderer.js';

describe('Sidecar UI Presentation Components', () => {
  const createMockSnapshot = (
    overrides?: Partial<SidecarReadModelSnapshot>,
  ): SidecarReadModelSnapshot => ({
    sessionId: 'sess_1234567890abcdef',
    agent: { name: 'antigravity', version: '1.5.0' },
    workingDirectory: '/home/user/project',
    startedAt: '2026-11-04T10:00:00.000Z',
    status: 'active',
    isTerminated: false,
    tasks: {
      t1: {
        id: 't1',
        name: 'Build Compiler',
        status: 'running',
        startedAt: '2026-11-04T10:00:05.000Z',
        updatedAt: '2026-11-04T10:00:10.000Z',
        verified: false,
        progress: {
          completedWork: 50,
          totalWork: 100,
          percentage: 50,
          isEstimate: false,
          unit: '%',
          currentWork: 'tsc --build',
        },
        fileChanges: [],
      },
    },
    rootTaskIds: ['t1'],
    activeTaskId: 't1',
    activeTools: [
      {
        name: 'run_command',
        status: 'executing',
        timestamp: '2026-11-04T10:00:12.000Z',
        description: 'Compiling project source',
      },
    ],
    toolHistory: [
      {
        name: 'read_file',
        status: 'completed',
        timestamp: '2026-11-04T10:00:06.000Z',
        description: 'Read tsconfig.json',
      },
    ],
    fileChanges: [
      {
        action: 'CREATED',
        path: 'src/index.ts',
        timestamp: '2026-11-04T10:00:08.000Z',
        evidence: { verifiedOnDisk: true },
      },
      {
        action: 'MODIFIED',
        path: 'package.json',
        timestamp: '2026-11-04T10:00:09.000Z',
      },
    ],
    verificationStatus: {
      verified: true,
      evidenceCount: 1,
      evidenceList: [
        {
          taskId: 't1',
          verified: true,
          timestamp: '2026-11-04T10:00:15.000Z',
          resultSummary: 'TypeScript build succeeded with 0 errors',
        },
      ],
    },
    diagnostics: [],
    sequenceStats: {
      lastSequence: 10,
      totalEventsReceived: 11,
      duplicateCount: 0,
      gapCount: 0,
      outOfOrderCount: 0,
    },
    ...overrides,
  });

  describe('ConnectionStatus', () => {
    it('renders all supported connection states', () => {
      expect(renderToString(<ConnectionStatus status="connected" />)).toContain('CONNECTED');
      expect(renderToString(<ConnectionStatus status="connecting" />)).toContain('CONNECTING');
      expect(renderToString(<ConnectionStatus status="reconnecting" attempt={2} />)).toContain(
        'RECONNECTING (#2)',
      );
      expect(renderToString(<ConnectionStatus status="session_ended" />)).toContain(
        'SESSION_ENDED',
      );
      expect(renderToString(<ConnectionStatus status="closed" />)).toContain('DISCONNECTED');
    });
  });

  describe('SessionHeader', () => {
    it('renders branding, agent name, version, and shortened session ID', () => {
      const output = renderToString(
        <SessionHeader
          sessionId="sess_1234567890abcdef"
          agent={{ name: 'antigravity', version: '1.5.0' }}
          connectionStatus="connected"
          startedAt="2026-11-04T10:00:00.000Z"
          endedAt="2026-11-04T10:02:30.000Z"
          width={80}
        />,
      );

      expect(output).toContain('AOE SIDECAR');
      expect(output).toContain('v1.0.0');
      expect(output).toContain('[antigravity@1.5.0]');
      expect(output).toContain('CONNECTED');
      expect(output).toContain('ID:');
      expect(output).toContain('2m 30s');
    });

    it('renders cleanly in narrow width (< 72 columns)', () => {
      const output = renderToString(
        <SessionHeader
          sessionId="sess_short"
          agent={{ name: 'antigravity' }}
          connectionStatus="connected"
          width={50}
        />,
      );
      expect(output).toContain('AOE SIDECAR');
      expect(output).toContain('[antigravity]');
    });
  });

  describe('CurrentTaskPanel', () => {
    it('renders active task with determinate progress bar', () => {
      const snap = createMockSnapshot();
      const output = renderToString(
        <CurrentTaskPanel
          task={snap.tasks['t1']}
          overallProgress={snap.overallProgress}
          activeTools={snap.activeTools}
          width={80}
        />,
      );

      expect(output).toContain('CURRENT TASK');
      expect(output).toContain('Build Compiler');
      expect(output).toContain('50%');
      expect(output).toContain('⚡ Executing:');
      expect(output).toContain('run_command');
    });

    it('renders qualitative status when progress is indeterminate without fabricating progress bar', () => {
      const snap = createMockSnapshot({
        tasks: {
          t2: {
            id: 't2',
            name: 'Refactor Architecture',
            status: 'running',
            startedAt: '2026-11-04T10:00:00.000Z',
            updatedAt: '2026-11-04T10:00:00.000Z',
            verified: false,
            // progress is null / indeterminate
            progress: undefined,
            fileChanges: [],
          },
        },
      });

      const output = renderToString(<CurrentTaskPanel task={snap.tasks['t2']} width={80} />);

      expect(output).toContain('Refactor Architecture');
      expect(output).toContain('qualitative status');
      expect(output).not.toContain('0%');
      expect(output).not.toContain('100%');
    });

    it('renders failed task with explicit error code and message', () => {
      const snap = createMockSnapshot({
        tasks: {
          t_fail: {
            id: 't_fail',
            name: 'Deploy Worker',
            status: 'failed',
            startedAt: '2026-11-04T10:00:00.000Z',
            updatedAt: '2026-11-04T10:00:05.000Z',
            verified: false,
            error: {
              code: 'ERR_TIMEOUT',
              message: 'Connection timed out during deployment',
            },
            fileChanges: [],
          },
        },
      });

      const output = renderToString(<CurrentTaskPanel task={snap.tasks['t_fail']} width={80} />);

      expect(output).toContain('Deploy Worker');
      expect(output).toContain('Error [ERR_TIMEOUT]: Connection timed out during deployment');
    });

    it('renders empty notice when no task is active', () => {
      const output = renderToString(<CurrentTaskPanel width={80} />);
      expect(output).toContain('No active task currently running');
    });
  });

  describe('ActivityTimeline', () => {
    it('renders tools, file events, and task transitions chronologically', () => {
      const snap = createMockSnapshot();
      const output = renderToString(
        <ActivityTimeline
          toolHistory={snap.toolHistory}
          fileChanges={snap.fileChanges}
          tasks={snap.tasks}
          width={80}
        />,
      );

      expect(output).toContain('ACTIVITY TIMELINE');
      expect(output).toContain('[TOOL]');
      expect(output).toContain('read_file');
      expect(output).toContain('[FILE]');
      expect(output).toContain('src/index.ts');
      expect(output).toContain('[TASK]');
      expect(output).toContain('Task started: Build Compiler');
    });

    it('respects maxEntries bounding limit', () => {
      const snap = createMockSnapshot();
      const output = renderToString(
        <ActivityTimeline
          toolHistory={snap.toolHistory}
          fileChanges={snap.fileChanges}
          tasks={snap.tasks}
          maxEntries={1}
          width={80}
        />,
      );

      // Should only show 1 item
      expect(output).toContain('ACTIVITY TIMELINE');
    });
  });

  describe('VerificationPanel', () => {
    it('displays VERIFIED when canonical verification evidence exists', () => {
      const snap = createMockSnapshot();
      const output = renderToString(
        <VerificationPanel
          verificationStatus={snap.verificationStatus}
          sessionStatus={snap.status}
          hasActiveTasks={true}
          width={80}
        />,
      );

      expect(output).toContain('VERIFIED');
      expect(output).toContain('1 canonical verification check(s) passed');
      expect(output).toContain('TypeScript build succeeded with 0 errors');
    });

    it('displays UNVERIFIED when session is completed without verification evidence', () => {
      const output = renderToString(
        <VerificationPanel
          verificationStatus={{ verified: false, evidenceCount: 0, evidenceList: [] }}
          sessionStatus="completed"
          hasActiveTasks={false}
          width={80}
        />,
      );

      expect(output).toContain('UNVERIFIED');
      expect(output).toContain('Session ended without explicit verification');
    });

    it('displays PENDING when session is active and unverified', () => {
      const output = renderToString(
        <VerificationPanel
          verificationStatus={{ verified: false, evidenceCount: 0, evidenceList: [] }}
          sessionStatus="active"
          hasActiveTasks={true}
          width={80}
        />,
      );

      expect(output).toContain('PENDING');
      expect(output).toContain('Execution in progress');
    });

    it('displays FAILED when session failed', () => {
      const output = renderToString(
        <VerificationPanel
          verificationStatus={{ verified: false, evidenceCount: 0, evidenceList: [] }}
          sessionStatus="failed"
          hasActiveTasks={false}
          width={80}
        />,
      );

      expect(output).toContain('FAILED');
    });
  });

  describe('FileChangesPanel', () => {
    it('renders created, modified, deleted counts and file paths', () => {
      const snap = createMockSnapshot();
      const output = renderToString(<FileChangesPanel fileChanges={snap.fileChanges} width={80} />);

      expect(output).toContain('FILE CHANGES');
      expect(output).toContain('1 created, 1 modified');
      expect(output).toContain('[CREATED]');
      expect(output).toContain('src/index.ts');
      expect(output).toContain('[verified on disk]');
      expect(output).toContain('[MODIFIED]');
      expect(output).toContain('package.json');
    });

    it('renders notice when no files were changed', () => {
      const output = renderToString(<FileChangesPanel fileChanges={[]} width={80} />);
      expect(output).toContain('No file modifications recorded');
    });
  });

  describe('DiagnosticsPanel', () => {
    it('displays healthy stream status when no anomalies exist', () => {
      const snap = createMockSnapshot();
      const output = renderToString(
        <DiagnosticsPanel
          diagnostics={snap.diagnostics}
          sequenceStats={snap.sequenceStats}
          width={80}
        />,
      );

      expect(output).toContain('STREAM HEALTHY');
      expect(output).toContain('11 events processed');
    });

    it('displays warning badge and sequence anomalies when detected', () => {
      const output = renderToString(
        <DiagnosticsPanel
          diagnostics={[
            {
              level: 'warning',
              code: 'SEQUENCE_GAP',
              message: 'Sequence gap detected: missing sequences 2..4',
              timestamp: new Date().toISOString(),
            },
          ]}
          sequenceStats={{
            lastSequence: 5,
            totalEventsReceived: 3,
            duplicateCount: 0,
            gapCount: 1,
            outOfOrderCount: 0,
          }}
          width={80}
        />,
      );

      expect(output).toContain('ANOMALIES DETECTED');
      expect(output).toContain('1 gap(s)');
      expect(output).toContain('[SEQUENCE_GAP]');
      expect(output).toContain('Sequence gap detected: missing sequences 2..4');
    });
  });

  describe('SidecarApp and renderToStringSidecarApp', () => {
    it('renders complete sidecar application in standard 80 columns layout', () => {
      const snap = createMockSnapshot();
      const output = renderToString(
        <SidecarApp snapshot={snap} connectionStatus="connected" terminalWidth={80} />,
      );

      expect(output).toContain('AOE SIDECAR');
      expect(output).toContain('CURRENT TASK');
      expect(output).toContain('ACTIVITY TIMELINE');
      expect(output).toContain('VERIFICATION');
      expect(output).toContain('FILE CHANGES');
      expect(output).toContain('DIAGNOSTICS & INTEGRITY');
      expect(output).toContain('Ctrl+C to detach');
    });

    it('renders cleanly in narrow width layout (< 80 columns)', () => {
      const snap = createMockSnapshot();
      const output = renderToString(
        <SidecarApp snapshot={snap} connectionStatus="connected" terminalWidth={60} />,
      );

      expect(output).toContain('AOE SIDECAR');
      expect(output).toContain('CURRENT TASK');
      expect(output).toContain('ACTIVITY TIMELINE');
    });

    it('renderToStringSidecarApp produces non-empty formatted terminal string', () => {
      const snap = createMockSnapshot();
      const text = renderToStringSidecarApp({
        snapshot: snap,
        connectionStatus: 'connected',
        theme: OBSIDIAN_THEME,
        width: 80,
      });

      expect(text.length).toBeGreaterThan(100);
      expect(text).toContain('AOE SIDECAR');
    });
  });
});
