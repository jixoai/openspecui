## Implementation State

- Loop initialized from the `E422 provenance repository.url` failure in `release.yml`.
- Implemented publish-time staging: packages without `repository.url` are copied into a temporary publish directory, patched with the canonical repository URL, and published from there.
- Local verification passed:
  - `pnpm exec vitest run scripts/lib/publish-packages/repository.test.ts scripts/lib/publish-packages/workspace.test.ts`
  - `PUBLISH_PACKAGES_DRY_RUN=1 bun ./scripts/publish-packages.ts`
  - `pnpm format:check`
  - `pnpm lint:ci`
  - `pnpm typecheck`
  - `pnpm test:ci`
  - `pnpm test:browser:ci`

## Decisions Taken

- Avoid touching `packages/*` source manifests to preserve the pending `2.1.0` release path without introducing a new changeset.
- Derive the canonical repository URL from GitHub Actions environment first, then fall back to normalized `git remote origin` parsing.
- Inject only missing repository metadata; packages that already declare `repository.url` keep publishing from their original directory.

## Divergence Notes

- `pnpm test:ci` hit an existing local Vitest worker crash once in `packages/core`; the immediate rerun passed without code changes.
- `PUBLISH_PACKAGES_DRY_RUN=1 bun ./scripts/publish-packages.ts` shows npm now recognizes and normalizes the injected repository metadata instead of failing provenance validation.

## Loopback Triggers

- If the next `release.yml` run still fails after manifest injection, loop back and inspect any remaining provenance fields npm validates beyond `repository.url`.
