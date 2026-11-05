# AOE Production npm Release Checklist

This document is the mandatory pre-flight and release execution checklist for publishing `@zyanx04/cli` and associated workspace packages to the public npm registry.

---

## Phase 1: Pre-Flight Monorepo Verification (Local Environment)

Execute from repo root (`/home/zyan/Projects/aoe`):

- [ ] **1.1 Git Working Tree & Branch Integrity**:
  ```bash
  git status
  git branch --show-current # Must be 'main'
  ```
- [ ] **1.2 Clean Monorepo Build**:
  ```bash
  pnpm clean
  pnpm build
  ```
- [ ] **1.3 Static Type Checking**:
  ```bash
  pnpm typecheck # Must pass with 0 errors
  ```
- [ ] **1.4 Full Regression Test Suite**:
  ```bash
  pnpm test # Must pass 56/56 test files, 439/439 tests
  ```
- [ ] **1.5 Linting & Formatting Standards**:
  ```bash
  pnpm lint # 0 ESLint errors
  pnpm format:check # Prettier code style confirmed
  ```
- [ ] **1.6 Automated Clean-Install Verification**:
  ```bash
  ./scripts/verify-clean-install.sh
  # Verifies 7 phases: clean build, npm pack, file whitelist audit (23 files),
  # clean sandbox installation, CLI commands, stdin streaming, and Sidecar IPC.
  ```
- [ ] **1.7 Production Tarball Content Audit**:
  ```bash
  cd apps/cli && npm pack --dry-run
  # Must contain exactly 23 approved production files:
  # - LICENSE
  # - README.md
  # - package.json
  # - 5 dist/ files (dist/bin.js, dist/bin.d.ts, dist/index.js, dist/index.d.ts, dist/chunk-*.js)
  # - 15 skills/ files
  # Zero test files, sourcemaps, or .tsbuildinfo files.
  ```
- [ ] **1.8 Zero Workspace Runtime Leak Verification**:
  ```bash
  node -e "const p = require('./apps/cli/package.json'); const leaks = Object.entries(p.dependencies).filter(([k, v]) => v.includes('workspace:') || k.startsWith('@zyanx04/')); if (leaks.length > 0) { console.error('LEAK DETECTED:', leaks); process.exit(1); } else { console.log('Zero workspace leaks in runtime dependencies.'); }"
  ```
- [ ] **1.9 Package Metadata Validation**:
  - `repository.url` points to `https://github.com/zulian026/aoe.git`
  - `homepage` points to `https://github.com/zulian026/aoe#readme`
  - `bugs` points to `https://github.com/zulian026/aoe/issues`
  - `publishConfig.access` is `"public"`

---

## Phase 2: External npm Trusted Publishing Setup (One-Time Manual Prerequisite)

> [!IMPORTANT]
> npm Trusted Publishing (OIDC) requires an explicit trust relationship established between npm and GitHub Actions. This cannot be completed via CLI without manual administrative authorization.

Log in to [npmjs.com](https://www.npmjs.com) using the owner account `zyanx04`:

- [ ] **2.1 Navigate to Package Settings**:
  - Open `https://www.npmjs.com/package/@zyanx04/cli/access`
- [ ] **2.2 Add GitHub Actions as Trusted Publisher**:
  - Under **Publishing Access**, click **Add trusted publisher**.
  - Select **GitHub Actions**.
  - Configure the trust parameters:
    - **GitHub organization or user**: `zulian026`
    - **Repository name**: `aoe`
    - **Workflow filename**: `release.yml`
    - **Environment**: _(Leave blank unless a GitHub Actions environment is configured)_
- [ ] **2.3 Repeat for Monorepo Library Packages (if distributing libraries)**:
  - Configure Trusted Publisher access for `@zyanx04/protocol`, `@zyanx04/themes`, `@zyanx04/core`, `@zyanx04/components`, `@zyanx04/adapters`, `@zyanx04/renderer`.
- [ ] **2.4 Verify npm Provenance Compatibility**:
  - Ensure 2FA is active on the owner account.
  - Verify that the `repository` field in each package matches `zulian026/aoe`.

---

## Phase 3: Release Versioning & Tagging

Execute only when publication has been explicitly authorized:

- [ ] **3.1 Confirm Pending Changeset**:
  ```bash
  pnpm changeset status
  # Verify .changeset/m06-production-packaging.md is staged
  ```
- [ ] **3.2 Bump Monorepo Versions**:
  ```bash
  pnpm changeset version
  # Atomically bumps all 7 packages (e.g. 0.1.1 -> 0.1.2)
  ```
- [ ] **3.3 Update Lockfile & Synchronize Dependencies**:
  ```bash
  pnpm install --no-frozen-lockfile
  ```
- [ ] **3.4 Commit Release Bumps**:
  ```bash
  git add .
  git commit -m "chore(release): bump package versions for production release"
  ```
- [ ] **3.5 Create Git Release Tag**:
  ```bash
  git tag -a v0.1.2 -m "Release v0.1.2 — Hybrid Bundled CLI & Antigravity Hardening"
  ```
- [ ] **3.6 Push Commit and Tag to Remote**:
  ```bash
  git push origin main
  git push origin v0.1.2
  ```

---

## Phase 4: CI/CD Pipeline Monitoring

- [ ] **4.1 Monitor GitHub Actions Workflow**:
  - Open `https://github.com/zulian026/aoe/actions/workflows/release.yml`
  - Ensure all release gating jobs pass:
    - Monorepo clean build
    - Typecheck & test suite
    - Clean-install verification harness
    - Tarball packaging & SHA256 checksums
    - Provenance signing & npm publication
    - GitHub Release draft creation

---

## Phase 5: Post-Publish Registry & Runtime Validation

- [ ] **5.1 Check npm Registry Version**:
  ```bash
  npm view @zyanx04/cli version # Must show new version (e.g. 0.1.2)
  ```
- [ ] **5.2 Inspect Published Tarball Manifest**:
  ```bash
  npm view @zyanx04/cli dist.tarball
  npm view @zyanx04/cli dist.fileCount # Must be 23
  ```
- [ ] **5.3 Verify OIDC Provenance on npmjs.com**:
  - Open `https://www.npmjs.com/package/@zyanx04/cli`
  - Verify the **"Provenance"** badge with green checkmark linking to the GitHub Actions workflow run.
- [ ] **5.4 Validate Global Installation via npx**:
  ```bash
  npx @zyanx04/cli@latest doctor --json
  # Must exit code 0 and emit valid diagnostic JSON
  ```
- [ ] **5.5 Validate Sidecar CLI Execution**:
  ```bash
  npx @zyanx04/cli@latest sidecar --help
  ```
- [ ] **5.6 Finalize GitHub Release**:
  - In `https://github.com/zulian026/aoe/releases`, edit the draft release.
  - Review release notes, attach checksums, and click **Publish Release**.
