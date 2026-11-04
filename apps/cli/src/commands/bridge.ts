import { Command } from 'commander';
import { runHookBridge } from '@zyanx04/adapters';

export interface BridgeCommandOptions {
  event?: string;
  socket?: string;
  timeout?: string;
}

export function registerBridgeCommand(program: Command): void {
  program
    .command('bridge')
    .description('Run the non-blocking Antigravity hook bridge')
    .option('-e, --event <name>', 'Antigravity lifecycle hook event name')
    .option('-s, --socket <path>', 'Custom Unix Domain Socket path for IPC')
    .option('--timeout <ms>', 'Maximum stdin read timeout in milliseconds', '1000')
    .action(async (options: BridgeCommandOptions) => {
      const timeoutMs = parseInt(options.timeout ?? '1000', 10);
      try {
        await runHookBridge({
          event: options.event,
          socketPath: options.socket,
          timeoutMs: Number.isNaN(timeoutMs) ? 1000 : timeoutMs,
        });
      } catch (err) {
        process.stderr.write(`[aoe-bridge] Error: ${(err as Error).message}\n`);
        process.stdout.write('{}\n');
      } finally {
        // Ensure stdout is completely drained before exiting
        if (process.stdout.writableLength === 0) {
          process.exitCode = 0;
        } else {
          process.stdout.once('drain', () => {
            process.exitCode = 0;
          });
        }
      }
    });
}
