# M07 — Pre-Authorization Final Release Safety Check

**Milestone:** M07 — First Controlled Public Release v0.1.2  
**Project:** AOE (Agent Output Enhancement)  
**Repository:** [https://github.com/zulian026/aoe.git](https://github.com/zulian026/aoe.git)  
**Workspace Root:** `/home/zyan/Projects/aoe`  
**Date:** 2026-11-05  
**Auditor:** Senior Release Engineer, DevOps Engineer & Software Supply Chain Security Auditor  
**Final Pre-Authorization Status:** **HOLD** (Awaiting Human Authorization & External Configuration)

---

## 1. Verified Facts & Repository Baseline

This report documents the final pre-authorization safety verification prior to the public release of **AOE v0.1.2**.

### 1.1 Git Tracking & Commit Delta

- **Current Branch:** `main`
- **Local HEAD Commit:** `92f39109f0e97d2058a619e512bf3d706c3f4da0` (`docs(audit): AOE sidecar live UX validation and reliability audit (M05.3)`)
- **Remote Ref:** `origin/main` is at commit `1db80b4f1ebf20848664eb0cb8eadf8f565cc485`.
- **Commits Ahead:** Exactly 6 commits ahead of `origin/main`:
  1. `40059e9` — `feat(adapters): implement Antigravity adapter and hook bridge (M04)`
  2. `09d3799` — `feat(adapters): stateful hook infrastructure and reliability hardening (M04.2)`
  3. `d2eee36` — `docs(audit): Antigravity live desktop integration verification report (M04.3)`
  4. `a6e7429` — `feat(core): stateful sidecar consumer foundation and read model (M05.1)`
  5. `0cdf582` — `feat(renderer): terminal sidecar presentation layer with ink and react (M05.2)`
  6. `92f3910` — `docs(audit): AOE sidecar live UX validation and reliability audit (M05.3)`

### 1.2 Remote Registry & Release Baseline

- **Existing Git Tags:** `v0.1.0`, `v0.1.1`
- **Existing GitHub Releases:** `v0.1.1` (Latest), `v0.1.0` (Draft)
- **Remote npm Registry Versions:** All seven packages (`@zyanx04/{cli,protocol,themes,core,components,adapters,renderer}`) are currently published at version `0.1.1`.
- **Target Version:** `0.1.2` across all seven packages.

---

## 2. Trusted Publisher Readiness Checklist

> [!WARNING]
> **Status: UNVERIFIED (External Registry Setting)**  
> The local development environment cannot verify account settings on `npmjs.com`. Maintainer manual verification is mandatory before triggering the release workflow.

### 2.1 Seven-Package Configuration Matrix

Every package in the monorepo must have an active Trusted Publisher configured in its npm access settings:

| #   | Package Name          | npm Access Settings URL                                                           | Required Provider | Required Repository | Required Workflow | Required Environment | Status     |
| --- | --------------------- | --------------------------------------------------------------------------------- | ----------------- | ------------------- | ----------------- | -------------------- | ---------- |
| 1   | `@zyanx04/cli`        | [npm/cli/access](https://www.npmjs.com/package/@zyanx04/cli/access)               | `GitHub Actions`  | `zulian026/aoe`     | `release.yml`     | _(leave blank)_      | UNVERIFIED |
| 2   | `@zyanx04/protocol`   | [npm/protocol/access](https://www.npmjs.com/package/@zyanx04/protocol/access)     | `GitHub Actions`  | `zulian026/aoe`     | `release.yml`     | _(leave blank)_      | UNVERIFIED |
| 3   | `@zyanx04/themes`     | [npm/themes/access](https://www.npmjs.com/package/@zyanx04/themes/access)         | `GitHub Actions`  | `zulian026/aoe`     | `release.yml`     | _(leave blank)_      | UNVERIFIED |
| 4   | `@zyanx04/core`       | [npm/core/access](https://www.npmjs.com/package/@zyanx04/core/access)             | `GitHub Actions`  | `zulian026/aoe`     | `release.yml`     | _(leave blank)_      | UNVERIFIED |
| 5   | `@zyanx04/components` | [npm/components/access](https://www.npmjs.com/package/@zyanx04/components/access) | `GitHub Actions`  | `zulian026/aoe`     | `release.yml`     | _(leave blank)_      | UNVERIFIED |
| 6   | `@zyanx04/adapters`   | [npm/adapters/access](https://www.npmjs.com/package/@zyanx04/adapters/access)     | `GitHub Actions`  | `zulian026/aoe`     | `release.yml`     | _(leave blank)_      | UNVERIFIED |
| 7   | `@zyanx04/renderer`   | [npm/renderer/access](https://www.npmjs.com/package/@zyanx04/renderer/access)     | `GitHub Actions`  | `zulian026/aoe`     | `release.yml`     | _(leave blank)_      | UNVERIFIED |

### 2.2 Distinguishing OIDC Readiness from NPM_TOKEN Fallback Readiness

| Dimension             | Mode A: Pure OIDC Trusted Publishing                                                                                  | Mode B: Token Fallback                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Mechanism**         | Keyless OpenID Connect via GitHub Actions OIDC provider (`audience: npm:registry`). Ephemeral 15-minute write tokens. | Static bearer token injected via `NODE_AUTH_TOKEN`.                                                                         |
| **Prerequisites**     | All 7 packages must have Trusted Publishers configured on `npmjs.com` as tabulated above.                             | `secrets.NPM_TOKEN` must be populated in repository secrets at `https://github.com/zulian026/aoe/settings/secrets/actions`. |
| **Workflow Step**     | `Publish to npm (OIDC Trusted Publishing)` (`if: env.NPM_TOKEN == ''`).                                               | `Publish to npm (Token Fallback)` (`if: env.NPM_TOKEN != ''`).                                                              |
| **Failure Mode**      | If any of the 7 packages lacks a Trusted Publisher entry on npmjs.com, that package fails with `ENEEDAUTH` or `E404`. | If the static token expires or lacks write scope, publication fails.                                                        |
| **Current Readiness** | **UNVERIFIED** (Pending maintainer check of npmjs.com).                                                               | **AVAILABLE AS FALLBACK** (If maintainer adds `NPM_TOKEN`).                                                                 |

---

## 3. Git Release Scope Audit

An exhaustive audit of the working tree was performed to ensure that only intended, production-grade files enter the release commit.

### 3.1 Inventory of Changes to Enter the Release Commit

1. **Production Packaging & Bundling (Strategy D):**
   - `apps/cli/tsup.config.ts`: tsup 9 bundler configuration bundling internal packages into `@zyanx04/cli`.
   - `apps/cli/package.json`: Stripped internal workspace dependencies from runtime `dependencies`.
   - `package.json`: Locked `"packageManager": "pnpm@9.15.9"`.
   - `tsconfig.build.base.json`, `tsconfig.build.json`, `packages/*/tsconfig.build.json`: Project references for clean isolated DTS emission.
   - `apps/cli/LICENSE`, `packages/*/LICENSE`: Added root MIT license files into each package root.

2. **Supply Chain Security Remediation:**
   - Upgraded Zod to `^4.6.7` across the monorepo, remediating High advisory `GHSA-mrhx-c7xc-m3w5`.
   - Converted 12 occurrences of single-argument `z.record(z.unknown())` to explicit `z.record(z.string(), z.unknown())`.
   - Fixed index type safety in `packages/components/src/utils/theme-resolver.ts`.

3. **Release Pipeline Hardening:**
   - `.github/workflows/release.yml`: Pinned npm CLI `11.21.2`, concurrency controls, pre-publish tarball generation & checksumming, decoupled Mode A / Mode B publishing.

4. **Automated Verification Harness:**
   - `scripts/verify-clean-install.sh`: Multi-phase clean sandbox install harness.

5. **Milestone Documentation & Audit Evidence:**
   - Audits in `docs/audits/` (M06.1, M06.2).
   - Release reports in `docs/release/` (M06.3–M07).
   - Changeset definition in `.changeset/m06-production-packaging.md`.

### 3.2 Audit of Working Tree Hygiene

- **Leaked Test Files in Production Tarball:** **0** (Audited via `verify-clean-install.sh`).
- **Source Maps in Production Tarball:** **0** (`sourcemap: false` enforced).
- **Unrelated or Incomplete Changes:** **0**. All modifications strictly relate to M04–M07.
- **Integrity of User Code:** **100% Preserved**. No user modifications were reset or discarded.

---

## 4. Runtime Reproducibility & Toolchain Pinning

### 4.1 Resolution of the Floating `npm@latest` Risk

In the initial M06.5 draft, the workflow specified `npm install -g npm@latest`.  
**Critical Risk Identified:**  
On the npm registry, `npm@latest` may resolve to npm v12 (`npm 12.2.x`). The official package manifest for `npm@12` specifies:

```json
"engines": {
  "node": "^22.22.2 || ^24.15.0 || >=26.0.0"
}
```

If executed on a GitHub Actions runner running Node.js `20.x`, installing `npm@latest` would fail with `EBADENGINE` or cause an unstable runtime!

### 4.2 Exact Toolchain Pinning

[.github/workflows/release.yml](file:///home/zyan/Projects/aoe/.github/workflows/release.yml) has been updated to pin exact, tested versions:

- **Node.js:** `20.x` LTS (`actions/setup-node@v4`)
- **pnpm:** `9.15.9` (Locked via root `package.json` `"packageManager": "pnpm@9.15.9"`)
- **npm CLI:** `11.21.2` (`npm install -g npm@11.21.2`)
  - `npm@11.21.2` officially supports `"node": "^20.17.0 || >=22.9.0"`, providing 100% native compatibility with Node 20.x while fully supporting npm OIDC Trusted Publishing.

---

## 5. Publication Safety & Failure Recovery

### 5.1 Reordering of Release Artifacts & Checksums

In previous workflow iterations, release tarballs and SHA-256 checksums were generated _after_ the npm publication step. If tarball packing failed, packages were already published to npm, leaving the release in a broken state without tarballs or GitHub Release.

**Hardening Applied:**
The workflow sequence in [.github/workflows/release.yml](file:///home/zyan/Projects/aoe/.github/workflows/release.yml#L59-L87) now guarantees:

1. `Pack release tarballs` (`pnpm -r exec pnpm pack ...`)
2. `Generate release checksums` (`sha256sum *.tgz > SHA256SUMS`)
3. `Upload Release Artifacts` (`actions/upload-artifact@v4`)
4. **ONLY THEN** `Publish to npm` (Mode A or Mode B)
5. `Create GitHub Release (Draft)`

**Guarantee:** If any of the 7 packages fails to pack or fails checksum calculation, the pipeline halts immediately with non-zero exit code **BEFORE** any network upload to npm occurs.

### 5.2 Partial Publication Risk & Safe Recovery Procedure

#### The Risk:

`pnpm -r publish` publishes packages sequentially. If package 1 through 3 succeed, but package 4 fails (e.g., due to an unconfigured Trusted Publisher on npmjs.com), packages 1 through 3 are permanently published to npm at version `0.1.2` (npm registry versions are strictly immutable).

#### Safe Recovery Runbook:

1. **DO NOT attempt to delete or unpublish packages from npm.**
2. **DO NOT blindly force re-runs without identifying the failure root cause.**
3. **If the failure was caused by an unconfigured package on npmjs.com:**
   - Configure the missing Trusted Publisher on `npmjs.com/package/@zyanx04/<pkg>/access`.
   - Re-run the GitHub Actions release workflow.
   - `pnpm -r publish` detects that packages 1–3 already exist at version `0.1.2`, emits a `[WARN] Skip publishing ... (already published)`, and proceeds to publish packages 4–7.
4. **If the failure is due to an unrecoverable code or packaging defect in package 4:**
   - Do not re-use tag `v0.1.2`.
   - Create a new changeset for a patch bump to `v0.1.3`.
   - Apply `pnpm changeset version`, commit, push to `main`, and tag `v0.1.3`.

---

## 6. Outstanding Risks

1. **External npm Settings:** The release workflow will fail at the publication step if the maintainer has not yet added `release.yml` as a Trusted Publisher across all 7 packages on `npmjs.com`.
2. **Immutability of Version 0.1.2:** Once published, version `0.1.2` cannot be retracted or overwritten.

---

## 7. Final Recommendation: HOLD

### Recommendation: **HOLD**

The local codebase, packaging architecture, regression tests (439/439 passed), clean-install verification harness (7/7 phases passed), and hardened GitHub Actions workflow are 100% verified and ready.

However, execution must remain on **HOLD** until the repository maintainer:

1. Confirms that all 7 packages have Trusted Publishers configured on `npmjs.com` (or that `NPM_TOKEN` is configured in GitHub repository secrets).
2. Explicitly authorizes proceeding to **Phase B (Controlled Release)**.
