MUST READ: CLAUDE.md

## Branch Protection Policy

- `main` is protected. Do not push commits directly to `main`.
- All code changes must be submitted via Pull Request from a feature branch.
- Merge to `main` only after required CI checks pass.
- For PRs that change publishable packages, include a `.changeset/*.md` file.  
  Exception: docs-only or CI-only changes that do not affect package behavior.

## Delivery Workflow

- Always run CI-equivalent local checks before opening/updating a PR.
- Required local checks (match CI gates): `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, `pnpm test:browser:ci` (or a clearly scoped subset when changes are package-local and justified in PR notes).

## Static/SSG Guardrails

- Never trust old `dist-ssg` outputs when validating static UI changes.
- For any static/export/config/dashboard change, always rebuild SSG before judging results:
  - `pnpm --filter @openspecui/web build:ssg`
- If behavior looks unchanged, clean stale artifacts first, then rebuild:
  - `rm -rf packages/web/dist-ssg packages/web/.vite`
  - `pnpm --filter @openspecui/web build:ssg`
- Browser-target code in `packages/web` must not runtime-import `@openspecui/core` root entry.
  - Allowed pattern: `import type { ... } from '@openspecui/core'`
  - Runtime helpers must use safe subpath entries (example: `@openspecui/core/opsx-display-path`).
- If static snapshot structure changes, update these together in one PR:
  - `packages/core/src/export-types.ts`
  - `packages/cli/src/export.ts`
  - `packages/web/src/lib/static-data-provider.ts`
  - related tests in `packages/web/src/lib/static-data-provider*.test.ts`
- Static and live modes must share the same display/mapping logic; do not introduce parallel implementations unless explicitly required.
- Static-related completion check (minimum):
  - `pnpm --filter @openspecui/web test -- src/entry-client-static.test.tsx src/lib/static-data-provider.opsx.test.ts`
  - `pnpm --filter @openspecui/web build:ssg`

### Community Contributor Mode

- Do not open/update a PR until local CI-relevant checks pass.
- After PR is open, wait for maintainer review and merge decision.

### Manager Mode (Gaubee)

- Do not open/update a PR until local CI-relevant checks pass.
- After required PR checks pass, auto-merge to `main`.
- After merge to `main`, ask manager whether to release.
- If manager confirms release:
  1. run `pnpm changeversion`
  2. wait for the changeversion PR checks to pass
  3. auto-merge the changeversion PR
  4. notify manager that `pnpm release` is ready to run
