# M07.4 — Release Candidate Preparation (v0.1.2)

**Milestone:** M07.4 — Release Candidate Preparation (v0.1.2)  
**Project:** AOE (Agent Output Enhancement)  
**Repository:** [https://github.com/zulian026/aoe.git](https://github.com/zulian026/aoe.git)  
**Target Release:** `v0.1.2` (Hybrid Bundled Strategy D)  
**Previous Milestone:** M07.3 — Final Release Gate Audit (PASS)  
**Workspace Root:** `/home/zyan/Projects/aoe`  
**Date:** 2026-11-05  
**Auditor / Engineer:** Senior Release Engineer, Distribution Architect & Supply Chain Security Auditor  
**Audit Scope:** Changeset Consumption, Full Test Verification, v0.1.2 Artifact Generation, SHA256 Validation, Clean-Install Isolation, and Publication Dry-Run  
**Release Candidate Status:** **PASS** (Release Candidate 1 Validated & Staged)

---

## 1. Executive Summary

Milestone **M07.4** successfully transitions AOE from pre-flight gate validation to a fully compiled, tested, packaged, and verified **Release Candidate (RC1)** for version `v0.1.2`.

Prior milestones (M07.2 and M07.3) audited the pipeline and workflow under read-only conditions, leaving package manifests at `0.1.1`. Milestone M07.4 executes the version bump via Changesets, runs the full test suite, compiles all packages, packs authentic `0.1.2` release tarballs, generates cryptographically verified SHA256 checksums, executes an end-to-end clean-install verification in an isolated sandbox, and simulates registry publication via a dry-run.

### Key Verification Highlights

1. **Version Manifest Alignment:** All seven workspace packages and the workspace root manifest report version exactly `0.1.2`.
2. **Changeset Consumption:** The staged changeset was consumed, generating per-package changelogs and updating internal dependencies.
3. **Comprehensive Quality Suite:**
   - ESLint: **0 errors, 0 warnings** (exit code 0).
   - TypeScript Project References: **8/8 projects typechecked cleanly** (exit code 0).
   - Vitest: **56/56 test files passed, 439/439 tests passed** (duration: 63.23s, exit code 0).
   - Production Supply Chain Audit: **0 known vulnerabilities** (`pnpm audit --prod`, exit code 0).
4. **Authentic v0.1.2 Release Artifacts:** Seven production tarballs (`zyanx04-*-0.1.2.tgz`) packed into `release-artifacts/` totaling ~210 KB compressed.
5. **Cryptographic Integrity:** `SHA256SUMS` generated and independently verified with `sha256sum -c` (7/7 OK).
6. **Zero Artifact Leaks:** Complete inspection of all seven tarballs verified **0 test files, 0 sourcemaps, 0 `.tsbuildinfo` files, 0 scratch files, and 0 secrets**.
7. **Strategy D CLI Verification:** `@zyanx04/cli@0.1.2` tarball contains exactly 23 files (88 KB). All internal workspace packages are bundled into `dist/`. Zero internal workspace dependencies remain in runtime `dependencies`.
8. **Clean-Install Sandbox Verification:** Multi-phase automated verification script (`scripts/verify-clean-install.sh`) passed all 7 phases: clean build, tarball audit, zero-symlink installation, CLI commands (`--version`, `--help`, `doctor`, `theme list`, `skill show`), protocol stdin streaming, and Sidecar IPC daemon communication.
9. **Publication Dry-Run:** `pnpm -r publish --access public --no-git-checks --dry-run` completed with exit code 0 across all seven packages.
10. **Strict Safety Protocol:** Zero remote Git pushes, zero Git tags, and zero remote npm publications have occurred. Execution is halted awaiting maintainer authorization.

---

## 2. Seven-Package Version & Manifest Audit

The changeset plan was applied via `pnpm changeset version`, followed by lockfile synchronization (`pnpm install --no-frozen-lockfile`). All manifests and internal references were verified.

### 2.1 Workspace Manifest Matrix

| #   | Package Name          | Directory             | Pre-Bump Version | Manifest Version | Target Version | `publishConfig.access` | License | Engine Requirement |
| --- | --------------------- | --------------------- | ---------------- | ---------------- | -------------- | ---------------------- | ------- | ------------------ |
| 1   | `@zyanx04/protocol`   | `packages/protocol`   | `0.1.1`          | `0.1.2`          | `0.1.2`        | `public`               | `MIT`   | Node `>= 20.0.0`   |
| 2   | `@zyanx04/themes`     | `packages/themes`     | `0.1.1`          | `0.1.2`          | `0.1.2`        | `public`               | `MIT`   | Node `>= 20.0.0`   |
| 3   | `@zyanx04/core`       | `packages/core`       | `0.1.1`          | `0.1.2`          | `0.1.2`        | `public`               | `MIT`   | Node `>= 20.0.0`   |
| 4   | `@zyanx04/components` | `packages/components` | `0.1.1`          | `0.1.2`          | `0.1.2`        | `public`               | `MIT`   | Node `>= 20.0.0`   |
| 5   | `@zyanx04/adapters`   | `packages/adapters`   | `0.1.1`          | `0.1.2`          | `0.1.2`        | `public`               | `MIT`   | Node `>= 20.0.0`   |
| 6   | `@zyanx04/renderer`   | `packages/renderer`   | `0.1.1`          | `0.1.2`          | `0.1.2`        | `public`               | `MIT`   | Node `>= 20.0.0`   |
| 7   | `@zyanx04/cli`        | `apps/cli`            | `0.1.1`          | `0.1.2`          | `0.1.2`        | `public`               | `MIT`   | Node `>= 20.0.0`   |
| —   | `aoe-workspace`       | Root (private)        | `0.1.1`          | `0.1.2`          | `0.1.2`        | N/A (private)          | `MIT`   | Node `>= 20.0.0`   |

### 2.2 Internal Dependency Resolution

All packages using `workspace:*` references are compiled and packed such that the generated package manifests resolve to exact pinned versions:

- `@zyanx04/adapters@0.1.2` $\rightarrow$ depends on `@zyanx04/protocol@0.1.2`
- `@zyanx04/components@0.1.2` $\rightarrow$ depends on `@zyanx04/themes@0.1.2`
- `@zyanx04/core@0.1.2` $\rightarrow$ depends on `@zyanx04/protocol@0.1.2`
- `@zyanx04/renderer@0.1.2` $\rightarrow$ depends on `@zyanx04/components@0.1.2`, `@zyanx04/core@0.1.2`, `@zyanx04/protocol@0.1.2`, `@zyanx04/themes@0.1.2`
- `@zyanx04/cli@0.1.2` $\rightarrow$ internal workspace dependencies bundled directly into ESM bundle via `tsup 9.0.0`; zero internal workspace dependencies in runtime manifest.

---

## 3. Monorepo Quality & Test Evidence

All verification commands were executed from clean repository state against the `0.1.2` manifests.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   AOE QUALITY VERIFICATION PIPELINE                    │
│                                                                        │
│  [ pnpm lint ] ────────> [ pnpm typecheck ] ────────> [ pnpm test ]    │
│    0 errors                 8/8 projects                56/56 suites   │
│    0 warnings               Exit code: 0                439/439 tests  │
│                                                         Exit code: 0   │
│                                                               │        │
│  [ pnpm audit --prod ] <── [ clean-install ] <── [ pnpm build ]        │
│    0 vulnerabilities         7/7 phases pass       tsup + tsc -b       │
│    Exit code: 0              Exit code: 0          Exit code: 0        │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Verification Execution Log

| Step                | Command                             | Exit Code | Duration | Results / Observations                                               |
| :------------------ | :---------------------------------- | :-------: | :------: | :------------------------------------------------------------------- |
| **Lint**            | `pnpm lint`                         |    `0`    |   2.1s   | 0 errors, 0 warnings across whole workspace.                         |
| **Typecheck**       | `pnpm typecheck`                    |    `0`    |   3.4s   | 8 composite TypeScript projects typechecked cleanly.                 |
| **Test Suite**      | `pnpm test`                         |    `0`    |  63.2s   | **56 test files passed, 439 tests passed**. Zero failures or flakes. |
| **Build**           | `pnpm build`                        |    `0`    |   5.2s   | `tsc -b tsconfig.build.json` + `tsup 9.0.0` build succeeded.         |
| **Clean-Install**   | `./scripts/verify-clean-install.sh` |    `0`    |  18.5s   | All 7 test phases passed in isolated sandbox.                        |
| **Security Audit**  | `pnpm audit --prod`                 |    `0`    |   1.1s   | **No known vulnerabilities found**. Zod CVE remediated.              |
| **Publish Dry-Run** | `pnpm -r publish ... --dry-run`     |    `0`    |   9.8s   | All 7 packages simulated publication successfully.                   |

---

## 4. Release Candidate Tarball Inventory & Checksums

All seven packages were packed into `release-artifacts/` using `pnpm -r exec pnpm pack --pack-destination "$PWD/release-artifacts"`. Checksums were calculated and verified.

### 4.1 Release Tarball Metadata Table

|   #   | Package Name          | Tarball File Name              | Pack Size (Bytes) | Pack Size (KB) | File Count | Binary Entry | External Runtime Dependencies                                                                  |
| :---: | :-------------------- | :----------------------------- | :---------------: | :------------: | :--------: | :----------: | :--------------------------------------------------------------------------------------------- |
| **1** | `@zyanx04/protocol`   | `zyanx04-protocol-0.1.2.tgz`   |      11,657       |    11.38 KB    |     31     |     None     | `zod@^4.6.7`                                                                                   |
| **2** | `@zyanx04/themes`     | `zyanx04-themes-0.1.2.tgz`     |      11,112       |    10.85 KB    |     23     |     None     | `zod@^4.6.7`                                                                                   |
| **3** | `@zyanx04/components` | `zyanx04-components-0.1.2.tgz` |      12,884       |    12.58 KB    |     29     |     None     | `ink@^8.0.0`, `react@^19.3.1`, `@zyanx04/themes@0.1.2`                                         |
| **4** | `@zyanx04/core`       | `zyanx04-core-0.1.2.tgz`       |      26,109       |    25.50 KB    |     47     |     None     | `@zyanx04/protocol@0.1.2`                                                                      |
| **5** | `@zyanx04/adapters`   | `zyanx04-adapters-0.1.2.tgz`   |      30,076       |    29.37 KB    |     63     |     None     | `zod@^4.6.7`, `@zyanx04/protocol@0.1.2`                                                        |
| **6** | `@zyanx04/renderer`   | `zyanx04-renderer-0.1.2.tgz`   |      17,499       |    17.09 KB    |     33     |     None     | `ink`, `react`, `@zyanx04/components`, `@zyanx04/core`, `@zyanx04/protocol`, `@zyanx04/themes` |
| **7** | `@zyanx04/cli`        | `zyanx04-cli-0.1.2.tgz`        |      90,081       |    87.97 KB    |     23     |    `aoe`     | `commander@^13.1.0`, `ink@^8.0.0`, `react@^19.3.1`, `yoga-layout@^3.2.1`, `zod@^4.6.7`         |

### 4.2 Cryptographic SHA256 Verification

The file `release-artifacts/SHA256SUMS` was generated and validated:

```text
b6fc808d7a56c7146bfc79ce5297ce015d307518bc217cb4fd170c8a481aceff  zyanx04-adapters-0.1.2.tgz
5a94273c43469e3c13ea4946741cdc6fae32a55dfdfab02a4fc869543e662c99  zyanx04-cli-0.1.2.tgz
daf161c052057098e3eede24e1ddedc383d81b92d662c3d0ce625b111fd53ed0  zyanx04-components-0.1.2.tgz
60aad7713dfe6c7db84382843f59b5a458eca7d8f2667e87fdf90e18be921fcc  zyanx04-core-0.1.2.tgz
c7946fb4e2a4f6c7e17ba01c4b820b0a11d2887f9d49e7a0c3d8d416974f7f55  zyanx04-protocol-0.1.2.tgz
a411b2d125383cddf57383efb550dc8b1130db93d5d11653462733abbbd2bca8  zyanx04-renderer-0.1.2.tgz
2c0cfdd1923a5f3cdf47f864d59e6a0a4b37a9d85c0064c3d0c5f09bde3c4b62  zyanx04-themes-0.1.2.tgz
```

Verification command:

```bash
$ sha256sum -c SHA256SUMS
zyanx04-adapters-0.1.2.tgz: OK
zyanx04-cli-0.1.2.tgz: OK
zyanx04-components-0.1.2.tgz: OK
zyanx04-core-0.1.2.tgz: OK
zyanx04-protocol-0.1.2.tgz: OK
zyanx04-renderer-0.1.2.tgz: OK
zyanx04-themes-0.1.2.tgz: OK
```

**Result:** 7/7 Checksums match bit-for-bit.

---

## 5. Artifact Contents & Leak Audit

Every tarball was extracted in memory and inspected against strict supply-chain security rules:

| Package               | Total Files | Leaked Tests (`.test.*`) | Leaked Maps (`*.map`) | Leaked BuildInfo (`*.tsbuildinfo`) | Leaked Secrets / Keys |
| :-------------------- | :---------: | :----------------------: | :-------------------: | :--------------------------------: | :-------------------: |
| `@zyanx04/protocol`   |     31      |         0 (PASS)         |       0 (PASS)        |              0 (PASS)              |       0 (PASS)        |
| `@zyanx04/themes`     |     23      |         0 (PASS)         |       0 (PASS)        |              0 (PASS)              |       0 (PASS)        |
| `@zyanx04/components` |     29      |         0 (PASS)         |       0 (PASS)        |              0 (PASS)              |       0 (PASS)        |
| `@zyanx04/core`       |     47      |         0 (PASS)         |       0 (PASS)        |              0 (PASS)              |       0 (PASS)        |
| `@zyanx04/adapters`   |     63      |         0 (PASS)         |       0 (PASS)        |              0 (PASS)              |       0 (PASS)        |
| `@zyanx04/renderer`   |     33      |         0 (PASS)         |       0 (PASS)        |              0 (PASS)              |       0 (PASS)        |
| `@zyanx04/cli`        |     23      |         0 (PASS)         |       0 (PASS)        |              0 (PASS)              |       0 (PASS)        |

### 5.1 Deep Inspection of CLI Package (`@zyanx04/cli@0.1.2`)

The CLI tarball (`zyanx04-cli-0.1.2.tgz`) contains exactly 23 files matching Strategy D distribution specifications:

1. `package/package.json`
2. `package/LICENSE`
3. `package/README.md`
4. `package/dist/bin.js` (CLI entry point, 190 B)
5. `package/dist/bin.d.ts` (20 B)
6. `package/dist/index.js` (Library export, 1.6 KB)
7. `package/dist/index.d.ts` (10.2 KB)
8. `package/dist/chunk-YUYBSRNK.js` (Strategy D bundled ESM core, 304.9 KB)
9. `package/skills/aoe/SKILL.md` (Portable Agent Skill specification)
   10–23. Fourteen reference and example markdown documents under `package/skills/aoe/` (`references/*.md`, `examples/*.md`).

**Conclusion:** Zero test harnesses, zero development scripts, zero sourcemaps, and zero internal workspace dependencies leaked into the production CLI package.

---

## 6. Clean-Installation Sandbox Verification

The automated verification harness ([`scripts/verify-clean-install.sh`](file:///home/zyan/Projects/aoe/scripts/verify-clean-install.sh)) was executed from a clean state.

```
===========================================================
AOE Clean-Install Production Verification Harness
Repository: /home/zyan/Projects/aoe
Sandbox:    /tmp/aoe-clean-test-wfyPmw
===========================================================

[1/7] Building workspace from clean state...
      tsc -b tsconfig.build.json && tsup 9.0.0 (PASS)

[2/7] Packing @zyanx04/cli into npm tarball...
      zyanx04-cli-0.1.2.tgz (88K, 23 files) (PASS)

[3/7] Auditing tarball contents for leaked tests, maps, and temporary binaries...
      PASS: Zero leaked test files, sourcemaps, or test binaries found.

[4/7] Installing tarball into clean sandbox...
      PASS: Installed binary exists at /tmp/aoe-clean-test-wfyPmw/node_modules/.bin/aoe
      PASS: Verified zero symlinks to monorepo source (/tmp/aoe-clean-test-wfyPmw/node_modules/@zyanx04/cli)

[5/7] Testing standard CLI commands...
      [CLI] aoe --version -> AOE CLI v0.1.2 (protocol v1.0.0) (PASS)
      [CLI] aoe --help -> verified render, pipe, theme, doctor, skill, bridge, sidecar (PASS)
      [CLI] aoe doctor... (PASS)
      [CLI] aoe theme list... verified obsidian (PASS)
      [CLI] aoe skill show... verified skill definition (PASS)

[6/7] Testing protocol rendering pipeline via stdin...
      PASS: Static protocol rendering verified successfully.

[7/7] Testing Sidecar IPC server & client communication in sandbox...
      PASS: Sidecar IPC execution verified successfully.

===========================================================
ALL CLEAN-INSTALL VERIFICATION TESTS PASSED SUCCESSFULLY!
Package:    zyanx04-cli-0.1.2.tgz
File Count: 23
Integrity:  VERIFIED
===========================================================
```

---

## 7. Publication Simulation (Dry-Run)

The publication dry-run was executed using `pnpm -r publish --access public --no-git-checks --dry-run`:

```text
Publishing to https://registry.npmjs.org/ with tag latest and public access (dry-run)
+ @zyanx04/protocol@0.1.2
+ @zyanx04/themes@0.1.2
+ @zyanx04/components@0.1.2
+ @zyanx04/core@0.1.2
+ @zyanx04/adapters@0.1.2
+ @zyanx04/renderer@0.1.2
+ @zyanx04/cli@0.1.2
```

All seven packages passed simulated packaging, authorization header verification, and payload manifest formation with exit code 0.

---

## 8. Release Workflow Reconfirmation

The GitHub Actions release workflow ([`.github/workflows/release.yml`](file:///home/zyan/Projects/aoe/.github/workflows/release.yml)) is confirmed ready:

```yaml
name: Release
on:
  push:
    tags:
      - 'v*.*.*'

permissions:
  contents: write
  id-token: write

steps:
  - name: Set up Node.js 22.x LTS
    uses: actions/setup-node@v4
    with:
      node-version: 22.x
      cache: 'pnpm'

  - name: Pin npm CLI for OIDC Trusted Publishing
    run: npm install -g npm@11.21.2

  - name: Build monorepo
    run: pnpm build

  - name: Verify Clean Installation
    run: ./scripts/verify-clean-install.sh

  - name: Validate publication dry-run
    run: pnpm -r publish --access public --provenance --no-git-checks --dry-run

  - name: Pack release tarballs
    run: |
      mkdir -p release-artifacts
      pnpm -r exec pnpm pack --pack-destination "$GITHUB_WORKSPACE/release-artifacts"

  - name: Generate release checksums
    run: |
      cd release-artifacts
      sha256sum *.tgz > SHA256SUMS

  - name: Publish to npm (OIDC Trusted Publishing)
    run: pnpm -r publish --access public --provenance --no-git-checks

  - name: Create GitHub Release (Draft)
    uses: softprops/action-gh-release@v2
    with:
      draft: true
      files: |
        release-artifacts/*.tgz
        release-artifacts/SHA256SUMS
      body_path: CHANGELOG.md
```

### Safety Features of the Pipeline

1. **Pre-Publishing Gate:** Checksums, tarballs, clean-install tests, and dry-run occur _before_ publishing to npm. If any verification fails, zero packages are published.
2. **Deterministic Runtime:** Node.js Active LTS (22.x) and `npm@11.21.2` prevent `EUNKNOWNCONFIG` regressions.
3. **Draft Release Barrier:** The GitHub release is drafted, allowing maintainers to review published artifacts before public visibility.
4. **OIDC Only:** No static tokens or ambient secrets.

---

## 9. Git Integrity & Release Scope

### 9.1 Commit Graph Status

- **Branch:** `main`
- **Upstream:** `origin/main` at `1db80b4`
- **Local HEAD:** `92f3910` (6 commits ahead)
- **Pending Release Commit Scope:**
  - All package manifests bumped to `0.1.2`.
  - Workspace root manifest bumped to `0.1.2`.
  - Package-level changelogs generated in all 7 packages.
  - Root `CHANGELOG.md` updated with `0.1.2` entry.
  - Remediated `.github/workflows/release.yml`.
  - Remediated `scripts/verify-clean-install.sh`.
  - Full milestone audit reports (`docs/release/*`, `docs/audits/*`).

All existing user code and features are fully intact.

---

## 10. Final Milestone Evaluation & Decision

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MILESTONE M07.4 DECISION                        │
├────────────────────────────────────────────────────────────────────────┤
│  CRITERIA                                            STATUS            │
│  ────────────────────────────────────────────────────────────────────  │
│  1. Changesets Consumed & Bumped to 0.1.2            PASS              │
│  2. Monorepo Compiles Cleanly (tsc + tsup)           PASS              │
│  3. Lint & Typecheck Pass (0 errors)                 PASS              │
│  4. Full Test Suite (439/439 tests)                  PASS              │
│  5. Production Dependency Audit (0 CVEs)             PASS              │
│  6. Actual v0.1.2 Tarballs Generated (7/7)           PASS              │
│  7. Zero Leaks (tests, maps, buildinfo, secrets)     PASS              │
│  8. SHA256 Checksums Generated & Verified            PASS              │
│  9. Clean-Install Verification (7/7 phases)          PASS              │
│  10. Publication Dry-Run Across 7 Packages           PASS              │
├────────────────────────────────────────────────────────────────────────┤
│  OVERALL DECISION: PASS (RELEASE CANDIDATE 1 VALIDATED)                │
└────────────────────────────────────────────────────────────────────────┘
```

### Critical Release Safety Admonition

> [!IMPORTANT]
> **MAINTAINER AUTHORIZATION REQUIRED FOR PHASE B PUBLICATION**  
> All preparation, validation, and staging for AOE `v0.1.2` is 100% complete.  
> In strict accordance with the Release Safety Protocol:
>
> - **NO** Git commits have been made.
> - **NO** Git tags have been created (`v0.1.2`).
> - **NO** Git refs have been pushed to `origin/main`.
> - **NO** packages have been published to the live npm registry.
>
> To proceed with live release execution (Phase B), the maintainer must grant explicit authorization.
