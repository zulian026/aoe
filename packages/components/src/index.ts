import { type ThemeDefinition } from '@aoe/themes';

export type ComponentStatus = 'idle' | 'running' | 'success' | 'failure' | 'warning' | 'skipped';

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
  'ExecutionLog',
] as const;

export type ComponentName = (typeof COMPONENT_REGISTRY)[number];
