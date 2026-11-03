import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { OBSIDIAN_THEME, LIGHT_THEME, HIGH_CONTRAST_THEME, type AoeTheme } from '@aoe/themes';
import {
  ThemeProvider,
  useTheme,
  StatusIndicator,
  ProgressBar,
  Panel,
  Table,
  TaskSummary,
  FileChangeView,
  DiagnosticsPanel,
  ExecutionLog,
  ResultView,
} from '../index.js';

describe('Components Theme Integration', () => {
  it('useTheme returns OBSIDIAN_THEME by default when no provider is present', () => {
    let resolvedTheme: AoeTheme | undefined;
    const TestComp = () => {
      resolvedTheme = useTheme();
      return null;
    };
    render(<TestComp />);
    expect(resolvedTheme?.id).toBe(OBSIDIAN_THEME.id);
  });

  it('ThemeProvider provides active theme to nested components', () => {
    let resolvedTheme: AoeTheme | undefined;
    const TestComp = () => {
      resolvedTheme = useTheme();
      return null;
    };
    render(
      <ThemeProvider theme={LIGHT_THEME}>
        <TestComp />
      </ThemeProvider>,
    );
    expect(resolvedTheme?.id).toBe('light');
  });

  it('explicit theme prop takes precedence over ThemeProvider context', () => {
    let resolvedTheme: AoeTheme | undefined;
    const TestComp: React.FC<{ theme?: AoeTheme }> = ({ theme }) => {
      resolvedTheme = useTheme(theme);
      return null;
    };
    render(
      <ThemeProvider theme={LIGHT_THEME}>
        <TestComp theme={HIGH_CONTRAST_THEME} />
      </ThemeProvider>,
    );
    expect(resolvedTheme?.id).toBe('high-contrast');
  });

  describe('All 9 presentation components render with light theme', () => {
    it('StatusIndicator renders in Light theme', () => {
      const { lastFrame } = render(
        <ThemeProvider theme={LIGHT_THEME}>
          <StatusIndicator status="completed" label="Build succeeded" />
        </ThemeProvider>,
      );
      expect(lastFrame()).toContain('Build succeeded');
    });

    it('ProgressBar renders in Light theme', () => {
      const { lastFrame } = render(
        <ThemeProvider theme={LIGHT_THEME}>
          <ProgressBar percentage={50} width={20} />
        </ThemeProvider>,
      );
      expect(lastFrame()).toContain('50%');
    });

    it('Panel renders in Light theme', () => {
      const { lastFrame } = render(
        <ThemeProvider theme={LIGHT_THEME}>
          <Panel title="System Status" metadata="v1.0">
            <Text>Panel body content</Text>
          </Panel>
        </ThemeProvider>,
      );
      expect(lastFrame()).toContain('System Status');
      expect(lastFrame()).toContain('Panel body content');
    });

    it('Table renders in Light theme', () => {
      const { lastFrame } = render(
        <ThemeProvider theme={LIGHT_THEME}>
          <Table
            columns={[
              { key: 'col1', header: 'Col 1' },
              { key: 'col2', header: 'Col 2' },
            ]}
            data={[{ col1: 'Val A', col2: 'Val B' }]}
          />
        </ThemeProvider>,
      );
      expect(lastFrame()).toContain('Col 1');
      expect(lastFrame()).toContain('Val A');
    });

    it('TaskSummary renders in Light theme', () => {
      const { lastFrame } = render(
        <ThemeProvider theme={LIGHT_THEME}>
          <TaskSummary
            tasks={[
              { id: '1', name: 'Task 1', status: 'completed' },
              { id: '2', name: 'Task 2', status: 'running' },
            ]}
          />
        </ThemeProvider>,
      );
      expect(lastFrame()).toContain('Tasks (2)');
      expect(lastFrame()).toContain('Task 1');
      expect(lastFrame()).toContain('Task 2');
    });

    it('FileChangeView renders in Light theme', () => {
      const { lastFrame } = render(
        <ThemeProvider theme={LIGHT_THEME}>
          <FileChangeView
            changes={[
              { action: 'CREATED', path: 'src/new-file.ts', lineDelta: { added: 10 } },
              { action: 'MODIFIED', path: 'src/existing.ts' },
            ]}
          />
        </ThemeProvider>,
      );
      expect(lastFrame()).toContain('File Changes (2)');
      expect(lastFrame()).toContain('new-file.ts');
    });

    it('DiagnosticsPanel renders in Light theme', () => {
      const { lastFrame } = render(
        <ThemeProvider theme={LIGHT_THEME}>
          <DiagnosticsPanel
            diagnostics={[
              { severity: 'error', message: 'Syntax error detected', code: 'TS1005' },
              { severity: 'warning', message: 'Unused variable', code: 'TS6133' },
            ]}
          />
        </ThemeProvider>,
      );
      expect(lastFrame()).toContain('Diagnostics (2)');
      expect(lastFrame()).toContain('Syntax error detected');
    });

    it('ExecutionLog renders in Light theme', () => {
      const { lastFrame } = render(
        <ThemeProvider theme={LIGHT_THEME}>
          <ExecutionLog
            logs={[
              { level: 'info', message: 'Starting server...' },
              { level: 'error', message: 'Port occupied' },
            ]}
          />
        </ThemeProvider>,
      );
      expect(lastFrame()).toContain('Starting server...');
      expect(lastFrame()).toContain('Port occupied');
    });

    it('ResultView renders in Light theme', () => {
      const { lastFrame } = render(
        <ThemeProvider theme={LIGHT_THEME}>
          <ResultView
            results={[
              {
                category: 'summary',
                title: 'Build Finished',
                status: 'success',
                description: 'All 5 packages compiled',
              },
            ]}
          />
        </ThemeProvider>,
      );
      expect(lastFrame()).toContain('Build Finished');
      expect(lastFrame()).toContain('All 5 packages compiled');
    });
  });

  describe('Components render with High Contrast theme and ASCII mode', () => {
    it('StatusIndicator renders in High Contrast ASCII mode', () => {
      const { lastFrame } = render(
        <ThemeProvider theme={HIGH_CONTRAST_THEME}>
          <StatusIndicator status="completed" unicode={false} noColor />
        </ThemeProvider>,
      );
      expect(lastFrame()).toContain('[OK]');
    });

    it('ProgressBar renders in High Contrast ASCII mode', () => {
      const { lastFrame } = render(
        <ThemeProvider theme={HIGH_CONTRAST_THEME}>
          <ProgressBar percentage={50} unicode={false} noColor />
        </ThemeProvider>,
      );
      expect(lastFrame()).toContain('50%');
    });

    it('TaskSummary renders in High Contrast ASCII mode', () => {
      const { lastFrame } = render(
        <ThemeProvider theme={HIGH_CONTRAST_THEME}>
          <TaskSummary
            tasks={[
              {
                id: '1',
                name: 'Parent',
                status: 'running',
                children: [{ id: '2', name: 'Child', status: 'completed' }],
              },
            ]}
            unicode={false}
            noColor
          />
        </ThemeProvider>,
      );
      expect(lastFrame()).toContain('Tasks (2)');
      expect(lastFrame()).toContain('Parent');
      expect(lastFrame()).toContain('Child');
    });
  });
});
