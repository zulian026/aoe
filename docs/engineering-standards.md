# AOE Engineering Standards

## 1. Core Principles

1. **Evidence-Based Engineering**: Never claim a feature is implemented without test evidence or observable behavior.
2. **Package Isolation**: Every package in `packages/*` and `apps/*` must be independently buildable, testable, and lintable.
3. **Strict Type Safety**: All TypeScript code must compile under `strict: true`, `noImplicitAny: true`, and `exactOptionalPropertyTypes: true`.
4. **Hermetic Testing**: Tests must run deterministically with zero dependence on external network services.
5. **Backwards Compatibility**: The Universal Protocol (`@aoe/protocol`) must maintain semantic versioning and compatibility across patch and minor releases.
6. **No Phantom Progress**: Output streams and UI components must accurately reflect true execution states. Never synthesize simulated delays or mock progress.

## 2. Monorepo Conventions

- **Workspace Manager**: `pnpm` workspaces (`pnpm-workspace.yaml`).
- **Module System**: Pure ECMAScript Modules (`"type": "module"`).
- **TypeScript Resolution**: `moduleResolution: "NodeNext"`.
- **Internal Dependencies**: Reference monorepo packages using `workspace:*`.
- **Linting & Formatting**: ESLint 9 (flat config) + Prettier.

## 3. Quality Gates (Must pass before milestone signoff)

Before marking any milestone complete, all of the following commands must succeed with exit code 0:

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
```

## 4. Error Handling & Privacy

- Private agent reasoning (e.g. `<thought>`, `<thinking>`) must be filtered out at the adapter layer before reaching the protocol or renderer.
- Failures must produce structured `error.*` events or standard error exits without crashing unhandled.
- Terminal alternate screen buffers must register cleanup hooks for `SIGINT`, `SIGTERM`, and `uncaughtException` to ensure the user's shell is always restored.
