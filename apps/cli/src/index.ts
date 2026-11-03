import { Command } from 'commander';
import { PROTOCOL_VERSION } from '@aoe/protocol';

export const CLI_VERSION = '0.1.0';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('aoe')
    .description('Universal terminal presentation engine for AI coding agents')
    .version(`${CLI_VERSION} (protocol v${PROTOCOL_VERSION})`);

  program
    .command('version')
    .description('Display engine and protocol version information')
    .action(() => {
      // Intentionally minimal for M00
      console.log(`AOE CLI v${CLI_VERSION} (protocol v${PROTOCOL_VERSION})`);
    });

  return program;
}
