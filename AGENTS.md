# AGENTS.md

Paseo — one interface for Claude Code, Codex, Copilot, OpenCode, and Pi. Self-hosted daemon + multi-platform clients (mobile, desktop, web, CLI).

## Repo

npm workspace monorepo. All workspaces share one version. Packages resolve through `dist/`, not `src/`.

| Package            | Path                          | What                                   |
| ------------------ | ----------------------------- | -------------------------------------- |
| server             | `packages/server`             | Daemon (port 6767)                     |
| app                | `packages/app`                | Expo mobile + web                      |
| desktop            | `packages/desktop`            | Electron shell                         |
| cli                | `packages/cli`                | CLI client                             |
| relay              | `packages/relay`              | E2E encrypted transport                |
| protocol           | `packages/protocol`           | Wire schemas (Protobuf)                |
| client             | `packages/client`             | SDK facade                             |
| website            | `packages/website`            | Marketing site (TanStack + Cloudflare) |
| highlight          | `packages/highlight`          | Syntax highlighting                    |
| expo-two-way-audio | `packages/expo-two-way-audio` | Audio interop                          |

## Commands

```bash
npm run dev              # Daemon + Expo (portless)
npm run dev:win          # Windows PowerShell variant
npm run typecheck        # ALWAYS run after changes
npm run lint             # oxlint
npm run format           # oxfmt

# Build chains — order matters
npm run build:client     # protocol → client
npm run build:server     # highlight → relay → protocol → client → server → cli
npm run build:app-deps   # highlight → protocol → client → expo-two-way-audio

# Tests — NEVER run full suite locally
npx vitest run <file> --bail=1
```

## Critical Rules

1. **Never restart the daemon** on port 6767 without explicit permission.
2. **Never run the full test suite locally.** Always target specific files.
3. **Always typecheck + lint** after every change. Pre-commit hook enforces this.
4. **Build workspace packages before diagnosing cross-package type errors.** Stale `dist/` causes phantom failures.
5. **Protocol backward compatibility is strict.** Schemas are append-only. Never remove or rename fields.
6. **Platform gating** — use `isWeb`, `isNative`, `getIsElectron()`, `useIsCompactFormFactor()`. Prefer Metro file extensions (`.web.ts`, `.native.ts`) over runtime `if` statements.
7. **RPC namespacing** — dotted names with `.request` / `.response` suffixes. See `docs/rpc-namespacing.md`.
8. **No `vi.mock` / `vi.spyOn` of own exports.** Tests use real deps. See `docs/testing.md`.

## Testing

- Suffix-based categorization: `*.test.ts` (unit), `*.e2e.test.ts`, `*.browser.test.ts`, `*.integration.test.ts`
- Two categories only: unit tests with ports/adapters, or real E2E
- Collocated tests (next to source)
- Deterministic — no flaky timing, no network, no randomness without seeds

## Deeper Knowledge

The `docs/` directory is the source of truth for system-level architecture:

- `docs/architecture.md` — system overview
- `docs/coding-standards.md` — style, patterns, conventions
- `docs/testing.md` — testing philosophy and rules
- `docs/development.md` — dev workflow
- `docs/release.md` — release process
- `docs/data-model.md` — core data structures
- `docs/agent-lifecycle.md` — agent state machine
- `docs/providers.md` — LLM provider integration
