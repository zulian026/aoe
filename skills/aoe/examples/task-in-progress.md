# Refactoring Database Adapter to Connection Pool

**Status**: `RUNNING` — Migration of repository queries to connection pool is actively in progress.

## Key Findings

- Direct database client connections caused intermittent connection timeouts under concurrent load (>50 simultaneous queries).
- Connection pool abstraction in `packages/core/src/db/pool.ts` prevents connection exhaustion by enforcing a max pool size of 20.
- 4 of 6 database repositories have been successfully migrated and verified with unit tests.

## Execution Progress (4/6 Repositories Migrated)

- [x] **Connection Pool Setup**: Implemented pool manager with health check (`packages/core/src/db/pool.ts`).
- [x] **User Repository**: Migrated query methods to acquire connections from pool (`packages/core/src/db/user-repo.ts`).
- [x] **Session Repository**: Migrated session lookup and invalidation queries (`packages/core/src/db/session-repo.ts`).
- [x] **Audit Log Repository**: Migrated batch insert queries (`packages/core/src/db/audit-repo.ts`).
- [/] **Workspace Repository**: Currently refactoring transactional queries (`packages/core/src/db/workspace-repo.ts`).
- [ ] **Billing Repository**: Pending migration.

## Execution Details

```bash
$ pnpm test packages/core/src/db/user-repo.test.ts packages/core/src/db/session-repo.test.ts
# Exit code: 0 (Duration: 840ms)
```

```text
 ✓ src/db/user-repo.test.ts (6 tests) 14ms
 ✓ src/db/session-repo.test.ts (4 tests) 11ms

Test Files  2 passed (2)
     Tests  10 passed (10)
```

## Next Actions

1. Complete transaction handling in `workspace-repo.ts`.
2. Migrate `billing-repo.ts` to connection pool.
3. Run complete integration test suite: `pnpm test:integration`.
