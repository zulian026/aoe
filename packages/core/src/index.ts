import { type ProtocolEnvelope } from '@aoe/protocol';
import { type TerminalRenderer } from '@aoe/renderer';

export interface SessionState {
  id: string;
  startedAt: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  eventsProcessed: number;
}

export interface EngineOptions {
  renderer?: TerminalRenderer;
}

export class Engine {
  private session: SessionState | null = null;
  private renderer?: TerminalRenderer;

  constructor(options: EngineOptions = {}) {
    this.renderer = options.renderer;
  }

  public getRenderer(): TerminalRenderer | undefined {
    return this.renderer;
  }

  public getSession(): SessionState | null {
    return this.session;
  }

  public processEvent(envelope: ProtocolEnvelope): void {
    if (!this.session) {
      this.session = {
        id: envelope.sessionId,
        startedAt: envelope.timestamp,
        status: 'active',
        eventsProcessed: 0,
      };
    }
    this.session.eventsProcessed += 1;
  }
}
