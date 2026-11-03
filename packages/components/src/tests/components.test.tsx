import { describe, it, expect } from 'vitest';
import { renderToString, Text } from 'ink';
import { Panel } from '../Panel.js';
import { TaskSummary, type TaskSummaryItem } from '../TaskSummary.js';
import { FileChangeView, type FileChangeItem } from '../FileChangeView.js';
import { DiagnosticsPanel, type DiagnosticItem } from '../DiagnosticsPanel.js';
import { ExecutionLog, type LogItem } from '../ExecutionLog.js';
import { ResultView, type ResultItem } from '../ResultView.js';
import { Table } from '../Table.js';
import {
  maskSecrets,
  stripAnsi,
  sanitizeTerminalText,
  formatDuration,
  truncatePath,
  clamp,
} from '../utils/sanitize.js';

describe('Panel Component', () => {
  it('renders title and metadata', () => {
    const output = renderToString(
      <Panel title="System Status" metadata="v1.0.0">
        <Text>Content Body</Text>
      </Panel>,
    );
    expect(output).toContain('System Status');
    expect(output).toContain('v1.0.0');
    expect(output).toContain('Content Body');
  });

  it('renders with border styles', () => {
    const output = renderToString(<Panel title="Box" borderStyle="single" />);
    expect(output).toContain('Box');
  });
});

describe('TaskSummary Component', () => {
  const sampleTasks: TaskSummaryItem[] = [
    {
      id: 't1',
      name: 'Build monorepo',
      status: 'completed',
      durationMs: 1200,
      children: [
        {
          id: 't1-1',
          name: 'Compile TypeScript',
          status: 'completed',
          durationMs: 400,
        },
      ],
    },
    {
      id: 't2',
      name: 'Run test suite',
      status: 'running',
      progress: { percentage: 60, isEstimate: true },
    },
  ];

  it('renders task hierarchy and stats', () => {
    const output = renderToString(<TaskSummary tasks={sampleTasks} unicode={true} />);
    expect(output).toContain('Tasks (3):');
    expect(output).toContain('2 completed, 1 running, 0 failed');
    expect(output).toContain('Build monorepo');
    expect(output).toContain('Compile TypeScript');
    expect(output).toContain('Run test suite');
    expect(output).toContain('1.2s');
    expect(output).toContain('[~60%]');
  });

  it('handles empty task list', () => {
    const output = renderToString(<TaskSummary tasks={[]} />);
    expect(output).toContain('No tasks registered');
  });
});

describe('FileChangeView Component', () => {
  const sampleChanges: FileChangeItem[] = [
    {
      action: 'CREATED',
      path: 'packages/components/src/StatusIndicator.tsx',
      lineDelta: { added: 50, removed: 0 },
      evidence: { verifiedOnDisk: true },
    },
    {
      action: 'MODIFIED',
      path: 'packages/core/src/types.ts',
      lineDelta: { added: 10, removed: 2 },
      evidence: { verifiedOnDisk: false },
    },
    {
      action: 'DELETED',
      path: 'legacy/unused.ts',
    },
    {
      action: 'RENAMED',
      path: 'new/path.ts',
      oldPath: 'old/path.ts',
    },
  ];

  it('renders all file action types with line deltas and evidence badges', () => {
    const output = renderToString(<FileChangeView changes={sampleChanges} unicode={false} />);
    expect(output).toContain('File Changes (4):');
    expect(output).toContain('+ CREATED');
    expect(output).toContain('(+50 -0)');
    expect(output).toContain('[disk]');
    expect(output).toContain('~ MODIFIED');
    expect(output).toContain('[unverified]');
    expect(output).toContain('- DELETED');
    expect(output).toContain('-> RENAMED');
    expect(output).toContain('old/path.ts -> new/path.ts');
  });

  it('handles empty changes list', () => {
    const output = renderToString(<FileChangeView changes={[]} />);
    expect(output).toContain('No file changes recorded');
  });
});

describe('DiagnosticsPanel Component', () => {
  const sampleDiagnostics: DiagnosticItem[] = [
    {
      severity: 'error',
      message: 'Type error in definition',
      code: 'TS2322',
      location: { path: 'src/index.ts', line: 42, column: 5 },
      rootCause: 'Incompatible assignment',
      suggestedRemediation: 'Cast to proper type',
    },
    {
      severity: 'warning',
      message: 'Unused import detected',
      isHypothesis: true,
    },
    {
      severity: 'info',
      message: 'Optimization possible',
    },
  ];

  it('renders diagnostics ordered by severity and flags hypotheses', () => {
    const output = renderToString(
      <DiagnosticsPanel diagnostics={sampleDiagnostics} unicode={false} />,
    );
    expect(output).toContain('Diagnostics (3):');
    expect(output).toContain('ERROR');
    expect(output).toContain('[TS2322]');
    expect(output).toContain('at src/index.ts:42:5');
    expect(output).toContain('Type error in definition');
    expect(output).toContain('Root cause: Incompatible assignment');
    expect(output).toContain('Remediation: Cast to proper type');
    expect(output).toContain('WARNING [HYPOTHESIS]');
    expect(output).toContain('INFO');
  });

  it('handles empty diagnostics list', () => {
    const output = renderToString(<DiagnosticsPanel diagnostics={[]} />);
    expect(output).toContain('No diagnostics recorded');
  });
});

describe('ExecutionLog Component', () => {
  const sampleLogs: LogItem[] = [
    { level: 'debug', message: 'Initialized context', timestamp: '2026-11-03T18:00:00Z' },
    { level: 'info', message: 'Calling API with token=super_secret_123' },
    { level: 'warn', message: 'Rate limit threshold near' },
    { level: 'error', message: 'Failed to connect to Bearer eyJhbGciOiJIUzI1NiJ9.secret' },
  ];

  it('renders logs with badges, masked secrets, and bounded lines', () => {
    const output = renderToString(<ExecutionLog logs={sampleLogs} maxLines={3} />);
    expect(output).toContain('[INFO ]');
    expect(output).toContain('[WARN ]');
    expect(output).toContain('[ERROR]');
    // Debug was truncated by maxLines: 3
    expect(output).toContain('1 earlier log entries hidden');
    // Secret masked
    expect(output).toContain('token=******');
    expect(output).not.toContain('super_secret_123');
    expect(output).toContain('Bearer ******');
    expect(output).not.toContain('eyJhbGciOiJIUzI1NiJ9.secret');
  });

  it('suppresses private chain-of-thought tags', () => {
    const logsWithThought: LogItem[] = [
      { level: 'info', message: '<thought>Internal private thinking</thought>' },
      { level: 'info', message: 'Safe public message' },
    ];
    const output = renderToString(<ExecutionLog logs={logsWithThought} />);
    expect(output).not.toContain('Internal private thinking');
    expect(output).toContain('Safe public message');
  });

  it('handles empty log list', () => {
    const output = renderToString(<ExecutionLog logs={[]} />);
    expect(output).toContain('No execution logs');
  });
});

describe('ResultView Component', () => {
  const sampleResults: ResultItem[] = [
    {
      category: 'artifact',
      title: 'Compiled binary',
      description: 'dist/aoe-engine',
      status: 'success',
    },
    {
      category: 'test_results',
      title: 'Unit Test Results',
      status: 'success',
      data: { passed: 115, failed: 0, duration: '6.8s' },
    },
    {
      category: 'summary',
      title: 'Execution Summary',
      status: 'incomplete',
    },
  ];

  it('renders category cards with structured data', () => {
    const output = renderToString(
      <ResultView results={sampleResults} sessionStatus="completed" unicode={false} />,
    );
    expect(output).toContain('Results (3):');
    expect(output).toContain('(Session status: completed)');
    expect(output).toContain('[ARTIFACT]');
    expect(output).toContain('Compiled binary');
    expect(output).toContain('[TESTS   ]');
    expect(output).toContain('passed: 115');
    expect(output).toContain('[SUMMARY ]');
  });

  it('handles empty results list', () => {
    const output = renderToString(<ResultView results={[]} />);
    expect(output).toContain('No results produced');
  });
});

describe('Table Component', () => {
  it('renders table columns and rows', () => {
    const output = renderToString(
      <Table
        columns={[
          { key: 'name', header: 'Task Name', width: 12 },
          { key: 'status', header: 'Status', width: 10 },
        ]}
        data={[
          { name: 'Build', status: 'OK' },
          { name: 'Test', status: 'PASS' },
        ]}
      />,
    );
    expect(output).toContain('Task Name');
    expect(output).toContain('Status');
    expect(output).toContain('Build');
    expect(output).toContain('Test');
  });
});

describe('Sanitization & Formatting Utilities', () => {
  it('masks OpenAI, AWS, GitHub, Bearer, and generic secrets', () => {
    expect(maskSecrets('sk-1234567890abcdef1234567890')).toBe('******');
    expect(maskSecrets('AKIAIOSFODNN7EXAMPLE')).toBe('******');
    expect(maskSecrets('Bearer mySecretToken12345')).toBe('Bearer ******');
    expect(maskSecrets('api_key="secret123"')).toBe('api_key=******');
    expect(maskSecrets('password: secretVal')).toBe('password:******');
  });

  it('strips dangerous terminal ANSI escapes', () => {
    const dangerous = 'Normal text \x1b]0;Title\x07 and \x1b[2J clear screen';
    const sanitized = sanitizeTerminalText(dangerous);
    expect(sanitized).not.toContain('\x1b]0;');
    expect(sanitized).not.toContain('\x1b[2J');
  });

  it('strips all ANSI codes with stripAnsi', () => {
    const ansiColored = '\x1b[32mGreen\x1b[0m Text';
    expect(stripAnsi(ansiColored)).toBe('Green Text');
  });

  it('formats duration cleanly', () => {
    expect(formatDuration(450)).toBe('450ms');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(75000)).toBe('1m 15s');
    expect(formatDuration(undefined)).toBe('0ms');
  });

  it('truncates long paths in the middle', () => {
    const short = 'packages/core/src/index.ts';
    expect(truncatePath(short, 40)).toBe(short);

    const long = 'packages/super/long/nested/directory/structure/file.tsx';
    const truncated = truncatePath(long, 30);
    expect(truncated.length).toBeLessThanOrEqual(30);
    expect(truncated).toContain('packages/.../');
    expect(truncated).toContain('file.tsx');
  });

  it('clamps numbers safely', () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(NaN, 0, 10)).toBe(0);
  });
});
