import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import { parseEventStream, ProtocolError } from '@aoe/protocol';
import { maskSecrets, sanitizeTerminalText, stripAnsi } from '@aoe/components';
import {
  maskSecrets as adapterMaskSecrets,
  stripPrivateReasoning,
  sanitizePayload,
} from '@aoe/adapters';
import { readStreamChunks } from '../runtime/stdin-reader.js';
import { CliError } from '../utils/errors.js';

describe('Security Hardening & Protection Tests', () => {
  describe('Terminal Output Sanitization', () => {
    it('strips OSC terminal title and clipboard manipulation sequences', () => {
      const oscTitle = '\x1b]0;Injected Title\x07Safe message';
      const oscStTitle = '\x1b]2;Injected Title\x1b\\Another message';
      const oscClipboard = '\x1b]52;c;ZXZpbA==\x07Clipboard payload';

      expect(sanitizeTerminalText(oscTitle)).toBe('Safe message');
      expect(sanitizeTerminalText(oscStTitle)).toBe('Another message');
      expect(sanitizeTerminalText(oscClipboard)).toBe('Clipboard payload');
    });

    it('strips dangerous CSI cursor control and screen clearing escapes while keeping safe text', () => {
      const csiClear = '\x1b[2J\x1b[HClearing screen';
      const csiCursor = '\x1b[10;20HCursor relocated';
      const csiAltScreen = '\x1b[?1049hSwitched alternate screen';

      expect(sanitizeTerminalText(csiClear)).toBe('Clearing screen');
      expect(sanitizeTerminalText(csiCursor)).toBe('Cursor relocated');
      expect(sanitizeTerminalText(csiAltScreen)).toBe('Switched alternate screen');
    });

    it('strips DCS, APC, and PM escape sequences', () => {
      const dcs = '\x1bP+q1234\x1b\\DCS text';
      const apc = '\x1b_G1234\x1b\\APC text';
      const pm = '\x1b^privacy\x07PM text';

      expect(sanitizeTerminalText(dcs)).toBe('DCS text');
      expect(sanitizeTerminalText(apc)).toBe('APC text');
      expect(sanitizeTerminalText(pm)).toBe('PM text');
    });

    it('neutralizes Trojan Source Unicode bidirectional override characters', () => {
      // U+202E (RIGHT-TO-LEFT OVERRIDE), U+2066 (LEFT-TO-RIGHT ISOLATE)
      const bidiAttack = 'User: \u202Ereversed\u202C executed';
      const sanitized = sanitizeTerminalText(bidiAttack);
      expect(sanitized).toBe('User: reversed executed');
      expect(sanitized).not.toContain('\u202E');
    });

    it('strips unprintable ASCII control characters except tab and newline', () => {
      const controlChars = 'Hello\x00\x01\x07\x08World\t\nLine 2\x7F';
      const sanitized = sanitizeTerminalText(controlChars);
      expect(sanitized).toBe('HelloWorld\t\nLine 2');
    });

    it('completely strips all ANSI styling when stripAnsi is invoked', () => {
      const colored = '\x1b[31;1mRed Bold Text\x1b[0m and \x1b[32mGreen\x1b[0m';
      expect(stripAnsi(colored)).toBe('Red Bold Text and Green');
    });
  });

  describe('Secret & Credential Masking', () => {
    it('masks Bearer tokens in URLs and headers', () => {
      const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDD';
      expect(maskSecrets(input)).toBe('Authorization: Bearer ******');
      expect(adapterMaskSecrets(input)).toBe('Authorization: Bearer [REDACTED]');
    });

    it('masks OpenAI and Anthropic API keys (sk-...)', () => {
      const input = 'Failed to connect using sk-ant-api03-abcdef1234567890abcdef1234567890 key';
      expect(maskSecrets(input)).toBe('Failed to connect using ****** key');
      expect(adapterMaskSecrets(input)).toBe('Failed to connect using sk-[REDACTED] key');
    });

    it('masks Google AI API keys (AIza...)', () => {
      const input = 'Using API Key AIzaSyD123456789012345678901234567890123 for Gemini';
      expect(maskSecrets(input)).toBe('Using API Key ****** for Gemini');
      expect(adapterMaskSecrets(input)).toBe('Using API Key AIza[REDACTED] for Gemini');
    });

    it('masks AWS Access Key IDs (AKIA...)', () => {
      const input = 'AWS credentials found: AKIAIOSFODNN7EXAMPLE';
      expect(maskSecrets(input)).toBe('AWS credentials found: ******');
      expect(adapterMaskSecrets(input)).toBe('AWS credentials found: AKIA[REDACTED]');
    });

    it('masks GitHub Personal Access Tokens (ghp_ and github_pat_)', () => {
      const ghp = 'GitHub ghp_1234567890abcdefghijklmnopqrstuvwxyz credential';
      const pat =
        'GitHub github_pat_11ABCD_1234567890abcdefghijklmnopqrstuvwxyz1234567890 credential';
      expect(maskSecrets(ghp)).toBe('GitHub ****** credential');
      expect(maskSecrets(pat)).toBe('GitHub ****** credential');
    });

    it('masks common key-value assignments (password, api_key, secret)', () => {
      const str1 = 'db_connection: password=supersecretpass;host=localhost';
      const str2 = 'config: api_key="abc123xyz789"';
      expect(maskSecrets(str1)).toBe('db_connection: password=******;host=localhost');
      expect(maskSecrets(str2)).toBe('config: api_key=******');
    });

    it('masks full PEM private key blocks', () => {
      const pem = `
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y1+abcdefghijklmnopqrstuvwxyz1234567890
-----END RSA PRIVATE KEY-----
`;
      const masked = maskSecrets(pem);
      expect(masked).toContain('-----BEGIN PRIVATE KEY-----\n******\n-----END PRIVATE KEY-----');
      expect(masked).not.toContain('MIIEowIBAAKCAQEA0Y1+');
    });
  });

  describe('Private Reasoning Suppression', () => {
    it('strips all variants of internal thought and scratchpad tags', () => {
      const agentMsg =
        '<thought>Let me check if the database is open.</thought>Processing task.<scratchpad>Note to self: inspect port 5432</scratchpad>';
      const stripped = stripPrivateReasoning(agentMsg);
      expect(stripped).toBe('Processing task.');
    });

    it('strips anthropic and internal_reasoning tags', () => {
      const agentMsg =
        '<antThinking>Hidden reasoning</antThinking>Output result.<internal_reasoning>Secret logic</internal_reasoning>';
      const stripped = stripPrivateReasoning(agentMsg);
      expect(stripped).toBe('Output result.');
    });

    it('omits thought fields when sanitizing payload objects', () => {
      const payload = {
        task: 'build',
        thought: 'Internal planning logic',
        reasoning: 'Why we did this',
        nested: {
          scratchpad: 'Draft notes',
          result: 'Clean output',
        },
      };

      const sanitized = sanitizePayload(payload) as {
        task: string;
        thought?: string;
        reasoning?: string;
        nested: { scratchpad?: string; result: string };
      };

      expect(sanitized.task).toBe('build');
      expect(sanitized.thought).toBeUndefined();
      expect(sanitized.reasoning).toBeUndefined();
      expect(sanitized.nested.scratchpad).toBeUndefined();
      expect(sanitized.nested.result).toBe('Clean output');
    });
  });

  describe('Input Streaming & Memory Bounds', () => {
    it('rejects records exceeding maximum record byte limit in parseEventStream', async () => {
      // Create a chunk larger than 1MB with no newline
      const oversizedChunk = 'a'.repeat(1024 * 1024 + 50);

      async function* generate() {
        yield oversizedChunk;
      }

      const stream = parseEventStream(generate(), { maxLineLengthBytes: 1024 * 1024 });

      await expect(async () => {
        for await (const _ of stream) {
          // should throw
        }
      }).rejects.toThrow(ProtocolError);
    });

    it('enforces total stream memory limit in readStreamChunks', async () => {
      const stream = new Readable({
        read() {
          this.push('chunk data\n');
        },
      });

      // Set tiny maxBytes of 50 bytes
      const chunkGen = readStreamChunks(stream, { maxBytes: 50 });

      await expect(async () => {
        for await (const _ of chunkGen) {
          // reading chunks until overflow
        }
      }).rejects.toThrow(CliError);
    });
  });

  describe('Crash Resilience & Malformed Data Defense', () => {
    it('safely handles ReDoS attack strings and ultra-long inputs without crashing or hanging', () => {
      // 50,000 character string of repeated potential trigger patterns
      const largeInput = 'Bearer ' + 'A'.repeat(50000) + ' <thought>' + 'B'.repeat(10000);
      const start = Date.now();
      const sanitized = sanitizeTerminalText(maskSecrets(largeInput));
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(1000); // Must complete within 1 second (no catastrophic backtracking)
      expect(sanitized).toBeDefined();
      expect(sanitized).toContain('Bearer ******');
    });

    it('safely handles unclosed or mismatched reasoning tags without throwing', () => {
      const unclosed = '<thought>Internal thought with no closing tag but trailing text';
      expect(() => stripPrivateReasoning(unclosed)).not.toThrow();
      const mismatched = '<scratchpad>notes</thought>Real message';
      expect(() => stripPrivateReasoning(mismatched)).not.toThrow();
    });

    it('prevents prototype pollution injection in sanitizePayload', () => {
      const payloadWithProto = JSON.parse('{"__proto__":{"polluted":true},"task":"valid"}');
      const sanitized = sanitizePayload(payloadWithProto) as Record<string, unknown>;

      expect(sanitized.task).toBe('valid');
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
  });
});
