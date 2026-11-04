import { describe, it, expect } from 'vitest';
import { Engine } from './index.js';
import { type ProtocolEnvelope } from '@zyanx04/protocol';

describe('@zyanx04/core Engine', () => {
  it('starts without an active session', () => {
    const engine = new Engine();
    expect(engine.getSession()).toBeNull();
  });

  it('initializes session on first event ingestion', () => {
    const engine = new Engine();
    const event: ProtocolEnvelope = {
      protocol: 'aoe',
      version: '1.0.0',
      timestamp: '2026-11-03T10:00:00.000Z',
      sessionId: 'sess_abc',
      sequence: 0,
      event: 'session.start',
      data: {},
    };

    engine.processEvent(event);
    const session = engine.getSession();
    expect(session).not.toBeNull();
    expect(session?.id).toBe('sess_abc');
    expect(session?.eventsProcessed).toBe(1);
  });
});
