import { Command } from 'commander';
import { parseEventStream, ProtocolError } from '@zyanx04/protocol';
import { loadConfig } from '../config/index.js';
import { ExecutionPipeline } from '../runtime/execution-pipeline.js';
import { isPipedStream, readStreamChunks } from '../runtime/stdin-reader.js';
import { ExitCode } from '../runtime/exit-codes.js';
import { CliError } from '../utils/errors.js';
import { defaultLogger } from '../utils/logger.js';
import type { RendererMode } from '@zyanx04/renderer';

export interface RenderCommandOptions {
  theme?: string;
  format?: string;
  mode?: string;
  verbose?: boolean;
}

export function registerRenderCommand(program: Command): void {
  program
    .command('render')
    .description('Render canonical AOE JSONL events from standard input')
    .option('-t, --theme <name>', 'Theme identifier to use for rendering')
    .option('-f, --format <mode>', 'Render mode: "auto", "interactive", or "static"')
    .option('-m, --mode <mode>', 'Alias for --format')
    .option('--verbose', 'Show verbose diagnostics and stack traces')
    .action(async (options: RenderCommandOptions) => {
      await executeRender(options);
    });
}

export async function executeRender(
  options: RenderCommandOptions = {},
  customStdin?: NodeJS.ReadableStream,
): Promise<void> {
  const stdinStream = customStdin ?? process.stdin;

  // Fail fast if running interactively with nothing piped to stdin
  if (!customStdin && !isPipedStream(stdinStream)) {
    throw new CliError('No input piped to "aoe render"', {
      exitCode: ExitCode.INVALID_ARGUMENTS,
      hint: 'Pipe canonical JSONL events into stdin, e.g.: cat events.jsonl | aoe render',
    });
  }

  const { config } = loadConfig();
  const theme = options.theme ?? config.theme ?? 'obsidian';
  const rawMode = (options.format ?? options.mode ?? config.output?.mode ?? 'auto') as string;

  if (rawMode !== 'auto' && rawMode !== 'interactive' && rawMode !== 'static') {
    throw new CliError(`Invalid render mode "${rawMode}"`, {
      exitCode: ExitCode.INVALID_ARGUMENTS,
      hint: 'Allowed modes: "auto", "interactive", or "static"',
    });
  }
  const mode = rawMode as RendererMode;

  const pipeline = new ExecutionPipeline({
    theme,
    mode,
  });

  await pipeline.start();

  let eventCount = 0;
  try {
    const chunkStream = readStreamChunks(stdinStream);
    const eventStream = parseEventStream(chunkStream, {
      onError: (err: ProtocolError, rawLine: string) => {
        defaultLogger.error(`[AOE Protocol Error] ${err.message}`);
        defaultLogger.debug(`Raw failed line: ${rawLine}`);
      },
      skipMalformed: false,
    });

    for await (const event of eventStream) {
      eventCount++;
      pipeline.processEvent(event);
    }
  } catch (err) {
    await pipeline.stop();

    if (err instanceof ProtocolError) {
      throw new CliError(`Protocol error: ${err.message}`, {
        exitCode: ExitCode.PROTOCOL_ERROR,
        hint: 'Ensure input follows the AOE Canonical Event Protocol v1.0.0 (docs/protocol/protocol-specification.md)',
        details: err.details,
      });
    }

    throw err;
  }

  await pipeline.stop();

  if (eventCount === 0) {
    defaultLogger.debug('Stream ended with 0 events processed.');
  }
}
