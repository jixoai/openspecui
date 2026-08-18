<!--
Orthogonal intents (updated 2026-08-18 Asia/Shanghai):
1. Track the ordered correction gates.
2. Make the CLI-vs-tracked source boundary executable.
3. Separate implementation evidence from Owner release/acceptance.

Original request (2026-08-18): restore `Applying`, CLI n/m, and approximate progress.
-->

## Correction Gates

- [x] 1. Capture the user's regression and the CLI-vs-tracked source boundary.
- [x] 2. Reproduce the regression with a red focused test using CLI `31/33` and tracked `1/100`.
- [x] 3. Restore `Applying` phase precedence from CLI completed-task evidence.
- [x] 4. Restore CLI `completed/total` and proportional Change List/Dashboard row signals.
- [x] 5. Restore CLI-only ReadonlyKanban count/bar projection without a tracked fallback.
- [x] 6. Add positive, divergent-source, and missing-evidence regression coverage.
- [x] 7. Run focused Web tests: Change List, Dashboard, ChangeRow, ReadonlyKanban.
- [x] 8. Run Web format, lint, typecheck, and the broader Web test lane.
- [ ] 9. Owner performs the final browser/App walkthrough and decides archive disposition.

## Stop Rules

- Stop if any implementation-progress UI reads `trackedTaskProgress` as its source.
- Stop if `Planning Complete` is used to claim Apply completion or archive/release readiness.
- Stop if a separately admitted Status projection hides already available CLI Apply evidence behind `Unknown`.
- Stop if an attempted Dashboard/Change List cache optimization copies between unequal projection identities instead
  of introducing a reviewed canonical inventory contract.
- Stop before archiving until the Owner accepts the remaining gate.

## Delivery Record

- PR #242 merged: `843c3f4e`.
- Changesets release PR #243 merged: `e49ddc47` (version commit `8278f639`).
- Release workflow `32174103465`: `success`.
- npm and GitHub Release published at `9.0.2`; the five package tags are present on `origin`.
- Remaining gate is Owner-only: browser/App walkthrough, then the explicit archive decision.
