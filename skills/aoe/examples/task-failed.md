# Migrate Authentication to OAuth2 PKCE Flow

**Status**: `FAILED` — Upstream identity provider TLS certificate validation failed in local development environment.

## Key Findings

- OAuth2 authorization code exchange with PKCE completed initial token request, but failed during public key JWKS retrieval.
- Local OpenSSL trust store lacks the private root certificate authority used by the internal staging mock server.
- The authentication module cannot be marked complete until the secure token signature can be verified end-to-end.

## Execution Details

```bash
$ pnpm test:integration tests/oauth-pkce.test.ts
# Exit code: 1 (Duration: 1.15s)
```

**Standard Error:**

```text
FetchError: request to https://mock-idp.internal/oauth/v2/certs failed, reason: self-signed certificate in certificate chain
    at ClientRequest.<anonymous> (/home/dev/project/node_modules/node-fetch/lib/index.js:1491:11)
    at TLSSocket.onConnectSecure (node:_tls_wrap:1674:34)
    code: 'SELF_SIGNED_CERT_IN_CHAIN'
```

## Diagnostic

- **Severity**: `ERROR`
- **Location**: `src/auth/jwks-client.ts:46:12`
- **Confirmed Fact**: HTTP request to internal identity provider failed with Node.js TLS error `SELF_SIGNED_CERT_IN_CHAIN`.
- **Root Cause**: Node.js runtime rejects the self-signed TLS certificate presented by the local Dockerized IdP mock because `NODE_EXTRA_CA_CERTS` is unset in the development environment.
- **Suggested Remediation**:
  1. Mount the internal CA cert: `export NODE_EXTRA_CA_CERTS="/etc/ssl/certs/internal-mock-ca.pem"`.
  2. Re-run `pnpm test:integration tests/oauth-pkce.test.ts` to verify JWKS key retrieval.

## Next Actions

1. Export `NODE_EXTRA_CA_CERTS` with the local mock CA cert path.
2. Re-execute the integration test suite once TLS trust is established.
