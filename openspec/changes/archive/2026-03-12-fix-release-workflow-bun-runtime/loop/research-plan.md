## Research Findings

- The second `release.yml` run already passed the new publish-script logic up to script startup.
- Failure happened before npm publish: the runner did not have Bun available.
- The repository intentionally uses Bun to execute TypeScript release scripts.
- Official `oven-sh/setup-bun` latest release is `v2.1.3`.

## Decision & Plan (For Approval)

- Add a Bun setup step to `.github/workflows/release.yml` before the publish step.
- Keep the publish script and release workflow otherwise unchanged.
- Re-run the release workflow on `main` after merging the fix.

## Capability Impact

### New or Expanded Behavior

- GitHub release workflow will have the Bun runtime required by repository release scripts.

### Modified Behavior

- `release.yml` bootstraps Bun in addition to pnpm and Node.

## Risks and Mitigations

- Risk: action version drifts.
  - Mitigation: use the current latest tagged `oven-sh/setup-bun` release.
- Risk: another runtime dependency is still missing.
  - Mitigation: rerun the workflow immediately after merge and inspect the next failure, if any.

## Verification Strategy

- Local: format check for workflow-only diff.
- CI: PR checks should remain green.
- Real validation: merged workflow rerun must succeed on `main`.
