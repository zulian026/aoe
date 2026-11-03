import { type ThemeDefinition } from '@aoe/themes';

export interface RendererOptions {
  theme?: ThemeDefinition;
  isTTY?: boolean;
  colorDepth?: number;
  useAlternateScreen?: boolean;
}

export interface RenderState {
  sessionId: string;
  activeTasks: number;
  completedTasks: number;
  hasErrors: boolean;
}

export interface TerminalRenderer {
  initialize(): Promise<void>;
  render(state: RenderState): void;
  dispose(): Promise<void>;
}

export const createRendererStub = (_options: RendererOptions = {}): TerminalRenderer => {
  return {
    async initialize() {},
    render(_state: RenderState) {},
    async dispose() {},
  };
};
