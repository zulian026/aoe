import { describe, it, expect } from 'vitest';
import { COMPONENT_REGISTRY } from './index.js';

describe('@zyanx04/components', () => {
  it('registers all required core terminal components', () => {
    expect(COMPONENT_REGISTRY).toContain('StatusIndicator');
    expect(COMPONENT_REGISTRY).toContain('ProgressBar');
    expect(COMPONENT_REGISTRY).toContain('Panel');
    expect(COMPONENT_REGISTRY).toContain('Table');
    expect(COMPONENT_REGISTRY).toContain('TaskSummary');
    expect(COMPONENT_REGISTRY).toContain('FileChangeView');
    expect(COMPONENT_REGISTRY).toContain('DiagnosticPanel');
    expect(COMPONENT_REGISTRY).toContain('ExecutionLog');
  });
});
