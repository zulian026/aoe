import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import { parseEventStream, serializeEvent } from '../packages/protocol/dist/index.js';
import { Engine } from '../packages/core/dist/index.js';
import { StaticRenderer } from '../packages/renderer/dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const binPath = path.resolve(__dirname, '../apps/cli/dist/bin.js');

async function runBenchmark() {
  console.log('='.repeat(60));
  console.log('AOE Performance Baseline Benchmark');
  console.log('='.repeat(60));

  // 1. Environment Info
  const cpus = os.cpus();
  const cpuModel = cpus[0]?.model || 'Unknown CPU';
  const cpuCores = cpus.length;
  const totalRamGb = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1);

  console.log(`OS:           ${os.type()} ${os.release()} (${os.arch()})`);
  console.log(`CPU:          ${cpuModel} (${cpuCores} cores)`);
  console.log(`RAM:          ${totalRamGb} GB`);
  console.log(`Node.js:      ${process.version}`);
  console.log(`Date:         ${new Date().toISOString()}`);
  console.log('-'.repeat(60));

  // 2. Measure CLI Startup Time (Cold Process Spawn)
  const startupRuns = 5;
  const startupTimes = [];

  for (let i = 0; i < startupRuns; i++) {
    const start = performance.now();
    const res = spawnSync(process.execPath, [binPath, '--version'], {
      encoding: 'utf-8',
      env: { ...process.env, NO_COLOR: '1' },
    });
    const dur = performance.now() - start;
    if (res.status === 0) {
      startupTimes.push(dur);
    }
  }

  const avgStartup = (startupTimes.reduce((acc, t) => acc + t, 0) / startupTimes.length).toFixed(2);
  const minStartup = Math.min(...startupTimes).toFixed(2);
  const maxStartup = Math.max(...startupTimes).toFixed(2);

  console.log(
    `CLI Startup Time (aoe --version, ${startupRuns} runs): avg ${avgStartup}ms (min: ${minStartup}ms, max: ${maxStartup}ms)`,
  );

  // 3. Generate Deterministic Test Event Fixtures
  const EVENT_COUNT = 2000;
  const sampleEvents = [];

  for (let i = 1; i <= EVENT_COUNT; i++) {
    sampleEvents.push({
      protocolVersion: '1.0.0',
      eventId: `evt-bench-${i}`,
      sessionId: 'bench-session-1',
      sequence: i,
      timestamp: new Date(1700000000000 + i * 100).toISOString(),
      eventType: i === 1 ? 'session.started' : 'log.emitted',
      payload:
        i === 1
          ? { workingDirectory: '/benchmark', agent: { name: 'benchmark-agent' } }
          : {
              level: 'info',
              message: `Benchmark log record sequence ${i} with simulated output data`,
            },
    });
  }

  // Pre-serialize to JSONL string
  const jsonlLines = sampleEvents.map((evt) => serializeEvent(evt)).join('');
  const jsonlBytes = Buffer.byteLength(jsonlLines, 'utf-8');

  // 4. JSONL Parsing Throughput
  const parseStart = performance.now();
  async function* makeChunkGenerator() {
    // Deliver in 8KB chunks
    const CHUNK_SIZE = 8192;
    for (let offset = 0; offset < jsonlLines.length; offset += CHUNK_SIZE) {
      yield jsonlLines.slice(offset, offset + CHUNK_SIZE);
    }
  }

  let parsedCount = 0;
  for await (const _event of parseEventStream(makeChunkGenerator())) {
    parsedCount++;
  }
  const parseDur = performance.now() - parseStart;
  const parseThroughput = Math.round((parsedCount / parseDur) * 1000);
  const mbThroughput = ((jsonlBytes / (1024 * 1024) / parseDur) * 1000).toFixed(2);

  console.log(
    `JSONL Parser Throughput:       ${parseThroughput.toLocaleString()} events/sec (${mbThroughput} MB/s, ${parsedCount} events parsed in ${parseDur.toFixed(1)}ms)`,
  );

  // 5. Core Engine Ingestion Throughput
  const engine = new Engine();
  const ingestStart = performance.now();

  for (const event of sampleEvents) {
    engine.processEvent(event);
  }
  const ingestDur = performance.now() - ingestStart;
  const ingestThroughput = Math.round((sampleEvents.length / ingestDur) * 1000);

  console.log(
    `Core Engine Ingestion Rate:     ${ingestThroughput.toLocaleString()} events/sec (${sampleEvents.length} events processed in ${ingestDur.toFixed(1)}ms)`,
  );

  // 6. Static Renderer Throughput
  const nullStream = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });

  const staticRenderer = new StaticRenderer({
    stream: nullStream,
    noColor: true,
  });

  const snapshot = engine.getSessionSnapshot('bench-session-1');
  const RENDER_ITERATIONS = 1000;
  const renderStart = performance.now();

  for (let i = 0; i < RENDER_ITERATIONS; i++) {
    staticRenderer.render(snapshot);
  }
  const renderDur = performance.now() - renderStart;
  const renderThroughput = Math.round((RENDER_ITERATIONS / renderDur) * 1000);

  console.log(
    `Static Renderer Throughput:     ${renderThroughput.toLocaleString()} snapshots/sec (${RENDER_ITERATIONS} snapshots in ${renderDur.toFixed(1)}ms)`,
  );

  // 7. Memory Delta on Large Stream (10,000 events)
  if (global.gc) {
    global.gc();
  }
  const memBefore = process.memoryUsage().heapUsed;

  const largeEngine = new Engine();
  for (let i = 1; i <= 10000; i++) {
    largeEngine.processEvent({
      protocolVersion: '1.0.0',
      eventId: `mem-evt-${i}`,
      sessionId: 'mem-session-1',
      sequence: i,
      timestamp: new Date().toISOString(),
      eventType: i === 1 ? 'session.started' : 'log.emitted',
      payload:
        i === 1
          ? { workingDirectory: '/mem-test', agent: { name: 'mem-agent' } }
          : { level: 'debug', message: `Memory test message payload ${i}` },
    });
  }

  const memAfter = process.memoryUsage().heapUsed;
  const memDeltaMb = ((memAfter - memBefore) / (1024 * 1024)).toFixed(2);

  console.log(
    `Memory Usage Delta:            +${memDeltaMb} MB heap after ingesting 10,000 stateful events`,
  );
  console.log('='.repeat(60));
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
