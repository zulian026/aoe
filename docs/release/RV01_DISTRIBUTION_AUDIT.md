# RV01.2 — Single-Package CLI Distribution Audit

**Project:** Agent Output Enhancement (AOE)  
**Date:** 2026-11-03  
**Auditor:** Senior Release Engineer & Monorepo Architect  
**Objective:** Verify that end-users can install and run AOE via standard package distribution without manual installation of undocumented internal dependencies.

---

## 1. Executive Summary

Previous verification (M08) installed seven workspace tarballs simultaneously in a single `npm install` command. This audit evaluated whether users can install AOE as a single public CLI package (`@aoe/cli`), tested alternative distribution models, and demonstrated user-facing installation behavior against an isolated local registry (Verdaccio).

---

## 2. Evaluation of Distribution Models

### Option A: Bundled CLI

- **Concept**: Bundle internal monorepo packages (`@aoe/protocol`, `@aoe/core`, `@aoe/themes`, `@aoe/components`, `@aoe/renderer`, `@aoe/adapters`) into `apps/cli/dist/bin.js` and `apps/cli/dist/index.js` using an ESM-compatible bundler (such as `esbuild`), externalizing only third-party dependencies (`commander`, `zod`, `ink`, `react`).
- **Pros**:
  - A single package tarball `aoe-cli-0.1.0.tgz` is 100% self-contained.
  - Users can install the tarball directly via `npm install ./aoe-cli-0.1.0.tgz` without requiring internal packages on a registry.
  - Eliminates registry synchronization risks and version mismatches in consumer environments.
  - Reduces disk footprint and package traversal overhead.
- **Cons**:
  - Requires maintaining an additional bundle step in `apps/cli/package.json`.
  - External developers cannot easily import unbundled intermediate internal modules from `@aoe/cli`.

### Option B: Independently Published Packages (Standard Monorepo Model)

- **Concept**: Publish all 7 monorepo packages to an npm-compatible registry in topological dependency order under the `@aoe` scope:
  1. `@aoe/protocol@0.1.0` & `@aoe/themes@0.1.0` (Leaf contracts)
  2. `@aoe/components@0.1.0` & `@aoe/core@0.1.0`
  3. `@aoe/renderer@0.1.0`
  4. `@aoe/adapters@0.1.0`
  5. `@aoe/cli@0.1.0` (Top-level CLI)
- **Pros**:
  - Native pnpm / npm workspace model with zero extra bundling complexity.
  - Developer ecosystem: External developers can install `@aoe/protocol` to build custom agents or `@aoe/core` to build alternative frontends.
  - Clean separation of concerns.
- **Cons**:
  - Installing a standalone tarball of `@aoe/cli` alone fails with `E404` if the internal packages are not yet published to the registry.
  - Requires automated, topological publication ordering in CI release workflows.

### Option C: Recommended Architecture — Hybrid Release Model

1. **Public Registry Distribution (`npm install -g @aoe/cli`)**:
   - Publish all 7 packages to the npm registry in topological order.
   - When users install `@aoe/cli`, the package manager resolves `@aoe/adapters`, `@aoe/renderer`, etc., directly from npm.
2. **GitHub Releases Distribution**:
   - Provide release archives containing all tarballs and/or standalone bundle binaries for offline/firewalled environments.
3. **Skill Bundling**:
   - Pre-bundle `skills/aoe/` inside `@aoe/cli` package files so that `aoe doctor` and `aoe skill` have zero filesystem dependencies on external workspace folders.

---

## 3. Empirical Test Results

### 3.1 Negative Test: Standalone Tarball Installation without Registry

- **Procedure**: Pack only `apps/cli` (`aoe-cli-0.1.0.tgz`) and attempt installation in an isolated project without internal packages published to the target registry.
- **Result**: **FAILED (Expected)**
- **Evidence**:
  ```text
  $ npm install ./aoe-cli-0.1.0.tgz
  npm error code E404
  npm error 404 Not Found - GET https://registry.npmjs.org/@aoe%2fadapters - Not found
  ```
- **Analysis**: Proves that `@aoe/cli` cannot be distributed in isolation without its dependent `@aoe/*` packages being present in the registry.

### 3.2 Positive Test: Multi-Package Registry Publication & Single-Package Installation

- **Procedure**:
  1. Spun up local Verdaccio registry at `http://localhost:4873`.
  2. Published all 7 packages in topological order:
     - `@aoe/protocol@0.1.0` (Published)
     - `@aoe/themes@0.1.0` (Published)
     - `@aoe/core@0.1.0` (Published)
     - `@aoe/components@0.1.0` (Published)
     - `@aoe/renderer@0.1.0` (Published)
     - `@aoe/adapters@0.1.0` (Published)
     - `@aoe/cli@0.1.0` (Published)
  3. Created fresh clean directory `/tmp/aoe-clean-verdaccio-project`.
  4. Executed single user installation command:
     `npm install @aoe/cli --registry http://localhost:4873`
  5. Tested all 10 required operations:

| #   | Check / Operation    | Command                                                            | Result | Output Evidence                                   |
| --- | -------------------- | ------------------------------------------------------------------ | ------ | ------------------------------------------------- |
| 1   | npm pack dry-run     | `pnpm --filter @aoe/cli pack --dry-run`                            | PASS   | Clean tarball metadata                            |
| 2   | Package generation   | `pnpm -r exec pnpm pack`                                           | PASS   | All 7 tarballs generated                          |
| 3   | Package contents     | `tar -ztvf aoe-cli-0.1.0.tgz`                                      | PASS   | Contains `dist`, `skills`, `LICENSE`, `README.md` |
| 4   | Clean single install | `npm install @aoe/cli --registry http://localhost:4873`            | PASS   | Added 49 packages, exit code 0                    |
| 5   | Version command      | `npx aoe --version`                                                | PASS   | `AOE CLI v0.1.0 (protocol v1.0.0)`                |
| 6   | Help command         | `npx aoe --help`                                                   | PASS   | Help documentation with all subcommands           |
| 7   | Doctor command       | `npx aoe doctor`                                                   | PASS   | All 6 categories passed (`SKILL.md` found)        |
| 8   | Doctor JSON          | `npx aoe doctor --json`                                            | PASS   | Valid JSON with `passed: true`, 0 failed          |
| 9   | Theme list           | `npx aoe theme list`                                               | PASS   | Displays active theme and choices                 |
| 10  | Render command       | `echo '{...}' \| npx aoe render --mode static`                     | PASS   | `AOE Session sess-1: [ACTIVE]`                    |
| 11  | Pipe command         | `echo '{...}' \| npx aoe pipe --agent generic-jsonl --mode static` | PASS   | `AOE Session sess-1: [ACTIVE]`                    |

---

## 4. Distribution Blockers & Resolutions

1. **Publication Sequence Blocker**:
   - _Issue_: If `@aoe/cli` is published before `@aoe/adapters`, `npm install @aoe/cli` will fail.
   - _Resolution_: Release workflow must publish in strict topological order or use `pnpm -r publish` which automatically computes the topological DAG.
2. **Offline / Standalone Tarball Limitation**:
   - _Issue_: Users downloading only `aoe-cli-0.1.0.tgz` cannot install it locally without registry access.
   - _Resolution_: Document that npm registry installation (`npm install -g @aoe/cli`) is the primary distribution method, and provide a multi-package archive or bundled binary in GitHub Release assets.

---

## 5. Conclusion & Recommendation

The distribution model is **VERIFIED** for npm registry deployment. Users can install AOE via `npm install -g @aoe/cli` without manually installing or specifying internal packages, provided all packages in the monorepo are published in accordance with the topological dependency tree.
