# @zyanx04/core

## 0.1.2

### Patch Changes

- # Release Notes: Production Packaging, Sidecar UI, and Antigravity Adapter Hardening

  ### Summary of Notable Changes
  - **Hybrid Bundled CLI Architecture (Strategy D)**:
    - Bundled internal workspace packages into `@zyanx04/cli` distribution via `tsup 9.0.0`.
    - Packaged tarball reduced from 155 files to 23 clean production files (89.8 kB).
    - Packaged files include `LICENSE`, `README.md`, `package.json`, 5 bundled `dist/` files, and 15 portable `skills/` files.
    - Zero test files, sourcemaps, `.tsbuildinfo`, or workspace leaks.
  - **Antigravity Hook Bridge & Stateful Session Store**:
    - Stateful session tracking with atomic file locking and POSIX `0o600` permissions.
    - Real-environment verified Antigravity adapter translating agent lifecycle hooks to canonical AOE Protocol v1.0.0.
    - Safe Windows named pipe path discovery and fallback.
  - **Terminal Sidecar Presentation Layer**:
    - Independent sidecar process (`aoe sidecar`) powered by Ink, React, and Yoga Layout.
    - Live session header, current task panel, activity timeline, verification audit, and system diagnostics.
    - IPC server and client communication modes over Unix domain socket / named pipe.
  - **Automated Clean-Install Verification**:
    - Multi-phase verification test harness (`scripts/verify-clean-install.sh`) validating tarball extraction, zero-symlink execution, CLI commands, protocol stdin piping, and sidecar IPC communication.
  - **Supply Chain Security Remediation**:
    - Remediated High severity Zod advisory `GHSA-mrhx-c7xc-m3w5` by upgrading Zod to `^4.6.7` with explicit two-argument `z.record(z.string(), z.unknown())` schemas.
    - Verified 0 production vulnerabilities via `pnpm audit --prod`.
  - **Release Automation Pipeline Reconciliation**:
    - Integrated automated npm publication step (`pnpm -r publish --provenance`) into `.github/workflows/release.yml` gated behind clean-install verification.

- Updated dependencies
  - @zyanx04/protocol@0.1.2
