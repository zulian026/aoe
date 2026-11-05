# M07.5 — AOE v0.1.2 Phase B2 Production Release Report

**Milestone:** M07.5 — Phase B2 Authorized Production Release  
**Project:** AOE (Agent Output Enhancement)  
**Repository:** [https://github.com/zulian026/aoe.git](https://github.com/zulian026/aoe.git)  
**Target Version:** `0.1.2` (Hybrid Bundled Strategy D)  
**Target Tag:** `v0.1.2`  
**Target Branch:** `main`  
**Execution Date:** 2026-11-05  
**Auditor / Release Engineer:** Senior Release Engineer, DevOps Engineer & Supply Chain Security Auditor  
**Final Release Status:** **FAILED** (Workflow Execution Failed — Remediation Required Prior to Publication)

---

## 1. Authorization Reference

The maintainer explicitly authorized Phase B2 live release operations in the instruction:

> "Maintainer has explicitly authorized the FULL Phase B release:
>
> - Commit the validated AOE v0.1.2 release changes.
> - Push the release commit to `origin/main`.
> - Create and push annotated Git tag `v0.1.2`.
> - Trigger GitHub Actions `release.yml`.
> - Publish all seven public npm packages through GitHub Actions OIDC Trusted Publishing.
> - Verify npm publication, provenance, and GitHub Release status."

In accordance with strict safety rules:

- Zero manual local npm publications were attempted (`npm publish` was not run).
- Zero static authentication tokens (`NPM_TOKEN`, `NODE_AUTH_TOKEN`) were used.
- Git operations were fully audited before staging and committing.

---

## 2. Initial Repository State and Baseline

Before executing Phase B2, Gate 0 verified:

- **Active Branch:** `main`
- **Local HEAD:** `92f39109f0e97d2058a619e512bf3d706c3f4da0` (6 commits ahead of upstream).
- **Upstream Baseline:** `refs/remotes/origin/main` at `1db80b4f1ebf20848664eb0cb8eadf8f565cc485` (tag: `v0.1.1`).
- **Working Tree State:** All 7 package manifests bumped to `0.1.2`, clean changesets consumed.
- **Preflight Git Check:** `git diff --check` reported zero conflict markers.

---

## 3. Release Candidate Validation (Gate 1)

All verification suites were re-executed against the candidate tree:

| Verification Suite              | Target                            |  Result  | Evidence / Exit Code                                     |
| :------------------------------ | :-------------------------------- | :------: | :------------------------------------------------------- |
| **Lint**                        | Full workspace                    | **PASS** | Exit code 0 (0 errors, 0 warnings).                      |
| **Typecheck**                   | 8 TypeScript composite projects   | **PASS** | Exit code 0 (`pnpm -r exec tsc --noEmit`).               |
| **Monorepo Tests**              | 56 test files, 439 tests          | **PASS** | Exit code 0 (56/56 suites passed, 439/439 tests passed). |
| **Production Build**            | `tsc -b` + `tsup 9.0.0`           | **PASS** | Exit code 0 (Strategy D CLI bundled).                    |
| **Production Dependency Audit** | Production tree                   | **PASS** | Exit code 0 (0 vulnerabilities, Zod CVE resolved).       |
| **Clean-Install Harness**       | `scripts/verify-clean-install.sh` | **PASS** | All 7 sandbox phases passed cleanly.                     |
| **Publication Dry-Run**         | All 7 packages                    | **PASS** | Simulated publication succeeded for all 7 packages.      |

---

## 4. Release Commit (Gate 2)

All 92 modified, added, and generated release files were explicitly staged and audited. Zero credentials, environment variables, or temporary build artifacts were included.

- **Commit Command:** `git commit -m "chore(release): AOE v0.1.2 production release"`
- **Release Commit SHA:** `5e98b3f73067215fa4a223fd86b1be4151e491f9`
- **Working Tree Cleanliness:** `git status --short` verified 100% clean after commit.

---

## 5. Push Release Commit (Gate 3)

Remote upstream `origin/main` was checked via `git fetch origin main` and confirmed at `1db80b4f1ebf20848664eb0cb8eadf8f565cc485`.

- **Push Command:** `git push origin main`
- **Push Output:** `1db80b4..5e98b3f main -> main`
- **Remote `origin/main` Verification:** Resolves to `5e98b3f73067215fa4a223fd86b1be4151e491f9`.

---

## 6. Annotated Tag Creation & Push (Gate 4)

- **Tag Command:** `git tag -a v0.1.2 -m "AOE v0.1.2"`
- **Local Tag Resolution:** `git rev-parse v0.1.2^{}` $\rightarrow$ `5e98b3f73067215fa4a223fd86b1be4151e491f9`
- **Push Command:** `git push origin v0.1.2`
- **Remote Tag Verification:** `git ls-remote origin refs/tags/v0.1.2*`
  ```text
  06729fb6ab24953cbc888643cc8024d4317102fa  refs/tags/v0.1.2
  5e98b3f73067215fa4a223fd86b1be4151e491f9  refs/tags/v0.1.2^{}
  ```

---

## 7. GitHub Actions OIDC Publication Workflow (Gate 5)

The tag push triggered GitHub Actions workflow [.github/workflows/release.yml](file:///home/zyan/Projects/aoe/.github/workflows/release.yml).

- **Workflow Name:** `Release`
- **Workflow File:** `.github/workflows/release.yml`
- **Triggering Ref:** `refs/tags/v0.1.2`
- **Commit SHA:** `5e98b3f73067215fa4a223fd86b1be4151e491f9`
- **Run ID:** `41989386834`
- **Run URL:** [https://github.com/zulian026/aoe/actions/runs/41989386834](https://github.com/zulian026/aoe/actions/runs/41989386834)
- **Execution Result:** **FAILURE** (Step: `Install pnpm`, elapsed 13s)

### Root Cause Analysis

The workflow failed on step 2 (`Install pnpm`) using action `pnpm/action-setup@v4`:

```text
2026-11-05T07:44:58.3178489Z ##[error]Error: Multiple versions of pnpm specified:
  - version 9 in the GitHub Action config with the key "version"
  - version pnpm@9.15.9 in the package.json with the key "packageManager"
Remove one of these versions to avoid version mismatch errors like ERR_PNPM_BAD_PM_VERSION
```

**Mechanism:**
`package.json` declares `"packageManager": "pnpm@9.15.9"`. When `pnpm/action-setup@v4` runs with `version: 9` explicitly declared in `with:`, it strictly fails to prevent ambiguous version resolution.

---

## 8. Seven-Package npm Publication Matrix

Because the release pipeline halted at step 2 (`Install pnpm`), **zero packages reached the publish step**. All seven packages remain safely unmutated on the npm registry:

|  #  | Package Name          | npm Registry Link                                                                  | Target Version | Published Versions on Registry | Publication Status |
| :-: | :-------------------- | :--------------------------------------------------------------------------------- | :------------: | :----------------------------- | :----------------: |
|  1  | `@zyanx04/protocol`   | [npmjs.com/@zyanx04/protocol](https://www.npmjs.com/package/@zyanx04/protocol)     |    `0.1.2`     | `0.0.0-stage`, `0.1.1`         | **NOT PUBLISHED**  |
|  2  | `@zyanx04/themes`     | [npmjs.com/@zyanx04/themes](https://www.npmjs.com/package/@zyanx04/themes)         |    `0.1.2`     | `0.0.0-stage`, `0.1.1`         | **NOT PUBLISHED**  |
|  3  | `@zyanx04/core`       | [npmjs.com/@zyanx04/core](https://www.npmjs.com/package/@zyanx04/core)             |    `0.1.2`     | `0.0.0-stage`, `0.1.1`         | **NOT PUBLISHED**  |
|  4  | `@zyanx04/components` | [npmjs.com/@zyanx04/components](https://www.npmjs.com/package/@zyanx04/components) |    `0.1.2`     | `0.0.0-stage`, `0.1.1`         | **NOT PUBLISHED**  |
|  5  | `@zyanx04/adapters`   | [npmjs.com/@zyanx04/adapters](https://www.npmjs.com/package/@zyanx04/adapters)     |    `0.1.2`     | `0.0.0-stage`, `0.1.1`         | **NOT PUBLISHED**  |
|  6  | `@zyanx04/renderer`   | [npmjs.com/@zyanx04/renderer](https://www.npmjs.com/package/@zyanx04/renderer)     |    `0.1.2`     | `0.0.0-stage`, `0.1.1`         | **NOT PUBLISHED**  |
|  7  | `@zyanx04/cli`        | [npmjs.com/@zyanx04/cli](https://www.npmjs.com/package/@zyanx04/cli)               |    `0.1.2`     | `0.0.0-stage`, `0.1.1`         | **NOT PUBLISHED**  |

---

## 9. OIDC Attestation & GitHub Release Status

- **OIDC Authentication:** UNVERIFIED (workflow did not reach publish step).
- **Provenance Attestations:** UNVERIFIED (no packages published).
- **GitHub Release `v0.1.2`:** NOT CREATED (draft release step was not reached).
- **Existing `v0.1.1` Release & Assets:** **VERIFIED INTACT** (no alterations or overwrites).

---

## 10. Cryptographic Checksums (Staged Artifacts)

The pre-release artifacts staged in `release-artifacts/` remain validated:

```text
b6fc808d7a56c7146bfc79ce5297ce015d307518bc217cb4fd170c8a481aceff  zyanx04-adapters-0.1.2.tgz
8705026c6c6b82688655909178396f14d130befc18e93ea0dfdf936dc1a1c657  zyanx04-cli-0.1.2.tgz
daf161c052057098e3eede24e1ddedc383d81b92d662c3d0ce625b111fd53ed0  zyanx04-components-0.1.2.tgz
60aad7713dfe6c7db84382843f59b5a458eca7d8f2667e87fdf90e18be921fcc  zyanx04-core-0.1.2.tgz
c7946fb4e2a4f6c7e17ba01c4b820b0a11d2887f9d49e7a0c3d8d416974f7f55  zyanx04-protocol-0.1.2.tgz
a411b2d125383cddf57383efb550dc8b1130db93d5d11653462733abbbd2bca8  zyanx04-renderer-0.1.2.tgz
2c0cfdd1923a5f3cdf47f864d59e6a0a4b37a9d85c0064c3d0c5f09bde3c4b62  zyanx04-themes-0.1.2.tgz
```

---

## 11. Safety Audit & Remediation Plan

### Safety Assessment

Because the pipeline failed early at `Install pnpm`:

1. **Zero partial publication risk:** No package was published to npm. The version `0.1.2` has **not** been consumed on npm.
2. **Zero credential exposure:** No OIDC token or registry handshake occurred.
3. **Immutability preserved:** There is no need to bump versions to `0.1.3`. Version `0.1.2` remains completely valid for publication once the workflow configuration is adjusted.

### Precise Remediation Step

In `.github/workflows/release.yml`, lines 24–27:

```yaml
# CURRENT (FAILS due to packageManager conflict):
- name: Install pnpm
  uses: pnpm/action-setup@v4
  with:
    version: 9

# REMEDIATION (pnpm/action-setup reads packageManager automatically):
- name: Install pnpm
  uses: pnpm/action-setup@v4
```

### Recovery Procedure

1. Edit `.github/workflows/release.yml` to remove `with.version: 9`.
2. Commit the fix: `fix(ci): remove redundant pnpm action version to defer to packageManager`.
3. Push to `main`.
4. Delete and re-create tag `v0.1.2` pointing to the remediated commit, then push `v0.1.2` to re-trigger the release workflow.
5. Monitor workflow run until full completion.

---

## 12. Final Status Assessment

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MILESTONE M07.5 DECISION                        │
├────────────────────────────────────────────────────────────────────────┤
│  STATUS: FAILED                                                        │
│  ────────────────────────────────────────────────────────────────────  │
│  - Git commit 5e98b3f created and pushed to origin/main (PASS)        │
│  - Annotated tag v0.1.2 created and pushed (PASS)                     │
│  - GitHub Actions run 41989386834 triggered (PASS)                    │
│  - Step 'Install pnpm' failed due to pnpm/action-setup v4 error (FAIL) │
│  - npm registry state untouched (0/7 packages published) (SAFE)        │
│  - v0.1.1 release and assets preserved (PASS)                         │
└────────────────────────────────────────────────────────────────────────┘
```
