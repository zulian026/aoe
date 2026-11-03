import { Command } from 'commander';
import { PROTOCOL_VERSION } from '@aoe/protocol';
import { registerRenderCommand } from './commands/render.js';
import { registerPipeCommand } from './commands/pipe.js';
import { registerThemeCommand } from './commands/theme.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerSkillCommand } from './commands/skill.js';
import { formatErrorOutput } from './utils/errors.js';
import { ExitCode } from './runtime/exit-codes.js';

export const CLI_VERSION = '0.1.0';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('aoe')
    .description('Universal terminal presentation engine for AI coding agents')
    .version(
      `AOE CLI v${CLI_VERSION} (protocol v${PROTOCOL_VERSION})`,
      '-v, --version',
      'Display version information',
    )
    .option('--verbose', 'Enable verbose error reporting with stack traces')
    .exitOverride();

  // Register command suites
  registerRenderCommand(program);
  registerPipeCommand(program);
  registerThemeCommand(program);
  registerDoctorCommand(program);
  registerSkillCommand(program);

  // Informative version command
  program
    .command('version')
    .description('Display engine and protocol version information')
    .action(() => {
      console.log(`AOE CLI v${CLI_VERSION} (protocol v${PROTOCOL_VERSION})`);
    });

  return program;
}

/**
 * Runs the AOE CLI with the provided argv array, safely handling exit codes.
 */
export async function runCli(argv: string[] = process.argv): Promise<number> {
  const program = createProgram();
  const isVerbose = argv.includes('--verbose');

  try {
    await program.parseAsync(argv);
    return ExitCode.SUCCESS;
  } catch (err: unknown) {
    // Commander-specific errors (e.g. --help, --version, missing argument)
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const commanderErr = err as { code: string; message: string; exitCode?: number };
      if (
        commanderErr.code === 'commander.helpDisplayed' ||
        commanderErr.code === 'commander.version'
      ) {
        return ExitCode.SUCCESS;
      }
      if (
        commanderErr.code === 'commander.unknownCommand' ||
        commanderErr.code === 'commander.unknownOption' ||
        commanderErr.code === 'commander.missingMandatoryOptionValue' ||
        commanderErr.code === 'commander.missingArgument'
      ) {
        process.stderr.write(`Error: ${commanderErr.message}\n`);
        return ExitCode.INVALID_ARGUMENTS;
      }
    }

    const { message, exitCode } = formatErrorOutput(err, isVerbose);
    process.stderr.write(`${message}\n`);
    return exitCode;
  }
}
