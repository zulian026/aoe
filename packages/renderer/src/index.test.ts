import { describe, it, expect } from 'vitest';
import { createRendererStub } from './index.js';

describe('@zyanx04/renderer', () => {
  it('creates renderer instance and exposes lifecycle methods', async () => {
    const renderer = createRendererStub();
    expect(renderer).toHaveProperty('initialize');
    expect(renderer).toHaveProperty('render');
    expect(renderer).toHaveProperty('dispose');

    await expect(renderer.initialize()).resolves.toBeUndefined();
    expect(() =>
      renderer.render({
        sessionId: 'sess_1',
        activeTasks: 1,
        completedTasks: 0,
        hasErrors: false,
      }),
    ).not.toThrow();
    await expect(renderer.dispose()).resolves.toBeUndefined();
  });
});
