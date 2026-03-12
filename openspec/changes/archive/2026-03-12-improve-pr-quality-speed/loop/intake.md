## User Input

- Continue the release/CI/CD line of work after the Trusted Publisher release pipeline fix landed.
- Improve GitHub Actions speed where the gains are clear and low risk.
- Provide concrete recommendations for additional GitHub Actions speedups.
- `openspecui` on npm previously missed Trusted Publisher setup; that npm-side configuration has now been added.

## Objective Scope

- Reduce PR workflow runtime and warning noise with minimal-risk workflow-only changes.
- Keep the change focused on `.github/workflows/pr-quality.yml`.
- Preserve the current release workflow and package publish logic.

## Non-Goals

- Redesign the entire CI topology.
- Introduce aggressive diff-based job skipping in the same loop.
- Change release versions or package manifests.
- Rework release publishing now that npm Trusted Publisher setup has been completed externally.

## Acceptance Boundary

- `PR Quality` workflow uses a release-compatible Node runtime consistently.
- Browser Gate avoids unnecessary repeated Playwright browser downloads where cache hits are possible.
- Local workflow validation passes for the changed workflow file(s).
- The resulting plan includes explicit next-step GitHub Actions speed recommendations beyond this minimal patch.
