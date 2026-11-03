# RV01.7 — Release Workflow Safety Audit Report

**Milestone / Phase:** Release Verification RV01.7  
**Package / Version:** AOE (Agent Output Enhancement) v0.1.0  
**Audit Date:** 2026-11-03  
**Auditor:** Senior Release Engineer & DevSecOps Architect  
**Classification:** **VERIFIED & SECURE** (Zero automatic publishing, human approval gated, no secrets exposed)

---

## 1. Executive Summary

This report provides the release automation and security audit of `.github/workflows/release.yml` prior to the public launch of AOE v0.1.0.

A release workflow must satisfy four critical safety invariants:

1. **Zero Automatic Publishing**: No automated task may publish packages to public npm registries (`registry.npmjs.org`) without explicit human intervention and credential provisioning.
2. **Mandatory Quality Gates**: No artifacts may be generated if any unit test, typecheck, or build step fails.
3. **Draft-Only Releases**: GitHub Releases must be created strictly as `draft: true`, requiring manual maintainer inspection and publication approval in the web UI.
4. **Zero Credential Exposure**: No secrets or publishing tokens may be hardcoded, echoed in logs, or passed to untrusted actions.

The release workflow was verified against all four invariants.

---

## 2. Release Workflow Invariant Audit

| Invariant                      | Audit Criteria                                                 | Implementation in `release.yml`                                                    | Status   |
| ------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------- |
| **Gate 1: Trigger Constraint** | Workflow only triggers on explicit version tags                | `on.push.tags: ['v*.*.*']` (never runs on regular branch pushes or PRs)            | **PASS** |
| **Gate 2: Build & Test Gates** | Complete compilation and test suite must pass before packaging | `pnpm build`, `pnpm typecheck`, `pnpm test` executed sequentially                  | **PASS** |
| **Gate 3: Artifact Checksums** | Deterministic SHA256 checksums generated for all packages      | `sha256sum *.tgz > SHA256SUMS` executed against all 7 workspace packages           | **PASS** |
| **Gate 4: Draft-Only Release** | Release is created in draft mode requiring human approval      | `draft: true` enforced on `softprops/action-gh-release@v2`                         | **PASS** |
| **Gate 5: No Auto-Publish**    | No automated `npm publish` or registry upload                  | **Zero** `npm publish` / `pnpm publish` commands exist in the workflow             | **PASS** |
| **Gate 6: Secret Isolation**   | No npm auth tokens or sensitive keys exposed                   | `NPM_TOKEN` is not referenced or required; permissions scoped to `contents: write` | **PASS** |

---

## 3. Code Inspection of `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  release:
    name: Package and Verify Release Artifacts
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Set up Node.js 20.x
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build monorepo
        run: pnpm build

      - name: Run typecheck
        run: pnpm typecheck

      - name: Run tests
        run: pnpm test

      - name: Pack release tarballs
        run: |
          mkdir -p release-artifacts
          pnpm -r exec pnpm pack --pack-destination "$GITHUB_WORKSPACE/release-artifacts"

      - name: Generate release checksums
        run: |
          cd release-artifacts
          sha256sum *.tgz > SHA256SUMS

      - name: Upload Release Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: aoe-release-artifacts
          path: release-artifacts/

      - name: Create GitHub Release (Draft)
        uses: softprops/action-gh-release@v2
        if: startsWith(github.ref, 'refs/tags/')
        with:
          draft: true
          files: |
            release-artifacts/*.tgz
            release-artifacts/SHA256SUMS
          body_path: CHANGELOG.md
```

---

## 4. Safety Mechanisms & Publish Gating

### 4.1 Protection Against Accidental Registry Publication

In many monorepos, automated CI workflows immediately execute `pnpm publish -r --access public` upon tag creation. This introduces catastrophic risks if a tag is created accidentally or if supply-chain flaws exist.

In AOE:

- The release workflow only compiles tarballs (`.tgz`), calculates cryptographic checksums (`SHA256SUMS`), uploads them as GitHub Actions job artifacts, and attaches them to a **Draft Release**.
- Publishing to npm remains a manual maintainer responsibility following the verification protocol documented in `docs/release/RV01_DISTRIBUTION_AUDIT.md`.

### 4.2 Minimum Privilege Permissions

The workflow defines minimal GitHub token permissions:

```yaml
permissions:
  contents: write
```

This is the absolute minimum permission required by GitHub Actions to attach release assets to a draft release in the repository.

---

## 5. Conclusion

The release automation workflow `.github/workflows/release.yml` complies with all release safety standards. It provides automated build verification, cryptographic integrity checking, and drafting without premature publication.

Release safety status: **APPROVED FOR RELEASE**.
