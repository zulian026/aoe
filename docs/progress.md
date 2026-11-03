# AOE Project Progress & Milestone Tracker

| Milestone | Title                        | Target Scope                                                                        | Status              | Evidence / Verification                                     |
| :-------- | :--------------------------- | :---------------------------------------------------------------------------------- | :------------------ | :---------------------------------------------------------- |
| **M00**   | **Repository Foundation**    | Workspace setup, TS, Vitest, ESLint, Prettier, package boundaries, docs             | **In Verification** | `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm format:check` |
| **M01**   | **AOE Skill**                | Standalone instruction system, native fallback, hierarchy, tables, error formatting | Pending             | Not started until M00 verified                              |
| **M02**   | **Universal Event Protocol** | Versioned JSONL event schemas, envelopes, Zod validation                            | Pending             | Blocked on M01                                              |
| **M03**   | **Core Engine**              | Event stream processing, session manager, state machine, lifecycle                  | Pending             | Blocked on M02                                              |
| **M04**   | **Terminal Renderer**        | Ink components, terminal screen manager, alternate screen buffer                    | Pending             | Blocked on M03                                              |
| **M05**   | **Theme Engine**             | Theme registry, Obsidian dark, light theme, custom tokens                           | Pending             | Blocked on M04                                              |
| **M06**   | **Agent Integration**        | Adapters for Codex, Claude Code, Gemini CLI, OpenCode, generic stream               | Pending             | Blocked on M05                                              |
| **M07**   | **CLI Tooling**              | `aoe` commands (`render`, `pipe`, `theme`, `doctor`, `skill`)                       | Pending             | Blocked on M06                                              |
| **M08**   | **Release Preparation**      | Packaging, end-to-end verification, performance profiling, release                  | Pending             | Blocked on M07                                              |

---

## Detailed Milestone Log

### M00: Repository Foundation

- **Goal**: Initialize repository, establish workspace structure, configure tooling, define architecture and standards.
- **Artifacts Created**:
  - `package.json`, `pnpm-workspace.yaml`, `.gitignore`
  - `tsconfig.base.json`, `tsconfig.json`
  - `eslint.config.js`, `.prettierrc.json`, `.prettierignore`
  - `vitest.config.ts`
  - Packages: `@aoe/protocol`, `@aoe/themes`, `@aoe/components`, `@aoe/renderer`, `@aoe/core`, `@aoe/adapters`
  - Applications: `@aoe/cli`
  - Skills: `skills/aoe/SKILL.md`
  - Docs: `docs/architecture.md`, `docs/engineering-standards.md`, `docs/progress.md`
