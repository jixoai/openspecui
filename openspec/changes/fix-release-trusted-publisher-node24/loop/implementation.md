## Implementation State

- Loop initialized from the failed `release.yml` run after PR #49 merged.
- Implemented workflow change: the release workflow now uses Node 24 and no longer passes `registry-url` to `setup-node`.
- Local CI-equivalent checks passed:
  - `pnpm format:check`
  - `pnpm lint:ci`
  - `pnpm typecheck`
  - `pnpm test:ci`
  - `pnpm test:browser:ci`

## Decisions Taken

- Treat the failure as a workflow/runtime problem first because the publish step already reached npm and the package ownership checks passed locally.
- Keep the publish script unchanged in this loop so the fix stays attributable to workflow runtime/auth configuration.
- Keep the scope on workflow runtime/auth only; do not change package metadata or release versions in this loop.

## Divergence Notes

- `pnpm test:ci` hit an existing flaky timeout once in `packages/core/src/reactive-fs/reactive-fs.test.ts` for `reactiveExists() should update when file is deleted`.
- The targeted test passed on rerun, and the subsequent full `pnpm test:ci` run passed.

## Loopback Triggers

- If the next `release.yml` run still returns `E404`, loop back and inspect npm Trusted Publisher package configuration for `@openspecui/web`.
