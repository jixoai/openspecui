<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Track only implementation evidence accepted after the PR #208 rewrite.
2. Separate contract, presentation, Operator, and delivery slices.
3. Keep superseded evidence and final owner acceptance explicit.

Owner decision (2026-07-28): implement the reviewed Kanban rewrite.
-->

## Current State

Status: **implementation complete through focused evidence; delivery gates pending**.

The contributor implementation at commits `5def094` and `9763458` is characterization input only. Its old
frontend-only completion claims, lifecycle names, helper tests, SSG registration evidence, and green-gate counts
are superseded by the 2026-07-28 fixed-point review.

## Slice Evidence

### A. Projection contract

- [x] Shared archive-time/range helper is implemented and tested in browser-safe Core.
- [x] Dashboard Summary carries exact tracked-task phase counts and bounded recent archives.
- [x] Server and static providers derive the same contract without extra live Adapter I/O.

### B. Shared readonly presentation

- [x] Objective lane model and `ReadonlyKanban` are implemented with motion continuity.
- [x] Dashboard Workflow Progress is replaced; Dashboard Active Changes remains.
- [x] Static `/board` uses the same readonly projection and route manifest.

### C. Interactive Operator surface

- [x] Change Detail and Board use one `useChangeOperatorLauncher`.
- [x] Board exposes Apply/Archive icon commands and archive drag as launcher-only behavior.
- [x] Active and archive regions preserve independent loading, updating, retained-error, row-error, and
      progressive evidence.
- [x] DnD uses `DataTransfer` identity and current-row lookup; no module-global payload exists.

### D. Delivery

- [x] Focused typed tests and component fixture tests pass.
- [x] Clean SSG build and strict Change validation pass.
- [ ] Full repository gates pass and PR #208 is pushed for owner acceptance.
- [ ] Owner visual acceptance recorded before archive or merge.

## Focused Evidence (2026-07-28)

```text
Core dashboard-display                 1 file / 5 tests
Server summary/projection              3 files / 10 tests
Web static/model/components/route      6 files / 18 tests
Web complete unit lane               164 files / 1036 tests
Core / Server / Web typecheck          passed
Focused oxlint                         0 warnings / 0 errors
```

Operator mutation resistance reached the real shared launcher: after removing both projection-current checks,
`rejects captured launch functions after their projection authority becomes stale` failed because the captured
Apply launcher returned `true`; restoring the checks made the same test pass. Board composition separately proves
that retained OPSX Status with `authority=waiting` supplies `applyCurrent=false`, while Archive retains its
independent current active-row authority.

## Local Delivery Gates (2026-07-28)

```text
format:check                            passed (41 changed files)
lint:ci                                passed (1051 files, 0 warnings/errors)
typecheck                              passed (15 workspace projects)
test:ci                                passed (378 files / 2485 tests)
test:browser:ci                        passed (74 passed / 1 skipped)
changeset:check against origin/main    passed
clean Web SSG                          passed
OpenSpec strict validation             passed
git diff --check                       passed
```

The clean SSG build retained two pre-existing non-fatal warnings: Tailwind/Lightning CSS does not recognize the
experimental `::scroll-button(*)` selector, and Vite reports an ineffective dynamic import for the shared tRPC
module. Web unit tests retained the pre-existing jsdom Canvas warning; all affected test processes exited zero.

## Loopback Triggers

- Any proposed lane requires a fact not emitted by OpenSpec CLI/projections.
- Board needs a mutation path not already owned by Compose or Archive Operator.
- Static and live modes require different classification semantics.
- A retained projection can still grant an operation after Root/projection authority is lost.
