## Research Findings

- `Browser Gate` is still the longest PR quality job after adding Playwright cache because the dominant cost is the browser tests themselves.
- The root browser command already consists of two independent parts: `pnpm --filter xterm-input-panel test:browser` and `pnpm --filter @openspecui/web test:browser:ci`.
- Those two browser suites do not depend on each other and can run on separate runners.
- Directly renaming the protected `Browser Gate` job would risk branch-protection drift.
- GitHub Actions allows a dependent aggregate job to preserve the required status-check name while upstream shard jobs run in parallel.

## Decision & Plan (For Approval)

- Replace the single `quality-browser` execution path with a matrix shard job that runs one package browser suite per runner.
- Add a lightweight aggregate job named `Browser Gate` that depends on all browser shards and succeeds only when every shard succeeds.
- Keep the existing skip behavior for changeversion PRs at the step level so checks remain present and green when intentionally bypassed.
- Re-run the full local CI-equivalent checks, open a PR, wait for checks, archive the loop, and merge.

## Capability Impact

### New or Expanded Behavior

- PR browser validation can execute `xterm-input-panel` and `@openspecui/web` browser suites concurrently.

### Modified Behavior

- `Browser Gate` becomes an aggregate success check over multiple browser shard jobs instead of a single monolithic execution job.

## Risks and Mitigations

- Risk: changing the job graph breaks required status checks.
  - Mitigation: preserve `Browser Gate` as the aggregate job name and keep the shard names additive.
- Risk: duplicated setup/install on two runners reduces the expected gain.
  - Mitigation: the current dominant bottleneck is test execution; shard parallelism still improves wall-clock latency even if compute minutes rise.
- Risk: matrix/needs semantics mark the aggregate job incorrectly.
  - Mitigation: use a dedicated aggregate job that validates the shard result explicitly.

## Verification Strategy

- Workflow parse validation for `.github/workflows/pr-quality.yml`.
- Local repository validation: `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, `pnpm test:browser:ci`.
- CI acceptance: shard jobs and the aggregate `Browser Gate` must all pass on the PR.
