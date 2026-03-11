## User Input

- The second real `release.yml` run reached the new publish script but failed with `sh: 1: bun: not found`.
- User requirement remains unchanged: continue until publishing succeeds.

## Objective Scope

- Fix the GitHub release workflow runtime so `bun ./scripts/publish-packages.ts` can execute on the runner.
- Re-run `release.yml` after the fix and confirm publish success.

## Non-Goals

- Rework the publish script again.
- Change package versions or release PR behavior.

## Acceptance Boundary

- `release.yml` installs Bun before running `pnpm release:packages`.
- The next `release.yml` run succeeds and publishes `@openspecui/web@2.1.0`.
