import { describe, it, expect, beforeEach } from 'vitest';
import { IncrementalFrameDecoder } from '../sidecar/frame-decoder.js';

describe('IncrementalFrameDecoder', () => {
  let decoder: IncrementalFrameDecoder;

  beforeEach(() => {
    decoder = new IncrementalFrameDecoder();
  });

  it('decodes single complete line', () => {
    const res = decoder.push('{"foo":"bar"}\n');
    expect(res.lines).toEqual(['{"foo":"bar"}']);
    expect(res.errors).toHaveLength(0);
    expect(decoder.getBufferSize()).toBe(0);
  });

  it('buffers partial chunk and completes when second chunk arrives', () => {
    const chunk1 = '{"event":';
    const chunk2 = '"session.started"}\n';

    const res1 = decoder.push(chunk1);
    expect(res1.lines).toHaveLength(0);
    expect(decoder.getBufferSize()).toBe(chunk1.length);

    const res2 = decoder.push(chunk2);
    expect(res2.lines).toEqual(['{"event":"session.started"}']);
    expect(decoder.getBufferSize()).toBe(0);
  });

  it('handles fragmented line across three chunks', () => {
    expect(decoder.push('{"id":').lines).toHaveLength(0);
    expect(decoder.push('"evt-1",').lines).toHaveLength(0);
    const res = decoder.push('"seq":0}\n');
    expect(res.lines).toEqual(['{"id":"evt-1","seq":0}']);
  });

  it('extracts multiple complete lines from a single chunk', () => {
    const multi = '{"seq":0}\n{"seq":1}\n{"seq":2}\n';
    const res = decoder.push(multi);
    expect(res.lines).toEqual(['{"seq":0}', '{"seq":1}', '{"seq":2}']);
    expect(decoder.getBufferSize()).toBe(0);
  });

  it('ignores empty lines and trailing whitespace between events', () => {
    const chunk = '\n\n{"seq":0}\n   \n\n{"seq":1}\n\n';
    const res = decoder.push(chunk);
    expect(res.lines).toEqual(['{"seq":0}', '{"seq":1}']);
  });

  it('leaves unterminated trailing piece in buffer', () => {
    const chunk = '{"seq":0}\n{"seq":1}\n{"seq":2';
    const res = decoder.push(chunk);
    expect(res.lines).toEqual(['{"seq":0}', '{"seq":1}']);
    expect(decoder.getBufferSize()).toBe('{"seq":2'.length);
  });

  it('drains unterminated buffer on drain() call', () => {
    decoder.push('{"seq":0}\n{"seq":1}');
    const drained = decoder.drain();
    expect(drained.lines).toEqual(['{"seq":1}']);
    expect(decoder.getBufferSize()).toBe(0);
  });

  it('clears buffer on reset()', () => {
    decoder.push('partial un-terminated data');
    expect(decoder.getBufferSize()).toBeGreaterThan(0);
    decoder.reset();
    expect(decoder.getBufferSize()).toBe(0);
  });

  it('safely handles buffer overflow limit', () => {
    const smallDecoder = new IncrementalFrameDecoder(100);
    const largeChunk = 'x'.repeat(150);
    const res = smallDecoder.push(largeChunk);
    expect(res.lines).toHaveLength(0);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].error).toContain('Buffer exceeded maximum allowed size');
    expect(smallDecoder.getBufferSize()).toBe(0);
  });
});
