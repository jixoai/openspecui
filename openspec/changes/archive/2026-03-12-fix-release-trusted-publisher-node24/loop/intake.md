## User Input

- Continue the main release task until CI/CD publishing succeeds.
- The `release.yml` run after merging PR #49 still failed during `Publish packages`.
- The concrete failure is `npm publish @openspecui/web@2.1.0` returning `E404` on the GitHub runner.

## Objective Scope

- Repair the GitHub release workflow so npm Trusted Publishing can publish `@openspecui/web@2.1.0` successfully from `main`.
- Limit the change to release workflow/runtime configuration unless new evidence requires otherwise.

## Non-Goals

- Change package versions again.
- Rework the publish script unless the workflow fix proves insufficient.
- Fall back to manual local publishing as the primary solution.

## Acceptance Boundary

- `release.yml` uses a Trusted Publishing compatible runtime/configuration.
- The next `release.yml` run on `main` succeeds.
- `npm view @openspecui/web version` returns `2.1.0` after the successful run.
