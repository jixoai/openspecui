## Research Findings

- The repository already uses Changesets with linked package versioning in `.changeset/config.json`.
- `scripts/changeversion-auto.ts` already automates the version PR lifecycle up to merge-back-to-main.
- `@changesets/cli@2.29.8` uses the workspace package manager publish command. In this repository that resolves to `pnpm publish` for each package.
- npm Trusted Publishing with GitHub Actions requires an Actions workflow plus `id-token: write` permission and a matching workflow filename/environment.
- Official `changesets/action` documentation includes a tokenless npm publishing configuration for trusted publishing.
- Current local vs npm state shows a real unpublished package candidate: `@openspecui/web@2.1.0` exists locally while npm latest is `2.0.1`.
- Current branch worktree only contains `.gitignore` and this OpenSpec change scaffold.

## Decision & Plan (For Approval)

- Add `.github/workflows/release.yml` using npm Trusted Publishing with `id-token: write`, `contents: write`, and environment `npm-release`.
- Trigger release workflow from `main` pushes and `workflow_dispatch`.
- Keep `changeset version` on the manager-driven changeversion PR flow; run publish only on GitHub after merge.
- Update local automation and docs so the manager flow points to GitHub release automation instead of local OTP publishing.
- Run CI-equivalent local checks before opening or updating the PR.
- Use the first eligible unpublished package set as the real validation target for the workflow.

## Capability Impact

### New or Expanded Behavior

- GitHub Actions becomes the authoritative npm publish executor.
- Release automation can publish without interactive OTP on a maintainer workstation.

### Modified Behavior

- Local `pnpm release` behavior must align with GitHub-based publishing expectations.
- `.DS_Store` ignore scope expands from `packages/` only to repository-wide.

## Risks and Mitigations

- Risk: Trusted publishing may fail if workflow filename or environment mismatches npm configuration.
  - Mitigation: hard-code `release.yml` and `npm-release` to match the configured publisher records.
- Risk: Changesets publish may require environment shaping for provenance or registry auth.
  - Mitigation: follow npm and Changesets trusted publishing guidance and validate with an actual publish run.
- Risk: Release workflow could run on every `main` push without publishable diffs.
  - Mitigation: gate publish on Changesets status / unpublished package detection and make no-op runs explicit.

## Verification Strategy

- Local: `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, `pnpm test:browser:ci`.
- Workflow: validate `release.yml` syntax and release script behavior locally where possible.
- Real validation: merge PR, allow `release.yml` to run on `main`, and confirm npm publish success for pending package versions.
