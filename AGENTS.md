# open_brain

**Parent:** [GitHubPolishes](../AGENTS.md)

## Purpose

<!-- AGENTS-PURPOSE START -->
One shared memory layer for Cursor, Claude, and any MCP client: thoughts stored in **Postgres + pgvector**, exposed via an **MCP server** with semantic search, capture, and soft-delete (invalidation).
<!-- AGENTS-PURPOSE END -->

## Navigation

<!-- AGENTS-NAV START -->
### Subfolders
- [scripts/](./scripts/AGENTS.md) — Workspace folder: scripts
- [src/](./src/AGENTS.md) — Workspace folder: src

### Key files
- `AGENTS.md`
- `package.json`
- `README.md`
- `schema.sql` / `schema-ollama.sql`
- `package-lock.json`
- `tsconfig.json`

_Navigation auto-synced by `scripts/sync_agents_md.py`. Edit Purpose above; re-run sync after adding/removing folders or key files._
<!-- AGENTS-NAV END -->

## Public repository boundary

This is a public repository. Architectural changes and public-safe implementation are in scope. Never add private data, secrets, personal memory, raw transcripts, account-specific configuration, or private operational artifacts. Keep credentials in ignored local environment files and keep private verification receipts outside this repository.

## Hermes delivery and safety

Treat `README.md`, `package.json`, `src/`, `schema*.sql`, and `scripts/` as authoritative. Use Node >=18 and run `npm run build` and `npm run test:env` when dependencies and a safe environment are available. Do not run `npm run init-db` or mutate a database without explicit approval. Workers own explicit files; reviewers are read-only.
