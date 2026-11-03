import { Readable } from 'node:stream';
import { CliError } from '../utils/errors.js';
import { ExitCode } from './exit-codes.js';

export interface ReadStdinOptions {
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024; // 50MB protection

/**
 * Asynchronously reads text chunks from a readable stream (defaults to process.stdin).
 * Enforces size limits and handles stream encoding.
 */
export async function* readStreamChunks(
  stream: NodeJS.ReadableStream = process.stdin,
  options: ReadStdinOptions = {},
): AsyncGenerator<string, void, unknown> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  let totalBytes = 0;

  if (stream instanceof Readable) {
    stream.setEncoding('utf-8');
  }

  for await (const chunk of stream) {
    const text = typeof chunk === 'string' ? chunk : (chunk as Buffer).toString('utf-8');
    totalBytes += Buffer.byteLength(text, 'utf-8');

    if (totalBytes > maxBytes) {
      throw new CliError(`Input stream exceeded maximum allowed size of ${maxBytes} bytes`, {
        exitCode: ExitCode.PROTOCOL_ERROR,
        hint: 'Verify the stream source is not emitting an unbounded payload.',
      });
    }

    yield text;
  }
}

/**
 * Checks if a stream is an interactive terminal (TTY) with no piped input.
 */
export function isPipedStream(stream: NodeJS.ReadableStream = process.stdin): boolean {
  const asTty = stream as { isTTY?: boolean };
  return asTty.isTTY !== true;
}
