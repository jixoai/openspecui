## Implementation State

- Added a Bun setup step to `.github/workflows/release.yml` before the publish step.
- Renamed the publish step label from `Publish packages with Changesets` to `Publish packages` to match the actual executor.
- Local CI-equivalent checks passed:
  - `pnpm format:check`
  - `pnpm lint:ci`
  - `pnpm typecheck`
  - `pnpm test:ci`
  - `pnpm test:browser:ci`

## Decisions Taken

- Keep the hotfix minimal: install Bun in the runner rather than reworking scripts again.
- Use `oven-sh/setup-bun@v2`, matching the official action usage.

## Divergence Notes

- No divergence recorded.

## Loopback Triggers

- If the next `release.yml` run still fails, return to research-plan and inspect the next concrete runtime or publish error from the GitHub runner logs.
