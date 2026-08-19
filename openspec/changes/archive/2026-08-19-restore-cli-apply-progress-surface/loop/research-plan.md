<!--
Orthogonal intents (created 2026-08-18 Asia/Shanghai):
1. Preserve the verified root cause and red feedback loop.
2. State the phase precedence and source-of-truth boundary precisely.
3. Give the implementer file-level work and regression evidence.
4. Keep release and Owner acceptance outside the coding gate.

Original request (2026-08-18): restore `Applying`, CLI task counts, and approximate progress in Change List.
-->

## Research Findings

1. `ChangeMeta.cliTaskSummary` is still produced by the Server/CLI list projection and reaches Web rows.
2. Commit `edbe1b72` removed the `cliCompletedTasks` branch from `change-workflow-phase.ts`, removed the task
   subtitle and badge fill from `ChangeRow` callers, and removed the CLI-only Kanban counts/bar.
3. The corrective intent was valid — local tracked tasks must not masquerade as implementation progress — but the
   implementation widened it into “no list-level CLI progress,” causing the reported `Planning Complete` regression.
4. The minimal pre-fix red command was:

   ```bash
   pnpm --filter @openspecui/web exec vitest run --project unit \
     src/routes/change-list.test.tsx \
     src/components/change-row.test.tsx \
     src/components/kanban/readonly-kanban.test.tsx
   ```

   The red cases asserted that a row with CLI `31/33` and divergent tracked `1/100` must show `Applying`,
   `Tasks 31/33`, and a `93.939...%` visual fill. They failed before the source correction.

5. A second observed failure remained after that correction: both routes receive `cliTaskSummary` in their primary
   projections, then intentionally defer the independent `opsx-status-list` subscription until a row is renderable.
   The classifier nevertheless checked `!hasStatus` before CLI evidence, causing the deterministic first-frame
   sequence `Unknown -> Applying` after every document refresh.
6. The browser `subscriptionCache` is a module-local `Map`, so it cannot survive a full document refresh. This is not
   itself a missing Server cache: Dashboard Summary and Change List have distinct outer Projection Work identities
   (`dashboard-summary` and `changes-rows`), but both already join the same provenance-keyed `opsx-change-list` CLI
   projection. Their whole row snapshots are not shared, and the separately admitted Status list is intentionally a
   different projection.

## Decision & Plan

1. Extend the phase classifier with optional `cliCompletedTasks`; a known blocked artifact gate remains first, then a
   positive CLI completed count returns `Applying` before the absence of Status can return `Unknown`.
2. Restore `ChangeRow.progressRatio`, but allow it only as a caller-supplied CLI-derived ratio.
3. In Change List and Dashboard, pass CLI task counts/ratio and render the CLI `completed/total` even while the
   Status artifact fact is still loading. Never read the local tracked denominator for this surface.
4. In ReadonlyKanban, render counts and the full-variant bar only when `cliTaskSummary` exists; no fallback.
5. Lock both positive CLI evidence and absent-CLI evidence with focused tests, including divergent tracked values.
6. Keep whole-row cache unification out of this corrective slice. If cross-route reuse is required, create a
   separately approved canonical Change Inventory Projection with one explicit identity/provenance contract rather
   than copying Dashboard or Change List browser cache entries.

## Risks and Mitigations

- Risk: a future caller passes tracked progress into `progressRatio`. Mitigation: source-commented props,
  caller-level tests with divergent values, and no helper that accepts `TrackedTaskProgress`.
- Risk: `Planning Complete` is reintroduced as implementation completion. Mitigation: explicit phase precedence and
  acceptance wording that limits it to planning artifacts.
- Risk: a Status-loading placeholder masks data already present in the primary CLI Change-list projection.
  Mitigation: focused first-frame tests require `Applying` and `Tasks 31/33` before Status arrives.
- Risk: a later “shared cache” patch aliases two different projection shapes and invalidation contracts. Mitigation:
  preserve the current distinct identities until a canonical inventory contract is planned and reviewed.
- Risk: compact Kanban becomes too dense. Mitigation: retain counts in compact cards and reserve the bar for the
  existing full variant, matching the established responsive topology.

## Verification Strategy

- Focused red/green: Change List, Dashboard, ChangeRow, ReadonlyKanban unit tests.
- Static checks: `git diff --check`, Web format check, Web lint, Web typecheck.
- Broader Web test suite only after focused tests remain green.
- Release, PR, merge, package publication, Owner browser walkthrough, and archive are separate gates.
