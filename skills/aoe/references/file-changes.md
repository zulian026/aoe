# File Changes Reference

## Purpose

The AOE File Changes Reference provides a standardized, high-density format for presenting file modifications made by AI coding agents. Accurate change reporting ensures developers can audit modifications at a glance, review line changes, understand the scope of edits, and maintain git history hygiene.

---

## Rules

1. **Explicit Modification Actions**: Every changed file must be categorized into one of four standard actions:
   - `CREATED`: A brand-new file was written to disk.
   - `MODIFIED`: An existing file was edited or patched.
   - `DELETED`: A file was removed from the file system.
   - `RENAMED`: A file was moved or renamed (specify old and new path).
2. **Evidence Requirement**: An agent must **never** report a file as modified or created unless the file operation actually succeeded on the file system. Never claim phantom edits.
3. **Concise Intent Summary**: Every file listed must include a single-line summary explaining the functional purpose of the change.
4. **Line Delta Indicators**: When available, include the line delta metric (`+lines / -lines`) to indicate the scope of the modification.
5. **Clickable File Links**: Paths must be formatted as clickable markdown links or clean relative paths from the workspace root (e.g. `src/utils/math.ts`).

---

## Formatting Conventions

### File Change Table Format (Recommended for ≥ 3 files)

```markdown
### Summary of Changes

| Action     | File Path                            | Delta    | Purpose                                          |
| :--------- | :----------------------------------- | :------- | :----------------------------------------------- |
| `CREATED`  | `src/auth/jwt.ts`                    | +64 / -0 | JWT creation, verification, and key rotation     |
| `MODIFIED` | `src/middleware/auth.ts`             | +12 / -8 | Integrates JWT verification into request handler |
| `DELETED`  | `src/legacy/auth-cookie.ts`          | +0 / -48 | Removed deprecated cookie parser                 |
| `RENAMED`  | `src/types.ts` ➔ `src/auth/types.ts` | +0 / -0  | Reorganized auth type definitions                |
```

### Compact File Change List (Recommended for 1–2 files)

```markdown
### File Modifications

- `MODIFIED` **`src/config/app.ts`** (+4 / -1): Added `PORT` environment variable fallback default.
- `CREATED` **`tests/config.test.ts`** (+28 / -0): Added unit test covering fallback defaults.
```

---

## Good Examples

### Good Example 1: Multi-File Feature Addition

```markdown
### Files Modified (4 files)

| Action     | Path                              | Delta     | Description                                              |
| :--------- | :-------------------------------- | :-------- | :------------------------------------------------------- |
| `CREATED`  | `packages/core/src/cache.ts`      | +82 / -0  | In-memory LRU cache implementation with TTL              |
| `CREATED`  | `packages/core/src/cache.test.ts` | +114 / -0 | Comprehensive unit tests for LRU eviction and expiration |
| `MODIFIED` | `packages/core/src/index.ts`      | +3 / -0   | Exports `Cache` class and cache configuration options    |
| `MODIFIED` | `package.json`                    | +1 / -0   | Added `@types/lru-cache` dev dependency                  |
```

### Good Example 2: Clean Deletion and Cleanup

```markdown
### Files Modified

- `DELETED` **`scripts/old-deploy.sh`** (+0 / -54): Removed obsolete Bash deployment script replaced by GitHub Actions workflow.
- `MODIFIED` **`README.md`** (+2 / -5): Updated deployment documentation to reference GitHub Actions.
```

---

## Bad Examples

### Bad Example 1: Vague and Unverifiable File List

```markdown
<!-- BAD: No actions, no deltas, vague descriptions, files not verified -->

Files changed:

- Some files in src/
- Changed the config
- Deleted the old scripts
```

_Why this is bad_: Imprecise, missing exact file paths, offers no change metrics, and cannot be audited by the user.

### Bad Example 2: False Claims of File Creation

```markdown
<!-- BAD: Claiming a file exists before creating it -->

I have created `src/components/Header.tsx` and it works great!
_(Actual file was never written to disk)_
```

_Why this is bad_: Violates the evidence requirement. Hallucinating file operations destroys user trust.

---

## Edge Cases

1. **Binary or Large Asset Files**:
   - For images, compiled binaries, or data blobs where line deltas are not applicable, format the delta as `binary` or file size (e.g. `+240 KB`).
2. **Directory Structure Changes / Restructuring**:
   - When whole directories are relocated, list the parent directory rename or list top-level affected files to avoid generating tables with hundreds of redundant entries.
3. **No Files Changed (Inspection Only)**:
   - Explicitly state: `No files were modified during this inspection.` Do not output an empty table.
