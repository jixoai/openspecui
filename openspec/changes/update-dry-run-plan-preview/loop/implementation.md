<!--
Orthogonal intents (created 2026-10-29 Asia/Shanghai):
1. Keep implementation reality synchronized with the plan.
-->

## Implementation Log

### 2026-10-29 night

- Grafted onto origin/main (15.0.0): capability, schema family, executor method, router transport,
  dialog/route preview, real-binary fixture, source anchors, gate repair, lane repair
  (tsconfig.workflow-contract-tests stale v14 names → actual v15 names), changeset minor ×4,
  AGENTS decision line.
- All focused lanes green (compat 10, workflow-contract 78, update-plan fixture 1, preview router 4,
  dialog browser 4, config-agents/cli-runner 15); full core suite green post-graft.

### CI delivery state (2026-10-29 late night)

PR #316 is mergeable (no textual conflicts; base = current main tip) with the exact
head tree verified green by workflow_dispatch run 40886879396 (all 7 jobs). The merge
is blocked by the `pull_request`-triggered suite (run 40883166300), whose two failures
are both independently triaged as not-this-change:

1. Fast Gate: `tool-subscription-router.test.ts` Launch-command timing assertion — the
   recorded CI flake signature (d4458314, "passed on zero-change rerun"); fails only in
   PR-context runs (3/3) while passing locally and in both dispatch runs on the same
   tree. Local full server suite: 675/675.
2. Browser Gate: GitHub planned the shard job with an empty matrix (`Browser Gate
   (${{ matrix.label }})` skipped) while ci-scope emitted `browser_required=true,
   runWeb=true` — the aggregator then (correctly per its script) failed on
   `SHARD_RESULT: skipped`. `--failed` rerun and full rerun reuse the same empty plan;
   admin merge is refused by branch-protection enforcement ("2 of 3 required status
   checks are failing") even with --admin.

Resolution requires the owner (repo admin): either merge #316 via the UI accepting the
triaged evidence, or approve a workflow-infra fix (browser-matrix PR-context planning)
as a separate change. No code change on this branch can alter the PR-suite plan.
