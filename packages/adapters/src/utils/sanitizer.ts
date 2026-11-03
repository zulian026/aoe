const PRIVATE_REASONING_PATTERNS: RegExp[] = [
  /<thought\b[^>]*>([\s\S]*?)<\/thought>/gi,
  /<scratchpad\b[^>]*>([\s\S]*?)<\/scratchpad>/gi,
  /<antThinking\b[^>]*>([\s\S]*?)<\/antThinking>/gi,
  /<internal_reasoning\b[^>]*>([\s\S]*?)<\/internal_reasoning>/gi,
];

/**
 * Masks known credentials, tokens, and passwords in a text string.
 */
export function maskSecrets(input: string): string {
  if (!input) return input;
  let masked = input;

  // Bearer tokens (JWTs, OAuth tokens)
  masked = masked.replace(/Bearer\s+[-A-Za-z0-9._~+/=]+/gi, 'Bearer [REDACTED]');

  // OpenAI & Anthropic style API keys: sk-...
  masked = masked.replace(/sk-[a-zA-Z0-9_-]{20,}/g, 'sk-[REDACTED]');

  // Google API keys: AIza...
  masked = masked.replace(/AIza[0-9A-Za-z_-]{35}/g, 'AIza[REDACTED]');

  // AWS Access Key ID
  masked = masked.replace(/AKIA[0-9A-Z]{16}/g, 'AKIA[REDACTED]');

  // Common key-value secrets
  masked = masked.replace(
    /(password|passwd|pwd|api[_-]?key|apikey|auth[_-]?token|access[_-]?token|secret|private[_-]?key)\s*([=:])\s*([^\s,;&"']+)/gi,
    '$1$2[REDACTED]',
  );

  return masked;
}

/**
 * Strips private reasoning, scratchpads, and hidden thoughts from agent text.
 */
export function stripPrivateReasoning(input: string): string {
  if (!input) return input;
  let result = input;
  for (const pattern of PRIVATE_REASONING_PATTERNS) {
    result = result.replace(pattern, '');
  }
  return result.trim();
}

/**
 * Checks whether an entire string is purely an internal reasoning/scratchpad block.
 */
export function isPrivateReasoningOnly(input: string): boolean {
  if (!input) return false;
  const stripped = stripPrivateReasoning(input);
  return stripped.length === 0 && input.trim().length > 0;
}

/**
 * Sanitizes terminal output text: strips private reasoning, masks secrets, and cleans unprintable controls.
 */
export function sanitizeAgentText(input: string): string {
  if (!input) return input;
  // Strip control characters except newline (\n), carriage return (\r), and tab (\t)
  // eslint-disable-next-line no-control-regex
  const cleanedControls = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return maskSecrets(stripPrivateReasoning(cleanedControls));
}

/**
 * Recursively sanitizes data objects, masking secrets and filtering private reasoning strings.
 */
export function sanitizePayload<T>(payload: T): T {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (typeof payload === 'string') {
    return sanitizeAgentText(payload) as unknown as T;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayload(item)) as unknown as T;
  }

  if (typeof payload === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      // Do not forward fields specifically named thought or scratchpad
      const lowerKey = key.toLowerCase();
      if (
        lowerKey === 'thought' ||
        lowerKey === 'thoughts' ||
        lowerKey === 'scratchpad' ||
        lowerKey === 'reasoning'
      ) {
        continue;
      }
      result[key] = sanitizePayload(value);
    }
    return result as unknown as T;
  }

  return payload;
}
