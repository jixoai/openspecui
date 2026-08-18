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
Tests       1155 passed (1155)
```

The normal static gates pass for this correction: Web typecheck, touched-file oxlint, Prettier check,
`openspec validate restore-cli-apply-progress-surface --strict`, and `git diff --check`.

## Delivery Evidence

The correction was delivered and released after the implementation gates:

- PR #242 (`843c3f4e`) merged the source and change-document correction.
- Changesets PR #243 (`e49ddc47`) merged the release versioning commit (`8278f639`).
- Release workflow `32174103465` completed successfully.
- Published package versions are `9.0.2` for `openspecui`, `@openspecui/core`, `@openspecui/search`,
  `@openspecui/server`, and `@openspecui/web`.
- The `openspecui@9.0.2` GitHub Release is published, and the five corresponding `9.0.2` tags exist on `origin`.
- The isolated tarball install, CLI version/help, daemon start/stop, production build, and asset checks passed.
- The local Vite+ pre-commit hook still cannot run because the repository has no `staged` configuration in
  `vite.config.ts`; after the explicit validation and diff checks above, this documentation-only commit uses
  `--no-verify` for the same known environment limitation recorded by prior OpenSpec work.

This evidence records delivery only; it does not convert automated evidence into Owner browser/App acceptance.

## Remaining Boundary

Owner browser/App walkthrough and archive disposition remain open and are intentionally not claimed by this artifact.

Whole-row cross-route cache unification is intentionally not claimed: the two routes currently reuse the typed CLI
Change-list subprojection but retain distinct outer projection identities. A canonical Change Inventory projection is
a separately approved follow-up, not a browser-cache alias.
