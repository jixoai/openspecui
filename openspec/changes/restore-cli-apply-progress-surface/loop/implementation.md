<!--
Orthogonal intents (updated 2026-08-18 Asia/Shanghai):
1. Record the exact implementation correction and its evidence.
2. Preserve the distinction between CLI implementation truth and local analytics.
3. Keep Owner release and browser acceptance as explicit remaining gates.

Original request (2026-08-18): restore list-level CLI Apply progress after the v9 regression.
-->

## Current State

The correction is implemented in the working tree.

### Source changes

- `packages/web/src/lib/change-workflow-phase.ts`
  - restores `Applying` when CLI completed task evidence is positive, even before aggregate Status arrives;
  - keeps a known blocked artifact state ahead of Apply and keeps `Planning Complete` planning-only.
- `packages/web/src/components/change-row.tsx`
  - restores an optional CLI-derived proportional badge fill.
- `packages/web/src/routes/change-list.tsx`
  - restores CLI `Tasks completed/total` evidence and passes the CLI ratio/phase input;
  - retains the CLI task fact beside the Status-loading skeleton instead of rendering `Unknown` alone.
- `packages/web/src/routes/dashboard.tsx`
  - mirrors the same source-attributed behavior in Active Changes before the separately admitted Status list returns.
- `packages/web/src/components/kanban/readonly-kanban.tsx`
  - restores CLI counts and the full-card progress bar only when CLI evidence exists; no tracked fallback.

### Regression tests

- Change List: positive CLI `31/33` plus divergent tracked `1/100` renders `Applying`, `Tasks 31/33`, and the
  proportional fill; missing CLI evidence remains silent.
- Dashboard: the shared Active Changes row preserves the same contract.
- Dashboard and Change List: a first frame with CLI `31/33` but no aggregate Status must be `Applying`, not
  `Unknown`, and must still expose `Tasks 31/33`.
- ChangeRow: fill is present only for an explicit ratio.
- ReadonlyKanban: CLI counts/bar render when present and tracked values never backfill.

## Evidence

Focused verification passes:

```text
Test Files  4 passed (4)
Tests       45 passed (45)
```

The broader Web unit lane also passes:

```text
Test Files  188 passed (188)
Tests       1154 passed (1154)
```

The normal static gates pass for this correction: Web typecheck, touched-file oxlint, Prettier check,
`openspec validate restore-cli-apply-progress-surface --strict`, and `git diff --check`.

## Remaining Boundary

No package publish, merge, archive, or Owner browser/App walkthrough is claimed by this artifact.

Whole-row cross-route cache unification is intentionally not claimed: the two routes currently reuse the typed CLI
Change-list subprojection but retain distinct outer projection identities. A canonical Change Inventory projection is
a separately approved follow-up, not a browser-cache alias.
