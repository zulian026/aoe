# Contributing to AOE

Thank you for your interest in contributing to AOE (Agent Output Enhancement)! This document provides guidelines for setting up your development environment, navigating the architecture, creating new adapters or themes, and submitting pull requests.

---

## 1. Code of Conduct

All contributors and participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 2. Development Setup

### Prerequisites

- **Node.js**: `>= 20.0.0`
- **pnpm**: `>= 9.0.0`
- **Git**

### Initial Setup

```bash
# 1. Clone repository
git clone https://github.com/aoe-dev/aoe.git
cd aoe

# 2. Install dependencies across workspaces
pnpm install

# 3. Build all packages
pnpm build

# 4. Verify tests and quality gates
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
```

---

## 3. Workspace Structure & Package Boundaries

AOE is structured as a modular TypeScript monorepo using pnpm workspaces and composite TypeScript projects:

```text
aoe/
├── apps/
│   └── cli/            # Executable "aoe" binary (Commander, runtime, config)
├── packages/
│   ├── protocol/       # Canonical event schemas, Zod validators, JSONL serialization
│   ├── core/           # Event ingestion, session state, tasks, lifecycle, snapshots
│   ├── renderer/       # Screen orchestrator (TerminalRenderer with Ink, StaticRenderer)
│   ├── components/     # Reusable terminal UI components (React 19 / Ink 8)
│   ├── themes/         # Theme definitions, token resolution, WCAG contrast checks
│   └── adapters/       # Ingestion adapters for Claude Code, Gemini CLI, Generic JSONL
└── skills/
    └── aoe/            # Zero-dependency portable agent skill
```

### Dependency Rules:

- Packages MUST maintain a strict DAG (Directed Acyclic Graph).
- `@aoe/protocol` and `@aoe/themes` have no internal workspace dependencies.
- `@aoe/core` depends only on `@aoe/protocol`.
- `@aoe/components` depends only on `@aoe/themes`.
- `@aoe/renderer` depends on `@aoe/components`, `@aoe/core`, `@aoe/protocol`, and `@aoe/themes`.
- `@aoe/adapters` depends on `@aoe/protocol`.
- `apps/cli` orchestrates all packages.
- Never introduce circular imports between packages.

---

## 4. Coding Conventions

- **Strict TypeScript**: `strict: true` and `noImplicitAny: true` are enforced everywhere.
- **ESM Only**: Use `.js` extensions for local module imports in source code (e.g. `import { foo } from './foo.js'`).
- **Clean Code Style**:
  - Run `pnpm format` before committing.
  - Run `pnpm lint` to ensure zero ESLint errors or warnings.
- **Deterministic & Safe Operations**:
  - Never execute arbitrary shell commands from parsed event input.
  - Never modify external agent configuration files.
  - Always sanitize terminal output strings with `sanitizeTerminalText` and `maskSecrets`.

---

## 5. Creating a New Adapter

To add support for a new AI coding agent:

1. Create a directory under `packages/adapters/src/agents/<agent-name>/`.
2. Implement the `AgentAdapter` interface from `packages/adapters/src/contracts/adapter.ts`:
   - `id`: Unique identifier (e.g. `'my-agent'`).
   - `name`: Display name.
   - `detect(context)`: Returns confidence level (`HIGH`, `MEDIUM`, `LOW`, `NONE`).
   - `createSession(options)`: Returns an `AdapterSession` handling streaming chunks and emitting canonical `AoeEvent` objects.
3. Register the new adapter in `createDefaultAdapterManager()` in `packages/adapters/src/manager/adapter-manager.ts`.
4. Add comprehensive unit and integration tests under `packages/adapters/src/tests/`.

---

## 6. Creating a New Theme

To create a new visual theme:

1. Define a theme object complying with `AoeTheme` or `ThemeDefinition` in `packages/themes/src/contracts.ts`.
2. Ensure color tokens satisfy minimum contrast ratios against terminal backgrounds.
3. Register the theme in `packages/themes/src/builtin/` or via `ThemeRegistry.register()`.
4. Add verification tests in `packages/themes/src/tests/`.

---

## 7. Testing Requirements

- Unit tests must accompany every new feature or bug fix.
- Run the full test suite with:
  ```bash
  pnpm test
  ```
- All quality gates must pass:
  ```bash
  pnpm build
  pnpm typecheck
  pnpm test
  pnpm lint
  pnpm format:check
  ```

---

## 8. Pull Request Guidelines

1. **Branch Naming**: Use descriptive prefixes: `feat/...`, `fix/...`, `docs/...`, `refactor/...`, `test/...`.
2. **Commit Messages**: Follow Conventional Commits format (e.g., `feat(adapters): add support for Copilot CLI`).
3. **PR Description**: Detail the problem, proposed solution, and test evidence.
4. **CI Verification**: Ensure all GitHub Actions checks pass on your branch.
