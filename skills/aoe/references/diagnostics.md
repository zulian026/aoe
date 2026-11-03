# Diagnostics Reference

## Purpose

The AOE Diagnostics Reference standardizes the presentation of technical issues, compiler errors, runtime exceptions, and security alerts. High-quality diagnostics isolate confirmed facts from working hypotheses, pinpoint precise code locations, identify root causes, and propose clear, actionable remediations.

---

## Rules

1. **Three Severity Tiers**:
   - `ERROR`: Unrecoverable failure, compile break, test crash, or syntax issue preventing execution.
   - `WARNING`: Non-fatal flaw, deprecated API usage, performance degradation, or missing configuration.
   - `INFO`: Neutral diagnostic context, environmental notice, or optimization suggestion.
2. **Fact vs. Hypothesis Separation**: Strictly distinguish between **Confirmed Facts** (verified by compiler output, stack trace, or test result) and **Hypotheses** (suspected underlying causes pending verification). Never present an unverified guess as a proven fact.
3. **Location Precision**: Always cite the exact file path, line number, and column when available (e.g., `src/auth.ts:42:15`).
4. **Mandatory Remediation**: Every `ERROR` and `WARNING` diagnostic must be accompanied by a concrete, actionable remediation step.
5. **No Speculative Blame**: Do not blame third-party dependencies, network failures, or compiler bugs without demonstrable evidence.

---

## Formatting Conventions

### Diagnostic Callout Block

```markdown
### Diagnostic: [Issue Title]

- **Severity**: `[ERROR | WARNING | INFO]`
- **Location**: `[file-path]:[line]:[col]`
- **Confirmed Fact**: [What definitely occurred based on verified evidence]
- **Hypothesis**: [Suspected mechanism or reason under investigation]
- **Root Cause**: [Proven underlying root cause once verified]
- **Suggested Remediation**: [Actionable steps to resolve the issue]
```

### Compact Inline Diagnostic

```markdown
> [!WARNING] **Deprecated API Call** at `src/client.ts:88:4`  
> `client.connectLegacy()` is deprecated in v2.0. Use `client.connect({ mode: 'async' })` to prevent connection stalls.
```

---

## Good Examples

### Good Example 1: Type Checking Failure Diagnostic

```markdown
### Diagnostic: Type Mismatch in Request Envelope

- **Severity**: `ERROR`
- **Location**: `packages/protocol/src/envelope.ts:34:18`
- **Confirmed Fact**: TypeScript compiler error TS2322: Type `'string'` is not assignable to type `'number'`.
- **Root Cause**: `sequence` property in `ProtocolEnvelope` was defined as `string` in parser tests, but `ProtocolEnvelopeSchema` requires `z.number().int().nonnegative()`.
- **Suggested Remediation**: Convert test fixtures in `packages/protocol/src/envelope.test.ts` to supply an integer sequence index (`sequence: 0`).
```

### Good Example 2: Runtime Race Condition Diagnostic

```markdown
### Diagnostic: Intermittent Timeout in Connection Pool Tests

- **Severity**: `WARNING`
- **Location**: `tests/integration/pool.test.ts:74:9`
- **Confirmed Fact**: Test timed out after 5,000ms on 2 out of 10 runs under concurrent load.
- **Hypothesis**: Connection pool exhaustion occurs when connections are checked out without an explicit release timeout.
- **Suggested Remediation**: Add connection leak detection and enforce a 2,000ms max idle timeout in `ConnectionPoolOptions`.
```

---

## Bad Examples

### Bad Example 1: Conflating Guesses with Proven Facts

```markdown
<!-- BAD: Stating an unverified guess as an absolute fact -->

The server failed because the database server is running out of memory and crashing.
```

_Why this is bad_: Does not cite memory metrics, logs, or error codes. Presents pure speculation as an established fact.

### Bad Example 2: Missing Location and Remediation

```markdown
<!-- BAD: Vague error without location or action -->

Error: Something went wrong in the renderer component. It gave an undefined error.
```

_Why this is bad_: Useless for debugging. Gives no line number, no stack trace, and no solution.

---

## Edge Cases

1. **Multiple Cascading Errors**:
   - When a single root syntax error triggers 50 secondary compiler diagnostics, focus the report on the primary root error and note that secondary errors will be re-evaluated after fixing the first.
2. **Third-Party Dependency Failures**:
   - When an error originates inside `node_modules` or an external binary, cite the package name, installed version, and whether an issue report or workaround exists.
3. **Silent Logic Bugs**:
   - If a test fails with `expected true, received false` without a stack trace, detail the assertion inputs and the discrepancy between expected and observed state.
