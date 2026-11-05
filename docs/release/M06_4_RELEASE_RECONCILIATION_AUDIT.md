# M06.4 — AOE Release Pipeline & State Reconciliation Audit Report

## Document Metadata

- **Project**: AOE — Agent Output Enhancement
- **Milestone**: M06.4 — Release Pipeline Reconciliation & Security Remediation
- **Author**: Senior Release Engineer & Software Supply Chain Security Engineer
- **Repository**: `https://github.com/zulian026/aoe.git`
- **Workspace**: `/home/zyan/Projects/aoe`
- **Date**: 2026-11-05
- **Status**: AUDITED & RECONCILED

---

## 1. Executive Summary

Milestone **M06.4** reconciled critical ambiguities identified during M06.3 regarding the publication state of AOE, audited the automated publication pipeline in GitHub Actions, and established an authoritative release-state baseline.

Prior documentation contained apparent contradictions: M06.3 stated that _"AOE remains unpublished"_, yet public npm registry records and GitHub releases clearly showed version `0.1.1` actively available. This audit resolves this discrepancy through definitive, artifact-level evidence.

### Summary of Authoritative Determinations

1. **Release State Truth**:
   - **AOE v0.1.1 IS published on npm** and is **published on GitHub Releases**.
   - However, published v0.1.1 contains the **legacy, unbundled, flawed distribution architecture** (155 files, 462 kB unpacked, unbundled dependencies, broken 404 repository URLs).
   - The **new, hardened, hybrid bundled distribution architecture (M04 Antigravity adapter, M05 Sidecar UI, M06.2 bundled CLI packaging)** exists ONLY at local HEAD `92f3910` and has **NEVER been published or tagged**.
   - Describing AOE as "unpublished" in M06.3 was semantically imprecise; it meant that the _new code_ was unreleased.
2. **npm Immutability Constraint**:
   - Because npm versions are permanently immutable, version `0.1.1` cannot be overwritten with the new bundled code.
   - The new distribution architecture MUST be released as **v0.1.2** (or `v0.2.0`).
3. **GitHub Actions Publication Gap Identified & Fixed**:
   - `.github/workflows/release.yml` was previously missing the actual publication command (`pnpm publish`). It only packed tarballs and created a draft GitHub release.
   - Implemented a narrowly scoped correction adding `pnpm -r publish --access public --provenance --no-git-checks` gated behind the full regression and clean-install verification harness.
4. **Trusted Publishing Scope Clarified**:
   - Evaluated CLI-only publication versus seven-package monorepo publication.
   - Identified the exact trust configurations required on `npmjs.com` for OpenID Connect (OIDC) provenance.

---

## 2. Release State Reconciliation Matrix

The table below reconciles all local and remote release vectors:

| Release Vector                 | Version `0.1.0`            | Version `0.1.1`                                  | Proposed `0.1.2` (Local HEAD)                          | Verification Evidence                                          |
| :----------------------------- | :------------------------- | :----------------------------------------------- | :----------------------------------------------------- | :------------------------------------------------------------- |
| **npm Registry**               | `0.0.0-stage` (prerelease) | **PUBLISHED** (`2026-11-04T07:54:27Z`)           | **NOT PUBLISHED**                                      | `npm view @zyanx04/cli versions` -> `['0.0.0-stage', '0.1.1']` |
| **Artifact Architecture**      | Initial prototype          | **LEGACY UNBUNDLED** (155 files, unbundled deps) | **HYBRID BUNDLED (Strategy D)** (23 files, zero leaks) | Tarball manifest comparison: 155 files vs 23 files             |
| **Git Tag**                    | `v0.1.0` (`9acab1f`)       | **TAGGED** (`1db80b4`)                           | **NOT TAGGED** (HEAD is `92f3910`)                     | `git show-ref --tags`                                          |
| **GitHub Releases**            | Draft Release              | **PUBLISHED (Latest)**                           | **NONE**                                               | `gh release list` -> `v0.1.1 Latest`                           |
| **Repository URL in Manifest** | `aoe-dev/aoe` (HTTP 404)   | `aoe-dev/aoe` (HTTP 404)                         | **`zulian026/aoe` (HTTP 200)**                         | `package.json` inspection & `curl -sI`                         |
| **Zod Dependency**             | `^3.24.2` (Vulnerable)     | `^3.24.2` (Vulnerable)                           | **`^4.6.7` (Remediated)**                              | `pnpm audit --prod` -> 0 vulnerabilities                       |
| **Sidecar & Antigravity**      | Not present                | Not present                                      | **FULLY INTEGRATED** (M04–M05.3)                       | 56 test files, 439 tests passing                               |

### Authoritative Determination on M06.3 "Unpublished" Claim

M06.3 reported: _"AOE must remain unpublished at the end of M06.3"_ and _"AOE remains unpublished"_.

- **Intent of M06.3**: Enforced an operational constraint prohibiting the agent from publishing the newly developed code or mutating remote Git tags during that milestone.
- **Fact**: AOE v0.1.1 was already published on npm before M06.3 began.
- **Reconciliation Verdict**: The claim in M06.3 was semantically misleading when read literally. It correctly described the status of the _work-in-progress codebase at HEAD_, but failed to state clearly that a previous version (v0.1.1) was already live on npm with the old architecture. This milestone officially rectifies that record.

---

## 3. GitHub Actions Publication Workflow Audit

### 3.1 Initial Inspection of `.github/workflows/release.yml`

An audit of `.github/workflows/release.yml` at baseline revealed the following step sequence:

1. `actions/checkout@v4`
2. `pnpm/action-setup@v4`
3. `actions/setup-node@v4` (Node 20.x, cache pnpm, registry-url `https://registry.npmjs.org`)
4. `pnpm install --frozen-lockfile`
5. `pnpm build`
6. `pnpm typecheck`
7. `pnpm test`
8. `./scripts/verify-clean-install.sh`
9. `pnpm -r exec pnpm pack --pack-destination "$GITHUB_WORKSPACE/release-artifacts"`
10. `sha256sum *.tgz > SHA256SUMS`
11. `actions/upload-artifact@v4`
12. `softprops/action-gh-release@v2` (draft: true)

### 3.2 Finding: Missing Publication Command

Although `release.yml` declared:

```yaml
permissions:
  contents: write
  id-token: write
```

and configured `setup-node` with `registry-url: 'https://registry.npmjs.org'`, **there was no publication step**.

- The workflow generated tarballs and created a draft GitHub Release, but **did not push anything to the npm registry**.
- Presence of `id-token: write` alone does NOT publish packages without an explicit `npm publish` or `pnpm publish` command.

### 3.3 Implemented Narrowly Scoped Correction

To ensure future release tags trigger automated, provenance-backed publication, the workflow was updated with the following step immediately following `./scripts/verify-clean-install.sh`:

```yaml
- name: Verify Clean Installation
  run: ./scripts/verify-clean-install.sh

- name: Publish to npm
  run: pnpm -r publish --access public --provenance --no-git-checks
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

- name: Pack release tarballs
```

- **Gating**: Publication executes ONLY if clean-install verification, test suites, and typechecks pass 100%.
- **Provenance**: `--provenance` instructs `pnpm` to request an OIDC token and generate a SLSA provenance attestation via Sigstore.
- **Authentication**: Supports both OIDC Trusted Publishing (via `id-token: write`) and classic automation tokens (via `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`).
- **Safety**: Runs strictly on `push: tags: ['v*.*.*']`. Because no tags are pushed in M06.4, remote CI remains dormant until authorized.

---

## 4. Trusted Publishing (OIDC) Validation & Scope Analysis

### 4.1 OIDC Mechanics

When `pnpm publish --provenance` runs inside GitHub Actions:

1. GitHub mints a cryptographically signed OIDC JWT token for audience `npm:registry`.
2. The JWT contains claims:
   - `repository`: `zulian026/aoe`
   - `workflow`: `.github/workflows/release.yml`
   - `ref`: `refs/tags/v0.1.2`
   - `sha`: `<commit-sha>`
3. npm verifies this token against the Trusted Publisher configuration for the target package.

### 4.2 Scope Distinction: CLI-Only vs Seven Monorepo Packages

| Model                                                 | Description                                                                         | Pros                                                                                                                       | Cons                                                                                                     | npm Configuration Required                                            |
| :---------------------------------------------------- | :---------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| **Option A: CLI-Only Publication**                    | Publish only `@zyanx04/cli`. Mark remaining 6 workspace packages `"private": true`. | Simplest operation. Only 1 package requires registry trust. Users only need `@zyanx04/cli`.                                | Third-party developers cannot import `@zyanx04/protocol` or `@zyanx04/core` as standalone npm libraries. | 1 Trusted Publisher registration on `npmjs.com/package/@zyanx04/cli`. |
| **Option B: Full Monorepo Publication (Recommended)** | Publish all 7 packages under `@zyanx04/*` atomically. CLI remains hybrid-bundled.   | Full ecosystem support. Developers can build custom adapters using `@zyanx04/protocol`. Preserves consistency with v0.1.1. | Requires configuring Trusted Publisher across all 7 packages on `npmjs.com`.                             | 7 Trusted Publisher registrations on `npmjs.com`.                     |

### 4.3 Exact Required Registration Parameters on npmjs.com

For each package (`@zyanx04/cli`, `@zyanx04/protocol`, `@zyanx04/themes`, `@zyanx04/core`, `@zyanx04/components`, `@zyanx04/adapters`, `@zyanx04/renderer`):

- **Target URL**: `https://www.npmjs.com/package/@zyanx04/<pkg>/access`
- **Publisher Type**: `GitHub Actions`
- **GitHub Organization or User**: `zulian026`
- **Repository**: `aoe`
- **Workflow Filename**: `release.yml`
- **Environment**: _(Empty / none)_

---

## 5. Conclusion & Forward Path

The release state is now 100% reconciled:

1. Version `0.1.1` on npm is recognized as legacy unbundled code.
2. Version `0.1.2` is staged locally in Changesets and will be the first release featuring the hybrid bundled distribution architecture, Antigravity adapter, and Sidecar presentation layer.
3. The release workflow is formally corrected to publish to npm with provenance.
