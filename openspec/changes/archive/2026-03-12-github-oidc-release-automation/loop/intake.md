## User Input

- User configured npm Trusted Publisher for `release.yml` + `npm-release` for:
  - `openspecui`
  - `@openspecui/core`
  - `@openspecui/search`
  - `@openspecui/server`
  - `@openspecui/web`
  - `xterm-input-panel`
- User requirement: complete the remaining work until publishing succeeds.
- User requirement: use npm OIDC Trusted Publishing instead of `NPM_TOKEN`.
- User requirement: `.DS_Store` should be handled through `.gitignore`.

## Objective Scope

- Add repository automation for GitHub Actions based npm publishing with OIDC trusted publishing.
- Keep the existing changeset-based versioning flow, but move the actual publish step to GitHub Actions.
- Validate the release path against the current repository package graph and publish workflow.
- Include the `.gitignore` cleanup required for `.DS_Store`.

## Non-Goals

- Rework the package graph or simplify publishable package boundaries.
- Add backward compatibility for token-based npm publishing.
- Redesign the full local `pnpm release` UX beyond what is required to align it with GitHub-based publishing.

## Acceptance Boundary

- Repository contains a working `release.yml` aligned with npm Trusted Publisher settings.
- Release automation uses GitHub OIDC permissions instead of `NPM_TOKEN`.
- Local CI-equivalent checks pass before PR update.
- After merge to `main`, the repository can publish through the GitHub workflow.
- `.DS_Store` is ignored repository-wide.
