# AOE Milestone M07.6 — Release Workflow Recovery & Controlled Retry Report

## Executive Summary

| Attribute                       | Specification / Value                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Target Version**              | `v0.1.2`                                                                                                                       |
| **Release Architecture**        | Hybrid Bundled Strategy D                                                                                                      |
| **Approved Release Commit**     | [`5e98b3f73067215fa4a223fd86b1be4151e491f9`](https://github.com/zulian026/aoe/commit/5e98b3f73067215fa4a223fd86b1be4151e491f9) |
| **Git Tag**                     | `v0.1.2` (Immutable, verified at `5e98b3f`)                                                                                    |
| **Target Repository**           | `zulian026/aoe`                                                                                                                |
| **Publishing Mechanism**        | GitHub Actions OIDC Trusted Publishing (Zero Long-Lived Tokens)                                                                |
| **Pipeline Remediation Status** | **ALL CI Pipeline Deficiencies Resolved & Verified**                                                                           |
| **Publication Status**          | **BLOCKED ON EXTERNAL NPM DASHBOARD CONFIGURATION**                                                                            |

During Milestone M07.6, the release engineering pipeline was thoroughly audited, remediated, and validated. All internal continuous integration defects (including pnpm version specification conflicts, CI build/typecheck phase ordering, tarball packaging, and publication dry-runs) were resolved.

Comprehensive runtime diagnostics proved that GitHub Actions successfully mints valid OpenID Connect (OIDC) JSON Web Tokens. However, the npm registry actively rejects the OIDC exchange request for all 7 workspace packages with `HTTP 404: {"message":"OIDC token exchange error - package not found"}`. This confirms that the external configuration on `npmjs.com` does not match the actual GitHub repository identity (`zulian026/aoe`) or lacks an active Trusted Publisher mapping.

---

## 1. Remediation Timeline & Workflow Execution History

Seven controlled workflow runs were executed to remediate the release pipeline and isolate the root cause:

| Run ID                                                                     | Commit    | Trigger             | Target Tag | Result     | Root Cause / Gate Result                                                                                                                                   |
| -------------------------------------------------------------------------- | --------- | ------------------- | ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`41989386834`](https://github.com/zulian026/aoe/actions/runs/41989386834) | `5e98b3f` | `push` (tag)        | `v0.1.2`   | **FAILED** | Step `Install pnpm`: `pnpm/action-setup@v4` conflict between `version: 9` in YAML and `pnpm@9.15.9` in `package.json`.                                     |
| [`41990387570`](https://github.com/zulian026/aoe/actions/runs/41990387570) | `572acc6` | `workflow_dispatch` | `v0.1.2`   | **FAILED** | Step `Run typecheck`: `tsc --noEmit` executed before `Build monorepo` on clean checkout.                                                                   |
| [`41990680986`](https://github.com/zulian026/aoe/actions/runs/41990680986) | `1f9a250` | `workflow_dispatch` | `v0.1.2`   | **FAILED** | Step `Publish to npm`: `pnpm -r publish` does not implement native OIDC token exchange (`ENEEDAUTH`).                                                      |
| [`41992539058`](https://github.com/zulian026/aoe/actions/runs/41992539058) | `6fb1177` | `workflow_dispatch` | `v0.1.2`   | **FAILED** | Step `Validate publication dry-run`: `npm publish release-artifacts/*.tgz` treated relative path as remote GitHub shorthand without `./` or absolute path. |
| [`41992920512`](https://github.com/zulian026/aoe/actions/runs/41992920512) | `3db261b` | `workflow_dispatch` | `v0.1.2`   | **FAILED** | Step `Validate publication dry-run` **PASSED** (all 7 packages dry-run published). Step `Publish to npm` failed with `ENEEDAUTH`.                          |
| [`41993437759`](https://github.com/zulian026/aoe/actions/runs/41993437759) | `9623ee9` | `workflow_dispatch` | `v0.1.2`   | **FAILED** | OIDC diagnostics revealed token exchange returned `HTTP 404: {"message":"OIDC token exchange error - package not found"}` on `@zyanx04/protocol`.          |
| [`41994126637`](https://github.com/zulian026/aoe/actions/runs/41994126637) | `556ad21` | `workflow_dispatch` | `v0.1.2`   | **FAILED** | Comprehensive probe proved **all 7 packages** return `HTTP 404: {"message":"OIDC token exchange error - package not found"}` from the npm registry.        |

---

## 2. Technical Remediation & Workflow Enhancements

The workflow file [`.github/workflows/release.yml`](file:///home/zyan/Projects/aoe/.github/workflows/release.yml) was hardened with the following verified architectural improvements:

### 2.1 Resolution of pnpm Version Conflict

- Removed redundant `with.version: 9` parameter from `pnpm/action-setup@v4`.
- The action now correctly infers and pins `pnpm@9.15.9` directly from the root `package.json` (`"packageManager": "pnpm@9.15.9"`).

### 2.2 Correct Monorepo Build Ordering

- In a pristine CI runner checkout, TypeScript project references require internal package build artifacts (`dist/`) to exist before project-wide typechecking can succeed.
- Re-ordered `Build monorepo` (`pnpm build`) immediately after `Install dependencies` and `Audit production dependencies`, preceding `Run linter` and `Run typecheck`.

### 2.3 Transition from `pnpm -r publish` to Native `npm publish`

- `pnpm publish` delegates to an internal routine that does not perform the modern OIDC token exchange handshake with npm's Sigstore backend, causing unauthenticated requests to fail immediately with `ENEEDAUTH`.
- Transitioned to native `npm publish "$GITHUB_WORKSPACE/release-artifacts/$tarball" --access public --provenance`.
- Uses verified release tarballs packed in topological order by `pnpm pack`, ensuring all internal workspace protocols (`workspace:*`) are resolved to exact semantic versions (`0.1.2`).

### 2.4 Pre-Publication Dry-Run Validation

- Added a full dry-run publication stage iterating through all 7 packed release tarballs using `npm publish "$GITHUB_WORKSPACE/release-artifacts/$tarball" --access public --dry-run`.
- Verified in Run `41992920512` that all 7 packages successfully pass npm registry validation and syntax inspection without errors.

---

## 3. Root Cause Analysis: npm OIDC 404 Error

### 3.1 GitHub Actions OIDC Token Verification

In Run `41994126637`, runtime diagnostics queried the GitHub Actions token service using `$ACTIONS_ID_TOKEN_REQUEST_URL` with audience `npm:registry.npmjs.org`. The issued JWT payload was decoded and inspected:

```json
{
  "repository": "zulian026/aoe",
  "repository_owner": "zulian026",
  "job_workflow_ref": "zulian026/aoe/.github/workflows/release.yml@refs/heads/main",
  "ref": "refs/heads/main",
  "ref_type": "branch",
  "event_name": "workflow_dispatch",
  "aud": "npm:registry.npmjs.org",
  "iss": "https://token.actions.githubusercontent.com"
}
```

The claims strictly satisfy all GitHub Actions OIDC specifications:

1. `iss` points to `https://token.actions.githubusercontent.com`.
2. `aud` matches `npm:registry.npmjs.org`.
3. `repository` correctly identifies `zulian026/aoe`.
4. `job_workflow_ref` confirms `.github/workflows/release.yml`.

### 3.2 Registry Token Exchange Failure Matrix

When exchanging this valid OIDC token with npm registry endpoint `POST https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/<escaped_name>`, the npm registry returned `HTTP 404` for all 7 packages:

| Package Name          | Escaped Endpoint Target   | HTTP Status | npm Registry Response Body                                    |
| --------------------- | ------------------------- | ----------- | ------------------------------------------------------------- |
| `@zyanx04/protocol`   | `%40zyanx04%2Fprotocol`   | `404`       | `{"message":"OIDC token exchange error - package not found"}` |
| `@zyanx04/themes`     | `%40zyanx04%2Fthemes`     | `404`       | `{"message":"OIDC token exchange error - package not found"}` |
| `@zyanx04/core`       | `%40zyanx04%2Fcore`       | `404`       | `{"message":"OIDC token exchange error - package not found"}` |
| `@zyanx04/components` | `%40zyanx04%2Fcomponents` | `404`       | `{"message":"OIDC token exchange error - package not found"}` |
| `@zyanx04/adapters`   | `%40zyanx04%2Fadapters`   | `404`       | `{"message":"OIDC token exchange error - package not found"}` |
| `@zyanx04/renderer`   | `%40zyanx04%2Frenderer`   | `404`       | `{"message":"OIDC token exchange error - package not found"}` |
| `@zyanx04/cli`        | `%40zyanx04%2Fcli`        | `404`       | `{"message":"OIDC token exchange error - package not found"}` |

### 3.3 Underlying Causes on npmjs.com

Per npm's Trusted Publishing implementation, `OIDC token exchange error - package not found` occurs when the registry cannot map the incoming OIDC claims to a registered Trusted Publisher configuration. The root cause is one of the following:

1. **Owner / Organization Name Mismatch**:  
   The GitHub repository owner is `zulian026`, whereas the npm user account is `zyanx04`, and package `0.1.1` historically referenced `aoe-dev/aoe`. If the maintainer entered `zyanx04` or `aoe-dev` in the npm Trusted Publisher **"Organization or user"** field, npm rejects the claim `zulian026`.
2. **Workflow Filename Path Prefix**:  
   If the maintainer entered `.github/workflows/release.yml` on `npmjs.com` instead of the bare filename `release.yml`, npm's exact string matcher fails to find the publisher.
3. **Unmatched Environment Setting**:  
   If the maintainer entered a value in the **"Environment"** field on `npmjs.com` (e.g., `release`), the token exchange fails because the repository `zulian026/aoe` has 0 GitHub Environments configured (`gh api repos/zulian026/aoe/environments` returns `[]`), so no environment claim is emitted.
4. **Unconfigured Trusted Publishers**:  
   The 7 packages have not yet had GitHub Actions Trusted Publisher access saved in their respective `npmjs.com` access settings.

---

## 4. Current Registry State Matrix

All 7 packages remain securely preserved at version `0.1.1` (with placeholder `0.0.0-stage`). No partial or corrupted `0.1.2` publishes occurred:

| #   | Package Name          | npm Version Status     | Current Tarball Integrity |
| --- | --------------------- | ---------------------- | ------------------------- |
| 1   | `@zyanx04/protocol`   | `0.1.1`, `0.0.0-stage` | Preserved                 |
| 2   | `@zyanx04/themes`     | `0.1.1`, `0.0.0-stage` | Preserved                 |
| 3   | `@zyanx04/core`       | `0.1.1`, `0.0.0-stage` | Preserved                 |
| 4   | `@zyanx04/components` | `0.1.1`, `0.0.0-stage` | Preserved                 |
| 5   | `@zyanx04/adapters`   | `0.1.1`, `0.0.0-stage` | Preserved                 |
| 6   | `@zyanx04/renderer`   | `0.1.1`, `0.0.0-stage` | Preserved                 |
| 7   | `@zyanx04/cli`        | `0.1.1`, `0.0.0-stage` | Preserved                 |

---

## 5. Maintainer Resolution Checklist on npmjs.com

To unblock public release of AOE `v0.1.2`, the repository maintainer must log into [`npmjs.com`](https://www.npmjs.com) using account `zyanx04` and update the Trusted Publisher settings for all seven packages:

### Navigation URLs:

1. `https://www.npmjs.com/package/@zyanx04/protocol/access`
2. `https://www.npmjs.com/package/@zyanx04/themes/access`
3. `https://www.npmjs.com/package/@zyanx04/core/access`
4. `https://www.npmjs.com/package/@zyanx04/components/access`
5. `https://www.npmjs.com/package/@zyanx04/adapters/access`
6. `https://www.npmjs.com/package/@zyanx04/renderer/access`
7. `https://www.npmjs.com/package/@zyanx04/cli/access`

### Exact Configuration Form Values:

Under **Publishing Access** -> **Trusted Publishers** -> **Add Trusted Publisher** -> **GitHub Actions**:

| Field                    | Required Exact Value | Note                                                       |
| ------------------------ | -------------------- | ---------------------------------------------------------- |
| **Organization or user** | `zulian026`          | **Must match GitHub owner**, NOT npm username `zyanx04`    |
| **Repository**           | `aoe`                | Repository name only, without owner prefix                 |
| **Workflow filename**    | `release.yml`        | **Filename only**, DO NOT include `.github/workflows/`     |
| **Environment**          | _(leave blank)_      | Do not enter any text; no GitHub environment is configured |

Once updated across all 7 packages, triggering `gh workflow run release.yml --ref main -f release_tag=v0.1.2` will execute and publish the verified `v0.1.2` release with provenance attestations and draft GitHub Release attachments.
