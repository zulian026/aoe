export * from './environment.js';
export * from './static-renderer.js';
export * from './interactive-app.js';
export * from './terminal-renderer.js';
export * from './sidecar/index.js';

// Legacy compatibility aliases
export type {
  TerminalRendererOptions as RendererOptions,
  RenderState,
} from './terminal-renderer.js';
