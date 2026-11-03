## Description

Please include a summary of the changes and the related issue/milestone.

Fixes #(issue)

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement / Refactoring

## Architecture & Safety Checklist

- [ ] Zero arbitrary shell execution from parsed event payloads
- [ ] Zero automated modifications to external agent configurations
- [ ] Terminal output sanitized with `sanitizeTerminalText` and `maskSecrets`
- [ ] Streaming memory boundaries respected

## Quality Gates Verified

- [ ] `pnpm build` passes with zero errors
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm test` passes all tests
- [ ] `pnpm lint` passes with 0 warnings and 0 errors
- [ ] `pnpm format:check` reports clean formatting
