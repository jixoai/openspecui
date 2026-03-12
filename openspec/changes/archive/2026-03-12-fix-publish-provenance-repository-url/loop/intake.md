## User Input

- Continue until CI/CD publishing succeeds.
- The latest `release.yml` run now fails with provenance validation instead of Trusted Publishing `E404`.
- Concrete runner error: `package.json: "repository.url" is "", expected to match "https://github.com/jixoai/openspecui" from provenance` while publishing `@openspecui/web@2.1.0`.

## Objective Scope

- Fix the publish path so the currently unpublished `@openspecui/web@2.1.0` can be published with valid provenance metadata.
- Keep the change outside `packages/*` if possible so the fix does not require a new changeset/version bump.

## Non-Goals

- Start a new version bump for `@openspecui/web`.
- Modify package source manifests under `packages/*` unless there is no other safe option.
- Rework the release workflow again unless new evidence demands it.

## Acceptance Boundary

- The publish step provides a valid `repository.url` matching `https://github.com/jixoai/openspecui` for provenance verification.
- The next `release.yml` run succeeds.
- `npm view @openspecui/web version` returns `2.1.0`.
