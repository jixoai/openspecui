## Research Findings

- `.github/workflows/pr-quality.yml` still pins Node 20 in `Changeset Gate`, `Fast Gate`, and `Browser Gate`, while the repaired release workflow already runs on Node 24.
- Recent release-fix work showed Node 24 is the safer baseline for npm Trusted Publishing and removes the current PR warning noise caused by older runner setup.
- `Browser Gate` is the slowest job in the PR workflow and currently performs a fresh Playwright browser install on every run.
- The browser install step downloads Chromium for both `@openspecui/web` and `xterm-input-panel`, but both installs target the same Playwright browser cache location on the runner.
- `actions/setup-node` already caches the pnpm store, so the next low-risk missing cache is the Playwright browser cache.
- The `openspecui` npm package Trusted Publisher gap has been fixed outside the repository, so no code-side release change is required for that point.

## Decision & Plan (For Approval)

- Update all jobs in `.github/workflows/pr-quality.yml` from Node 20 to Node 24 for runtime consistency with release and to remove obsolete warnings.
- Add an explicit `actions/cache@v4` step for `~/.cache/ms-playwright` in `Browser Gate`, keyed by OS plus the lockfile and workflow file.
- Keep the existing test matrix and install commands unchanged so the loop stays low risk and easy to validate.
- Run local workflow validation plus focused repository checks, then prepare the branch for PR submission.

## Capability Impact

### New or Expanded Behavior

- PR browser jobs can reuse previously cached Playwright browsers across workflow runs.

### Modified Behavior

- PR quality jobs run on Node 24 instead of Node 20.

## Risks and Mitigations

- Risk: Playwright cache key is too coarse and reuses stale browsers.
  - Mitigation: include `pnpm-lock.yaml` and the workflow file in the cache key so dependency/runtime changes naturally invalidate the cache.
- Risk: Node 24 changes job behavior unexpectedly.
  - Mitigation: keep the diff workflow-only, align with the already-working release runtime, and validate the workflow file locally.
- Risk: cache restore adds complexity without material gains on cold runners.
  - Mitigation: this is confined to one cache step in the slowest job; if it underperforms, it is trivial to revert independently.

## Verification Strategy

- Workflow validation: parse/validate the updated `.github/workflows/pr-quality.yml` locally.
- Repository checks: run `pnpm format:check` and a targeted check against the touched files.
- CI acceptance: PR `Changeset Gate`, `Fast Gate`, and `Browser Gate` must pass with the workflow-only diff.
- Outcome review: compare subsequent Browser Gate timing to the prior baseline and use that data to decide whether a second loop should split or skip browser jobs.
