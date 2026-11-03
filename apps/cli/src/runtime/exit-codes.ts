/**
 * Standardized process exit codes for the AOE CLI.
 */
export const ExitCode = {
  /** Successful execution without error */
  SUCCESS: 0,
  /** Unhandled runtime error or internal unexpected failure */
  UNEXPECTED_ERROR: 1,
  /** Invalid command-line arguments, unknown flags, or missing options */
  INVALID_ARGUMENTS: 2,
  /** Protocol validation error, malformed JSONL, or unparsable canonical event */
  PROTOCOL_ERROR: 3,
  /** Adapter failure, unknown agent, or auto-detection threshold failure */
  ADAPTER_ERROR: 4,
  /** User configuration file parsing, validation, or filesystem access error */
  CONFIG_ERROR: 5,
  /** Environment check or required runtime dependency missing (e.g. Doctor failure) */
  ENVIRONMENT_ERROR: 6,
  /** Process terminated via SIGINT (Ctrl+C) */
  SIGINT: 130,
  /** Process terminated via SIGTERM */
  SIGTERM: 143,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];
