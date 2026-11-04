import { Command } from 'commander';
import {
  createDefaultAdapterManager,
  AdapterManager,
  AdapterError,
  type DetectionConfidence,
} from '@zyanx04/adapters';
import { loadConfig } from '../config/index.js';
import { ExecutionPipeline } from '../runtime/execution-pipeline.js';
import { isPipedStream, readStreamChunks } from '../runtime/stdin-reader.js';
import { ExitCode } from '../runtime/exit-codes.js';
import { CliError } from '../utils/errors.js';
import { defaultLogger } from '../utils/logger.js';
import type { RendererMode } from '@zyanx04/renderer';

export interface PipeCommandOptions {
  agent?: string;
  theme?: string;
  format?: string;
  mode?: string;
  verbose?: boolean;
}

const CONFIDENCE_LEVELS: Record<DetectionConfidence, number> = {
  exact: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

export function registerPipeCommand(program: Command): void {
  program
    .command('pipe')
    .description('Ingest external AI coding agent output and normalize into AOE presentation')
    .option(
      '-a, --agent <name>',
      'Agent adapter to use ("auto", "claude-code", "gemini-cli", "generic-jsonl")',
      'auto',
    )
    .option('-t, --theme <name>', 'Theme identifier to use for rendering')
    .option('-f, --format <mode>', 'Render mode: "auto", "interactive", or "static"')
    .option('-m, --mode <mode>', 'Alias for --format')
    .option('--verbose', 'Show verbose diagnostics and stack traces')
    .action(async (options: PipeCommandOptions) => {
      await executePipe(options);
    });
}

export async function executePipe(
  options: PipeCommandOptions = {},
  customStdin?: NodeJS.ReadableStream,
  customManager?: AdapterManager,
): Promise<void> {
  const stdinStream = customStdin ?? process.stdin;

  if (!customStdin && !isPipedStream(stdinStream)) {
    throw new CliError('No input piped to "aoe pipe"', {
      exitCode: ExitCode.INVALID_ARGUMENTS,
      hint: 'Pipe agent output into stdin, e.g.: cat claude-hook.json | aoe pipe --agent claude-code',
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

  const manager = customManager ?? createDefaultAdapterManager();
  const registeredAdapters = manager.list();
  const availableAdapterIds = registeredAdapters.map((a) => a.id);

  // 1. Resolve agent adapter
  let chosenAdapterId: string;
  const requestedAgent = options.agent ?? 'auto';

  if (requestedAgent !== 'auto') {
    if (!availableAdapterIds.includes(requestedAgent)) {
      throw new CliError(`Unknown agent adapter "${requestedAgent}"`, {
        exitCode: ExitCode.ADAPTER_ERROR,
        hint: `Available adapters: ${availableAdapterIds.join(', ')}`,
      });
    }
    chosenAdapterId = requestedAgent;
  } else {
    // Auto-detection
    const detectionResults = await manager.detect({
      environment: process.env,
      workingDirectory: process.cwd(),
    });

    const sortedDetections = detectionResults
      .filter((d) => d.result.detected)
      .sort(
        (a, b) =>
          (CONFIDENCE_LEVELS[b.result.confidence] ?? 0) -
          (CONFIDENCE_LEVELS[a.result.confidence] ?? 0),
      );

    const bestMatch = sortedDetections[0];
    const detectedScore = bestMatch ? (CONFIDENCE_LEVELS[bestMatch.result.confidence] ?? 0) : 0;
    const minConfidence = config.adapters?.minimumConfidence ?? 'high';
    const minThreshold = CONFIDENCE_LEVELS[minConfidence] ?? 3;

    if (!bestMatch || detectedScore < minThreshold) {
      const highestConfidence = bestMatch ? bestMatch.result.confidence : 'none';
      throw new CliError(
        `Unable to auto-detect agent with required confidence (got "${highestConfidence}", required "${minConfidence}").`,
        {
          exitCode: ExitCode.ADAPTER_ERROR,
          hint: `Specify the agent explicitly using --agent <name>. Available: ${availableAdapterIds.join(', ')}`,
        },
      );
    }

    chosenAdapterId = bestMatch.adapter.id;
    defaultLogger.debug(
      `Auto-detected agent "${chosenAdapterId}" with confidence "${bestMatch.result.confidence}"`,
    );
  }

  // 2. Initialize Pipeline & Adapter Session
  const pipeline = new ExecutionPipeline({ theme, mode });
  await pipeline.start();

  const session = await manager.createSession(chosenAdapterId, {
    environment: process.env,
    workingDirectory: process.cwd(),
  });

  manager.onEvent((event) => {
    pipeline.processEvent(event);
  });

  // 3. Stream and ingest stdin
  let lineBuffer = '';
  try {
    for await (const chunk of readStreamChunks(stdinStream)) {
      if (chosenAdapterId === 'generic-jsonl') {
        // Generic JSONL adapter has internal line parser
        await manager.ingest(session.id, chunk);
      } else {
        // Line-based stream handling for hooks and streaming agents
        lineBuffer += chunk;
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            await manager.ingest(session.id, trimmed);
          }
        }
      }
    }

    // Process residual buffer
    const remaining = lineBuffer.trim();
    if (remaining) {
      await manager.ingest(session.id, remaining);
    }

    // Gracefully complete the session
    await manager.endSession(session.id, 'Session completed via EOF');
  } catch (err) {
    await pipeline.stop();
    await manager.disposeSession(session.id);

    if (err instanceof AdapterError) {
      throw new CliError(`Adapter error: ${err.message}`, {
        exitCode: ExitCode.ADAPTER_ERROR,
        hint: `Check that payload matches expected format for adapter "${chosenAdapterId}".`,
      });
    }

    throw err;
  }

  await pipeline.stop();
  await manager.disposeSession(session.id);
}
