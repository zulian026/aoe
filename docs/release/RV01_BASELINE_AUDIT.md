# RV01.1 — Repository and Release Baseline Audit

**Project:** Agent Output Enhancement (AOE)  
**Date:** 2026-11-03  
**Auditor:** Senior Release Engineer & Monorepo Architect  
**Scope:** Repository tree, package configurations, dependency declarations, build/test scripts, exports, and distributable file paths.

---

## 1. Inspected Components

| Component | Path | Inspection Status |
|---|---|---|
| **Git Working Tree** | `/home/zyan/Projects/aoe` | Clean on branch `main` at commit `7c87feb` |
| **Root Package Manifest** | `package.json` | Version `0.1.0`, private: `true`, engines: `node >= 20.0.0, pnpm >= 9.0.0` |
| **Workspace Configuration** | `pnpm-workspace.yaml` | Covers `apps/*` and `packages/*` |
| **TypeScript Configs** | `tsconfig.json`, `tsconfig.base.json`, package tsconfigs | Composite references enabled; `strict: true` |
| **CLI Application** | `apps/cli/package.json`, `bin.ts`, `program.ts` | Version `0.1.0`, executable `aoe` in `dist/bin.js` |
| **Protocol Contract** | `packages/protocol/package.json` | Version `0.1.0`, types and exports declared |
| **Core Engine** | `packages/core/package.json` | Version `0.1.0`, exports and types declared |
| **Themes Engine** | `packages/themes/package.json` | Version `0.1.0`, exports and types declared |
| **Renderer Engine** | `packages/renderer/package.json` | Version `0.1.0`, exports and types declared |
| **UI Components** | `packages/components/package.json` | Version `0.1.0`, exports and types declared |
| **Adapters Engine** | `packages/adapters/package.json` | Version `0.1.0`, exports and types declared |
| **Standalone Skill** | `skills/aoe/SKILL.md` | Bundled into `apps/cli/skills` on build |
| **CI/CD Workflows** | `.github/workflows/ci.yml`, `release.yml` | Multi-node matrix, test/lint gates, release draft action |

---

## 2. Audit Findings & Evidence

### Finding 1: Single-Package Installation Fails (Highest Severity)
- **Severity**: **BLOCKER (High)**
- **Component**: `apps/cli/package.json` & distribution architecture
- **Description**: In `apps/cli/package.json`, dependencies on internal monorepo packages are declared as `"workspace:*"`:
  ```json
  "dependencies": {
    "@aoe/adapters": "workspace:*",
    "@aoe/components": "workspace:*",
    "@aoe/core": "workspace:*",
    "@aoe/protocol": "workspace:*",
    "@aoe/renderer": "workspace:*",
    "@aoe/themes": "workspace:*"
  }
  ```
  When `pnpm pack` generates the distributable tarball `aoe-cli-0.1.0.tgz`, these references are transformed to exact versions (`"0.1.0"`). When an external end-user attempts to install `@aoe/cli` alone via `npm install aoe-cli-0.1.0.tgz` or `npm install -g @aoe/cli`, npm attempts to resolve `@aoe/adapters@0.1.0` from the public npm registry and immediately fails with `npm error 404 Not Found - GET https://registry.npmjs.org/@aoe%2fadapters`.
- **Evidence**:
  ```text
  $ npm install ./aoe-cli-0.1.0.tgz
  npm error code E404
  npm error 404 Not Found - GET https://registry.npmjs.org/@aoe%2fadapters - Not found
  ```
- **Required Action**: Resolve the distribution architecture in Workstream RV01.2: either bundle internal packages into the CLI distribution (Option A) or publish all interdependent `@aoe/*` packages to an npm-compatible registry in topological order (Option B).

---

### Finding 2: Hardcoded Local Machine Absolute Paths in Distributable Skill
- **Severity**: **MEDIUM**
- **Component**: `skills/aoe/SKILL.md` and `apps/cli/skills/aoe/SKILL.md`
- **Description**: Reference and example links in `SKILL.md` contain hardcoded author local machine paths (`file:///home/zyan/Projects/aoe/skills/aoe/references/...`). When the CLI is distributed or unpacked on consumer machines, commands like `aoe skill show` output broken file URLs pointing to non-existent `/home/zyan` directories.
- **Evidence**:
  ```text
  skills/aoe/SKILL.md:38: See details in [output-hierarchy.md](file:///home/zyan/Projects/aoe/skills/aoe/references/output-hierarchy.md).
  skills/aoe/SKILL.md:56: See details in [status-system.md](file:///home/zyan/Projects/aoe/skills/aoe/references/status-system.md).
  ```
- **Required Action**: Replace absolute machine file URLs with relative markdown links (`references/output-hierarchy.md`, `examples/task-in-progress.md`).

---

### Finding 3: Workspace Dependency and Version Consistency
- **Severity**: **LOW (PASS)**
- **Component**: All `package.json` manifests
- **Description**: All packages in the monorepo declare consistent version `0.1.0`. All internal workspace references use `workspace:*` which resolves cleanly within development and pnpm builds.
- **Evidence**:
  ```text
  @aoe/cli: 0.1.0
  @aoe/protocol: 0.1.0
  @aoe/core: 0.1.0
  @aoe/renderer: 0.1.0
  @aoe/components: 0.1.0
  @aoe/themes: 0.1.0
  @aoe/adapters: 0.1.0
  ```

---

### Finding 4: Distributable Whitelist and Artifact Cleanliness
- **Severity**: **LOW (PASS)**
- **Component**: Package manifests `files` declarations
- **Description**: All packages specify `"files": ["dist", "README.md", "LICENSE"]` (and `apps/cli` includes `skills`), preventing test source files (`.test.ts`), coverage reports, and build cache from leaking into release tarballs.

---

## 3. Summary of Baseline Action Items

1. **Fix Hardcoded Paths in `skills/aoe/SKILL.md`**: Convert `file:///home/zyan/...` URLs to portable relative links.
2. **Execute RV01.2 Distribution Architecture Verification**: Formulate, test, and implement the single-package CLI distribution strategy to ensure consumers can install `aoe` without 404 registry errors.
