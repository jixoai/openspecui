## Implementation State

- OpenSpec change scaffold created and completed.
- `.gitignore` now ignores `.DS_Store` repository-wide.
- Added `.github/workflows/release.yml` for npm Trusted Publishing via GitHub Actions OIDC.
- Added `scripts/lib/changeversion/release-workflow.ts` to detect and watch GitHub release workflow runs.
- Updated `scripts/changeversion-auto.ts` so `pnpm changeversion` now waits for the post-merge GitHub release workflow instead of stopping at “ready for pnpm release”.
- Created GitHub environment `npm-release` in `jixoai/openspecui` to match the npm Trusted Publisher configuration.
- Local CI-equivalent checks passed:
  - `pnpm format:check`
  - `pnpm lint:ci`
  - `pnpm typecheck`
  - `pnpm test:ci`
  - `pnpm test:browser:ci`

## Decisions Taken

- Keep Changesets as the versioning and publish decision source of truth.
- Use a dedicated `release.yml` workflow for publish execution instead of `changesets/action`, to avoid conflicting with the repository's existing `pnpm changeversion` release-PR flow.
- Trigger the release workflow only when version/changelog files under `packages/*` change on `main`, plus manual dispatch.
- Push git tags from the release workflow after `changeset publish` succeeds.
- Keep provenance enabled from workflow env via `NPM_CONFIG_PROVENANCE=true`.

## Divergence Notes

- The final implementation uses path-filtered `push` triggers rather than “every `main` push” execution. This is a deliberate optimization to avoid unnecessary publish jobs on ordinary feature merges.

## Loopback Triggers

- If npm Trusted Publishing rejects the workflow because of filename/environment mismatch, return to research-plan and adjust workflow/environment naming.
- If `changeset publish` under GitHub Actions does not authenticate correctly with OIDC, return to research-plan and redesign the publish command path.
- If tag push permissions differ from expected repository defaults, return to research-plan and adjust workflow permissions or push strategy.
