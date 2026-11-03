import { type ThemeDefinition } from '@aoe/themes';

export type ComponentStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'failure'
  | 'warning'
  | 'skipped'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'cancelled';

export interface ComponentRenderOptions {
  theme: ThemeDefinition;
  unicode?: boolean;
  width?: number;
}

export const COMPONENT_REGISTRY = [
  'StatusIndicator',
  'ProgressBar',
  'Panel',
  'Table',
  'TaskSummary',
  'FileChangeView',
  'DiagnosticPanel',
  'DiagnosticsPanel',
  'ExecutionLog',
  'ResultView',
] as const;

export type ComponentName = (typeof COMPONENT_REGISTRY)[number];

// Component exports
export * from './StatusIndicator.js';
export * from './ProgressBar.js';
export * from './Panel.js';
export * from './Table.js';
export * from './TaskSummary.js';
export * from './FileChangeView.js';
export * from './DiagnosticsPanel.js';
// DiagnosticPanel alias for backward compatibility with COMPONENT_REGISTRY
export {
  DiagnosticsPanel as DiagnosticPanel,
  type DiagnosticsPanelProps as DiagnosticPanelProps,
} from './DiagnosticsPanel.js';
export * from './ExecutionLog.js';
export * from './ResultView.js';

// Utilities
export * from './utils/sanitize.js';
export * from './utils/theme-resolver.js';
