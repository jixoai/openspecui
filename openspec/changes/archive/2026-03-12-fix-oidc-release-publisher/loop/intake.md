## User Input

- Real publish validation after merging PR #47 failed in `release.yml`.
- Failure detail: `changeset publish` attempted to publish `@openspecui/web@2.1.0` and GitHub OIDC/provenance succeeded, but npm returned `404 Not Found - PUT https://registry.npmjs.org/@openspecui%2fweb`.
- User requirement remains unchanged: continue until publishing succeeds.

## Objective Scope

- Fix the GitHub release publish path so `@openspecui/web@2.1.0` can be published successfully from GitHub Actions.
- Preserve the existing `changeset version` PR flow.
- Keep the publish path compatible with future multi-package releases.

## Non-Goals

- Rework package versions or release PR semantics.
- Fall back to manual maintainer OTP publishing unless no GitHub-based fix exists.
- Redesign app/website deploy steps in this loop.

## Acceptance Boundary

- `release.yml` succeeds on `main` for the current unpublished package set.
- `@openspecui/web@2.1.0` becomes published on npm.
- Release tags are pushed after successful publish.
