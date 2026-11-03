# Command Output Reference

## Purpose

The AOE Command Output Reference establishes clear conventions for presenting terminal commands, execution statuses, exit codes, and process streams. AI coding agents must communicate what commands were executed, whether they succeeded, and present output compactly without burying users in megabytes of noisy logs.

---

## Rules

1. **Explicit Command Syntax & Exit Code**: Every command execution summary must state:
   - The exact command line string executed.
   - The process exit code (`exit code 0` for success, non-zero for failures).
2. **Never Hide Meaningful Errors**: If a command fails or emits critical stderr warnings, the error message and relevant stack frames must be displayed prominently. Never swallow or conceal failed command runs.
3. **Segregate stdout and stderr**: When presenting diagnostics for a failed command, distinguish between standard output and standard error streams.
4. **Intelligent Output Truncation**: For verbose commands producing hundreds of lines (e.g., package installations, full builds), do not dump the raw stream into the chat. Extract and show:
   - Command header and exit status.
   - Summary lines (e.g., `14 packages added`, `Tests: 42 passed, 42 total`).
   - Relevant failure lines or errors if any occurred.
5. **Mask Sensitive Information**: Secrets, environment credentials, authorization headers, and private API tokens must be redacted from command strings and output logs before display.

---

## Formatting Conventions

### Standard Command Execution Block

````markdown
```bash
$ [command string]
# Exit code: [0 | non-zero] (Duration: [time])
```
````

````

### Failed Command Block with Segregated Error

```markdown
```bash
$ [failing command string]
# Exit code: 1
````

**Standard Error:**

```text
[Relevant error snippet / stack trace]
```

````

---

## Good Examples

### Good Example 1: Passing Test Execution with Compact Metrics

```markdown
```bash
$ pnpm test packages/core
# Exit code: 0 (Duration: 1.24s)
````

```text
 ✓ src/index.test.ts (4 tests) 12ms
 ✓ src/session.test.ts (6 tests) 18ms

Test Files  2 passed (2)
     Tests  10 passed (10)
  Duration  1.24s
```

````

### Good Example 2: Failed Command with Prominent Error Diagnostics

```markdown
```bash
$ pnpm build
# Exit code: 2
````

**Standard Error:**

```text
packages/core/src/index.ts:18:12 - error TS2339: Property 'sessionId' does not exist on type 'EngineState'.
18     return this.state.sessionId;
                         ~~~~~~~~~
Found 1 error in packages/core/src/index.ts:18
```

````

---

## Bad Examples

### Bad Example 1: Swallowing Errors

```markdown
<!-- BAD: Command failed, but output hides exit code and error logs -->
I ran `pnpm test` and it had a minor problem, but I am sure the code is fine.
````

_Why this is bad_: Withholds critical error data from the developer and falsely minimizes an operational failure.

### Bad Example 2: Unfiltered 500-Line Log Dump

````markdown
<!-- BAD: Dumps thousands of repetitive build lines without summary -->

```bash
$ pnpm install
Progress: resolved 1, reused 0
Progress: resolved 2, reused 0
... [480 lines omitted] ...
Progress: resolved 482, reused 0
Done in 12.4s
```
````

```
*Why this is bad*: Floods the user's terminal buffer with low-value spam, degrading read comprehension.

---

## Edge Cases

1. **Interactive Commands**:
   - Coding agents should avoid running interactive prompts (e.g., `read -p`, interactive wizards). If an interactive command is required, specify flags that run in non-interactive / CI mode (e.g. `--yes`, `--non-interactive`).
2. **Background Processes / Daemons**:
   - If launching a background server or watcher, report the command, process PID, the port/socket bound, and the location of log outputs.
3. **Empty Output with Non-Zero Exit Code**:
   - If a command fails silently with an exit code (e.g. `exit code 137` due to Out-Of-Memory SIGKILL), explicitly report: `Command terminated with exit code 137 (SIGKILL / Out of Memory). No output produced on stdout/stderr.`
```
