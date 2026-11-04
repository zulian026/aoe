import { describe, it, expect, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import { readStreamChunks } from '../runtime/stdin-reader.js';
import { SignalHandler } from '../runtime/signal-handler.js';
import { ExecutionPipeline } from '../runtime/execution-pipeline.js';
import type { SessionStartedEvent } from '@zyanx04/protocol';

describe('CLI Runtime & Lifecycle', () => {
  describe('readStreamChunks', () => {
    it('yields string chunks from readable stream', async () => {
      const stream = Readable.from(['chunk 1', 'chunk 2']);
      const chunks: string[] = [];

      for await (const chunk of readStreamChunks(stream)) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['chunk 1', 'chunk 2']);
    });

    it('enforces maximum stream byte limit', async () => {
      const bigChunk = 'A'.repeat(200);
      const stream = Readable.from([bigChunk]);

      await expect(async () => {
        for await (const _ of readStreamChunks(stream, { maxBytes: 100 })) {
          // should throw on oversized payload
        }
      }).rejects.toThrow('Input stream exceeded maximum allowed size');
    });
  });

  describe('SignalHandler', () => {
    let handler: SignalHandler;

    beforeEach(() => {
      handler = SignalHandler.getInstance();
      handler.reset();
    });

    it('executes registered cleanup tasks on shutdown', async () => {
      let task1Executed = false;
      let task2Executed = false;

      handler.register(() => {
        task1Executed = true;
      });

      handler.register(async () => {
        task2Executed = true;
      });

      await handler.shutdown(130);

      expect(task1Executed).toBe(true);
      expect(task2Executed).toBe(true);
    });

    it('allows unregistering a cleanup task', async () => {
      let executed = false;
      const unregister = handler.register(() => {
        executed = true;
      });

      unregister();
      await handler.shutdown(130);

      expect(executed).toBe(false);
    });
  });

  describe('ExecutionPipeline', () => {
    it('initializes, processes canonical events, and stops cleanly', async () => {
      const pipeline = new ExecutionPipeline({
        mode: 'static',
        theme: 'obsidian',
      });

      await pipeline.start();

      const startEvent: SessionStartedEvent = {
        protocolVersion: '1.0.0',
        eventId: 'evt_p1',
        sessionId: 'sess_p1',
        sequence: 1,
        timestamp: new Date().toISOString(),
        eventType: 'session.started',
        payload: {
          agent: { name: 'pipeline-agent' },
          workingDirectory: '/test',
        },
      };

      expect(() => {
        pipeline.processEvent(startEvent);
      }).not.toThrow();

      await expect(pipeline.stop()).resolves.toBeUndefined();
    });
  });
});
