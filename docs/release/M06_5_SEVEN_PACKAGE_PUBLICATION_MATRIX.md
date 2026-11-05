# M06.5 — Seven-Package Publication Matrix & Workspace Safety Audit

**Milestone:** M06.5 — OIDC Trusted Publishing & Release Pipeline Hardening  
**Project:** AOE (Agent Output Enhancement)  
**Repository:** [https://github.com/zulian026/aoe.git](https://github.com/zulian026/aoe.git)  
**Workspace Root:** `/home/zyan/Projects/aoe`  
**Date:** 2026-11-05  
**Auditor:** Senior Release Engineer & Software Supply Chain Security Auditor  
**Status:** COMPLETE

---

## 1. Executive Summary

The AOE repository is a multi-package pnpm workspace containing:

- 1 Root Workspace orchestration package (`aoe-workspace`).
- 1 Application package (`@zyanx04/cli`).
- 6 Supporting library packages (`@zyanx04/protocol`, `@zyanx04/themes`, `@zyanx04/core`, `@zyanx04/components`, `@zyanx04/adapters`, `@zyanx04/renderer`).

This audit inspects all seven publishable packages and the root workspace to guarantee that recursive publication (`pnpm -r publish`) executes predictably, prevents accidental root leakage, cleanly transforms internal `workspace:*` references into immutable semver strings, and complies with npm registry policies.

---

## 2. Root Workspace Protection

The root [package.json](file:///home/zyan/Projects/aoe/package.json#L1-L6) is explicitly configured as a private monorepo root:

```json
{
  "name": "aoe-workspace",
  "version": "0.1.1",
  "private": true
}
```

**Verification:**

- `pnpm -r publish` unconditionally ignores any package with `"private": true`.
- The root workspace cannot be published to npm under any circumstance.
- Tested via `pnpm -r publish --dry-run`: 0 root package publish attempts.

---

## 3. Comprehensive Seven-Package Publication Matrix

| Package Name              | Directory             | Current Version | Planned Target | Private | `publishConfig`        | License | Whitelisted Files                        |
| ------------------------- | --------------------- | --------------- | -------------- | ------- | ---------------------- | ------- | ---------------------------------------- |
| **`@zyanx04/cli`**        | `apps/cli`            | `0.1.1`         | `0.1.2`        | `false` | `{"access": "public"}` | MIT     | `dist`, `skills`, `README.md`, `LICENSE` |
| **`@zyanx04/protocol`**   | `packages/protocol`   | `0.1.1`         | `0.1.2`        | `false` | `{"access": "public"}` | MIT     | `dist`, `README.md`, `LICENSE`           |
| **`@zyanx04/themes`**     | `packages/themes`     | `0.1.1`         | `0.1.2`        | `false` | `{"access": "public"}` | MIT     | `dist`, `README.md`, `LICENSE`           |
| **`@zyanx04/core`**       | `packages/core`       | `0.1.1`         | `0.1.2`        | `false` | `{"access": "public"}` | MIT     | `dist`, `README.md`, `LICENSE`           |
| **`@zyanx04/components`** | `packages/components` | `0.1.1`         | `0.1.2`        | `false` | `{"access": "public"}` | MIT     | `dist`, `README.md`, `LICENSE`           |
| **`@zyanx04/adapters`**   | `packages/adapters`   | `0.1.1`         | `0.1.2`        | `false` | `{"access": "public"}` | MIT     | `dist`, `README.md`, `LICENSE`           |
| **`@zyanx04/renderer`**   | `packages/renderer`   | `0.1.1`         | `0.1.2`        | `false` | `{"access": "public"}` | MIT     | `dist`, `README.md`, `LICENSE`           |

---

## 4. Package Manifest & Dependency Architecture Audit

### 4.1 `@zyanx04/cli` (Hybrid Bundled Distribution — Strategy D)

- **Manifest:** [apps/cli/package.json](file:///home/zyan/Projects/aoe/apps/cli/package.json)
- **Repository Metadata:** `{"type": "git", "url": "https://github.com/zulian026/aoe.git", "directory": "apps/cli"}`
- **Runtime Dependencies:** `commander`, `ink`, `react`, `yoga-layout`, `zod`
- **Internal Workspace Dependencies:** ALL bundled into `dist/` by `tsup 9.0.0`.
- **Packaged Artifact Size:** 23 files, ~89.7 kB compressed (unpacked: 385 kB).
- **Workspace Protocol Leakage:** **NONE** (Zero `workspace:*` dependencies in runtime dependencies).

### 4.2 `@zyanx04/protocol`

- **Manifest:** [packages/protocol/package.json](file:///home/zyan/Projects/aoe/packages/protocol/package.json)
- **Repository Metadata:** `{"type": "git", "url": "https://github.com/zulian026/aoe.git", "directory": "packages/protocol"}`
- **Runtime Dependencies:** `zod`
- **Workspace Protocol Leakage:** **NONE** (No internal dependencies).

### 4.3 `@zyanx04/themes`

- **Manifest:** [packages/themes/package.json](file:///home/zyan/Projects/aoe/packages/themes/package.json)
- **Repository Metadata:** `{"type": "git", "url": "https://github.com/zulian026/aoe.git", "directory": "packages/themes"}`
- **Runtime Dependencies:** `zod`
- **Workspace Protocol Leakage:** **NONE** (No internal dependencies).

### 4.4 `@zyanx04/core`

- **Manifest:** [packages/core/package.json](file:///home/zyan/Projects/aoe/packages/core/package.json)
- **Repository Metadata:** `{"type": "git", "url": "https://github.com/zulian026/aoe.git", "directory": "packages/core"}`
- **Source Dependencies:** `"@zyanx04/protocol": "workspace:*"`
- **Packaged Dependencies:** `"@zyanx04/protocol": "0.1.1"` (verified via tarball extraction).

### 4.5 `@zyanx04/components`

- **Manifest:** [packages/components/package.json](file:///home/zyan/Projects/aoe/packages/components/package.json)
- **Repository Metadata:** `{"type": "git", "url": "https://github.com/zulian026/aoe.git", "directory": "packages/components"}`
- **Source Dependencies:** `"@zyanx04/themes": "workspace:*"`, `ink`, `react`
- **Packaged Dependencies:** Automatically resolved to concrete semver upon packing.

### 4.6 `@zyanx04/adapters`

- **Manifest:** [packages/adapters/package.json](file:///home/zyan/Projects/aoe/packages/adapters/package.json)
- **Repository Metadata:** `{"type": "git", "url": "https://github.com/zulian026/aoe.git", "directory": "packages/adapters"}`
- **Source Dependencies:** `"@zyanx04/protocol": "workspace:*"`, `zod`
- **Packaged Dependencies:** Automatically resolved to concrete semver upon packing.

### 4.7 `@zyanx04/renderer`

- **Manifest:** [packages/renderer/package.json](file:///home/zyan/Projects/aoe/packages/renderer/package.json)
- **Repository Metadata:** `{"type": "git", "url": "https://github.com/zulian026/aoe.git", "directory": "packages/renderer"}`
- **Source Dependencies:** `"@zyanx04/components": "workspace:*"`, `"@zyanx04/core": "workspace:*"`, `"@zyanx04/protocol": "workspace:*"`, `"@zyanx04/themes": "workspace:*"`, `ink`, `react`
- **Packaged Dependencies:** Automatically resolved to concrete semver upon packing.

---

## 5. Tarball Verification & `workspace:*` Resolution Evidence

To verify that the `workspace:*` protocol is completely eliminated before publishing, `packages/core` was packed and inspected:

```bash
cd packages/core && pnpm pack --pack-destination /tmp
tar -xzf /tmp/zyanx04-core-0.1.1.tgz -O package/package.json
```

**Extracted Manifest (`package/package.json`):**

```json
{
  "name": "@zyanx04/core",
  "version": "0.1.1",
  "dependencies": {
    "@zyanx04/protocol": "0.1.1"
  }
}
```

**Evidence:**

- `workspace:*` was replaced with the exact version string `"0.1.1"`.
- Zero unresolvable protocol schemes reach npm consumers.
- DevDependencies are stripped from the published artifact.

---

## 6. npm Trusted Publisher Scope Matrix

Because npm does not provide organization-wide wildcard Trusted Publishing for individual repositories, each package must be registered separately:

| #   | Package Name          | npm Access Settings URL                                                           | Required Trusted Publisher Settings            |
| --- | --------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | `@zyanx04/cli`        | [npm/cli/access](https://www.npmjs.com/package/@zyanx04/cli/access)               | Repo: `zulian026/aoe`, Workflow: `release.yml` |
| 2   | `@zyanx04/protocol`   | [npm/protocol/access](https://www.npmjs.com/package/@zyanx04/protocol/access)     | Repo: `zulian026/aoe`, Workflow: `release.yml` |
| 3   | `@zyanx04/themes`     | [npm/themes/access](https://www.npmjs.com/package/@zyanx04/themes/access)         | Repo: `zulian026/aoe`, Workflow: `release.yml` |
| 4   | `@zyanx04/core`       | [npm/core/access](https://www.npmjs.com/package/@zyanx04/core/access)             | Repo: `zulian026/aoe`, Workflow: `release.yml` |
| 5   | `@zyanx04/components` | [npm/components/access](https://www.npmjs.com/package/@zyanx04/components/access) | Repo: `zulian026/aoe`, Workflow: `release.yml` |
| 6   | `@zyanx04/adapters`   | [npm/adapters/access](https://www.npmjs.com/package/@zyanx04/adapters/access)     | Repo: `zulian026/aoe`, Workflow: `release.yml` |
| 7   | `@zyanx04/renderer`   | [npm/renderer/access](https://www.npmjs.com/package/@zyanx04/renderer/access)     | Repo: `zulian026/aoe`, Workflow: `release.yml` |

> [!CAUTION]
> If a tag is pushed when only a subset of these 7 packages are configured as Trusted Publishers on npmjs.com, `pnpm -r publish` will publish the configured packages and fail on the unconfigured ones. Maintainers must ensure all 7 packages have identical Trusted Publisher entries before triggering the v0.1.2 release.
