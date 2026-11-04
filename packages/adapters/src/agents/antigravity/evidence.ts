export interface VerificationEvidence {
  command: string;
  exitCode: number;
  timestamp: string;
  taskId: string;
  passed: boolean;
  runnerName?: string;
  sourceEventId?: string;
}

/**
 * Accurately identifies whether a given command line represents an actual test runner invocation.
 * Strictly rejects non-test utilities like mkdir, cat, echo, git, etc. even if their arguments contain "test".
 */
export function identifyTestRunner(commandLine: string): {
  isTestRunner: boolean;
  runnerName?: string;
} {
  if (!commandLine || typeof commandLine !== 'string') {
    return { isTestRunner: false };
  }

  const trimmed = commandLine.trim();

  // Explicit non-test commands that might take arguments containing the word "test"
  const nonTestPrefixes = [
    /^(mkdir|rmdir|rm|touch|cat|head|tail|more|less|nano|vim|vi|echo|printf|ls|dir|find|grep|egrep|fgrep|rg|sed|awk|git|cd|pwd|which|where|cp|mv|chmod|chown)\b/i,
  ];

  for (const regex of nonTestPrefixes) {
    if (regex.test(trimmed)) {
      return { isTestRunner: false };
    }
  }

  // Package manager test commands: npm test, pnpm test, yarn test, bun test, npm run test:unit, etc.
  const pkgMgrPrefix =
    /^(?:sudo\s+)?(?:npx|pnpm\s+exec|yarn\s+exec|bunx)?\s*(?:npm|pnpm|yarn|bun)\b/i;
  if (pkgMgrPrefix.test(trimmed)) {
    const words = trimmed.split(/\s+/);
    const nonTestCommands = [
      'install',
      'i',
      'add',
      'remove',
      'rm',
      'publish',
      'pack',
      'init',
      'create',
      'update',
      'upgrade',
      'why',
      'audit',
      'outdated',
    ];
    const hasNonTestCommand = words.some((w) => nonTestCommands.includes(w.toLowerCase()));
    const hasTestArg = words.some((w) => /^(?:test(?::\w+)?|t)$/i.test(w));
    if (hasTestArg && !hasNonTestCommand) {
      return { isTestRunner: true, runnerName: 'package-manager-test' };
    }
  }

  // Direct test runners
  const directRunners: Array<{ name: string; pattern: RegExp }> = [
    { name: 'vitest', pattern: /^(?:sudo\s+)?(?:npx\s+|pnpm\s+|yarn\s+|bunx\s+)?vitest\b/i },
    { name: 'jest', pattern: /^(?:sudo\s+)?(?:npx\s+|pnpm\s+|yarn\s+|bunx\s+)?jest\b/i },
    { name: 'pytest', pattern: /^(?:sudo\s+)?(?:python[0-9.]*\s+-m\s+)?pytest\b/i },
    { name: 'cargo-test', pattern: /^(?:sudo\s+)?cargo\s+test\b/i },
    { name: 'go-test', pattern: /^(?:sudo\s+)?go\s+test\b/i },
    { name: 'dotnet-test', pattern: /^(?:sudo\s+)?dotnet\s+test\b/i },
    { name: 'ctest', pattern: /^(?:sudo\s+)?ctest\b/i },
    { name: 'mvn-test', pattern: /^(?:sudo\s+)?mvn\s+(?:clean\s+)?test\b/i },
    { name: 'gradle-test', pattern: /^(?:sudo\s+)?(?:\.\/)?gradlew?\s+test\b/i },
  ];

  for (const runner of directRunners) {
    if (runner.pattern.test(trimmed)) {
      return { isTestRunner: true, runnerName: runner.name };
    }
  }

  return { isTestRunner: false };
}

/**
 * Evaluates tool execution result to build structured verification evidence.
 */
export function evaluateVerificationEvidence(
  commandLine: string,
  rawError: unknown,
  taskId: string,
  sourceEventId?: string,
): VerificationEvidence | null {
  const { isTestRunner, runnerName } = identifyTestRunner(commandLine);
  if (!isTestRunner) {
    return null;
  }

  let exitCode = 0;
  let passed = true;

  if (rawError !== undefined && rawError !== null) {
    passed = false;
    exitCode = 1;

    const errStr = String(rawError);
    const codeMatch = errStr.match(/(?:exit (?:status|code)|code)\s*[:=]?\s*(\d+)/i);
    if (codeMatch && codeMatch[1]) {
      const parsed = parseInt(codeMatch[1], 10);
      if (!Number.isNaN(parsed) && parsed !== 0) {
        exitCode = parsed;
      }
    }
  }

  return {
    command: commandLine.trim(),
    exitCode,
    timestamp: new Date().toISOString(),
    taskId,
    passed,
    runnerName,
    sourceEventId,
  };
}
