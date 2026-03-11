## Implementation State

- Replaced the publish executor with a custom `scripts/publish-packages.ts` flow.
- Added `scripts/lib/publish-packages/workspace.ts` to discover public workspace packages and order them for publish.
- Added `scripts/lib/publish-packages/workspace.test.ts` to verify dependency ordering and cycle detection.
- Updated root `release:packages` to run `pnpm build && bun ./scripts/publish-packages.ts`.
- Updated `.github/workflows/release.yml` path filters so future release-engine changes under `package.json` or `scripts/**` also trigger the release workflow on `main`.
- Verified locally with `PUBLISH_PACKAGES_DRY_RUN=1 bun ./scripts/publish-packages.ts` that only `@openspecui/web@2.1.0` is considered unpublished and that `npm publish --provenance --dry-run` succeeds for it.
- Local CI-equivalent checks passed:
  - `pnpm format:check`
  - `pnpm lint:ci`
  - `pnpm typecheck`
  - `pnpm test:ci`
  - `pnpm test:browser:ci`

## Decisions Taken

- Keep Changesets only for versioning and git tag generation.
- Use npm CLI directly for actual publication because the previous `changeset publish -> pnpm publish` path failed under GitHub OIDC for `@openspecui/web`.
- Keep tag generation via `changeset tag` after successful npm publishes.
- Add a dry-run mode through `PUBLISH_PACKAGES_DRY_RUN=1` for local validation without publishing.

## Divergence Notes

- The implementation goes beyond workflow-only changes and introduces a dedicated publish script, because the prior publish executor proved unreliable in the real GitHub OIDC environment.

## Loopback Triggers

- If GitHub OIDC still fails with npm CLI publish, return to research-plan and treat npm Trusted Publisher configuration as the primary blocker.
