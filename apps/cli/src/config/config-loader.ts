import fs from 'node:fs';
import { getConfigFilePath } from './config-path.js';
import { AoeConfigSchema, DEFAULT_CONFIG, type AoeConfig } from './config-schema.js';
import { CliError } from '../utils/errors.js';
import { ExitCode } from '../runtime/exit-codes.js';

export interface LoadConfigResult {
  config: AoeConfig;
  path: string;
  exists: boolean;
  isDefault: boolean;
  error?: Error;
}

/**
 * Loads and validates AOE configuration from disk.
 * Returns default configuration if the file does not exist.
 */
export function loadConfig(customPath?: string, strict = false): LoadConfigResult {
  const filePath = customPath ? customPath : getConfigFilePath();

  if (!fs.existsSync(filePath)) {
    return {
      config: { ...DEFAULT_CONFIG },
      path: filePath,
      exists: false,
      isDefault: true,
    };
  }

  let rawContent: string;
  try {
    rawContent = fs.readFileSync(filePath, 'utf-8');
  } catch (readErr) {
    const err = new CliError(`Failed to read configuration file at ${filePath}`, {
      exitCode: ExitCode.CONFIG_ERROR,
      cause: readErr,
    });
    if (strict) throw err;
    return {
      config: { ...DEFAULT_CONFIG },
      path: filePath,
      exists: true,
      isDefault: true,
      error: err,
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawContent);
  } catch (jsonErr) {
    const err = new CliError(`Malformed JSON in configuration file at ${filePath}`, {
      exitCode: ExitCode.CONFIG_ERROR,
      hint: 'Ensure config.json contains valid JSON format.',
      cause: jsonErr,
    });
    if (strict) throw err;
    return {
      config: { ...DEFAULT_CONFIG },
      path: filePath,
      exists: true,
      isDefault: true,
      error: err,
    };
  }

  const validationResult = AoeConfigSchema.safeParse(parsedJson);
  if (!validationResult.success) {
    const issues = validationResult.error.issues
      .map((i) => `[${i.path.join('.')}] ${i.message}`)
      .join(', ');
    const err = new CliError(`Configuration validation failed in ${filePath}: ${issues}`, {
      exitCode: ExitCode.CONFIG_ERROR,
      hint: 'Check docs/development/configuration.md for configuration schema rules.',
      details: validationResult.error.issues,
    });
    if (strict) throw err;
    return {
      config: { ...DEFAULT_CONFIG },
      path: filePath,
      exists: true,
      isDefault: true,
      error: err,
    };
  }

  return {
    config: validationResult.data,
    path: filePath,
    exists: true,
    isDefault: false,
  };
}
