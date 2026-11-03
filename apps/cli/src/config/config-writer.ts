import fs from 'node:fs';
import path from 'node:path';
import { getConfigFilePath } from './config-path.js';
import { AoeConfigSchema, type AoeConfig } from './config-schema.js';
import { CliError } from '../utils/errors.js';
import { ExitCode } from '../runtime/exit-codes.js';

/**
 * Validates and atomically writes configuration to disk.
 */
export async function saveConfig(config: AoeConfig, customPath?: string): Promise<string> {
  const validation = AoeConfigSchema.safeParse(config);
  if (!validation.success) {
    const issues = validation.error.issues
      .map((i) => `[${i.path.join('.')}] ${i.message}`)
      .join(', ');
    throw new CliError(`Invalid configuration cannot be saved: ${issues}`, {
      exitCode: ExitCode.CONFIG_ERROR,
      details: validation.error.issues,
    });
  }

  const targetPath = customPath ? path.resolve(customPath) : getConfigFilePath();
  const targetDir = path.dirname(targetPath);

  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const serialized = JSON.stringify(validation.data, null, 2) + '\n';
    const tempPath = `${targetPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;

    fs.writeFileSync(tempPath, serialized, 'utf-8');
    fs.renameSync(tempPath, targetPath);

    return targetPath;
  } catch (err) {
    throw new CliError(`Failed to write configuration file to ${targetPath}`, {
      exitCode: ExitCode.CONFIG_ERROR,
      hint: 'Check filesystem permissions for the configuration directory.',
      cause: err,
    });
  }
}
