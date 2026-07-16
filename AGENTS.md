# AGENTS.md

togetherlink is a TypeScript/pnpm monorepo that runs real coding-agent CLIs with Together AI models. Claude and Codex use local protocol proxies; other harnesses use temporary provider configuration.

## Map

- `packages/models/`: single source of truth for curated model IDs, capabilities, limits, and pricing.
- `packages/cli/`: CLI, harnesses, proxies, daemon, configuration, and updater.
- `packages/tests/`: deterministic protocol tests and opt-in live harness tests.
- `site/`: website; `TESTING.md` contains detailed testing guidance.

## Rules

- Use pnpm from the repo root. Node 18+ is required; release bundling also needs Bun.
- Keep model data in `packages/models/src/index.ts`; do not duplicate it in adapters.
- Harness configuration should be temporary and must not rewrite users' normal tool config. `chatgpt` / `codex-app` is the exception and must preserve backup/restore behavior.
- For proxy bugs, add a focused regression first, then make the smallest fix. Prefer deterministic tests; use live tests only for real CLI, Together, streaming, or desktop behavior.
- Do not hand-edit release artifacts. Run `pnpm build:bundle` to update tracked `site/install.sh`, `site/latest.json`, and `site/togetherlink.js`.
- Preserve unrelated working-tree changes.

## Checks

```bash
pnpm format:check
pnpm typecheck
pnpm test
```

Run the narrowest relevant test before the full checks. After pushing, monitor GitHub Actions for the exact commit until completion, especially on `main`; fix failures and monitor the replacement run.
