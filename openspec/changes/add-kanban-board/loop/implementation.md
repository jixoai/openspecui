<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Track only implementation evidence accepted after the PR #208 rewrite.
2. Separate contract, presentation, Operator, and delivery slices.
3. Keep superseded evidence and final owner acceptance explicit.

Owner decision (2026-07-28): implement the reviewed Kanban rewrite.
-->

## Current State

Status: **live Board scroll correction specified; implementation pending**.

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
- [x] Full repository gates pass and PR #208 is pushed for owner acceptance.
- [ ] Owner visual acceptance recorded before archive or merge.

### E. Container-responsive correction

- [x] `ReadonlyKanban` owns its inline-size container and renders `1`, `2`, or `4` columns from container width.
- [x] Horizontal scrolling, auto-column flow, and viewport-responsive layout are absent from the readonly surface.
- [x] Focused component tests lock the topology before updated package gates and PR delivery are recorded.

The fixed-point test first failed only because the production root did not contain `@container` (`1 failed / 1
passed`). The implementation then introduced a self-owned container plus `grid-cols-1`,
`@[32rem]:grid-cols-2`, and `@[64rem]:grid-cols-4`; the same focused file passed `2/2`. The grid no longer contains
`overflow-x-auto`, auto-column sizing, column flow, or viewport breakpoint classes. Explicit test cleanup was added
because the new second case exposed retained DOM from this file's prior single-test setup.

### F. Live Board scroll ownership correction

- [x] The production boundary is split between the bounded live route, the single inline-scrolling lane grid, and
      four independently block-scrolling lane bodies.
- [ ] Focused tests fail against the old unbounded route/grid/lane structure for the named ownership reason.
- [ ] The live flex/min-size chain and scrollbar presentation are implemented without changing static
      `ReadonlyKanban`.
- [ ] Focused and delivery evidence is recorded before the owner repeats final visual acceptance.

Updated delivery evidence:

```text
focused ReadonlyKanban unit             1 file / 2 tests
format:check                            passed (4 changed files)
lint:ci                                passed (1051 files, 0 warnings/errors)
typecheck                              passed (15 workspace projects)
test:ci                                passed (378 files / 2486 tests)
clean Web SSG                          passed
compiled container CSS                 32rem two-column / 64rem four-column rules present
changeset:check against origin/main    passed
OpenSpec strict validation             passed
git diff --check                       passed
```

The existing non-fatal jsdom Canvas, experimental `::scroll-button(*)`, and ineffective dynamic-import warnings
remain unchanged. Per owner acceptance law, no Agent visual or end-to-end browser walkthrough was performed; the
updated PR's remote browser gates remain delivery evidence rather than owner acceptance.

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

## Remote Delivery Evidence (2026-07-28)

```text
PR                                      #208 (open)
implementation head                     f601d838d292a85ae370c4973677e4d759784540
workflow run                            30359973780
Changeset Gate                          passed
CI Scope                                passed
Fast Gate                               passed
Browser Gate (@openspecui/web)          passed
Browser Gate (xterm-input-panel)        passed
aggregate Browser Gate                  passed
```

The implementation head was fast-forwarded to both the maintainer branch and the contributor fork branch. GitHub
completed every required check successfully. This automated evidence closes delivery checkpoint 5.3 only; it does
not replace the owner's final visual and real-browser walkthrough.

## Container-responsive Remote Evidence (2026-07-28)

```text
PR                                      #208 (open)
responsive implementation head          d7dd472c4b68f59602ef469c8d28591480e3a289
workflow run                            30363350067
Changeset Gate                          passed
CI Scope                                passed
Fast Gate                               passed
Browser Gate (@openspecui/web)          passed
Browser Gate (xterm-input-panel)        passed
aggregate Browser Gate                  passed
```

The responsive implementation head was fast-forwarded to both the maintainer branch and contributor fork. These
checks close checkpoint 5.6 only; final visual and real-browser acceptance remains owner checkpoint 5.7.

## Loopback Triggers

- Any proposed lane requires a fact not emitted by OpenSpec CLI/projections.
- Board needs a mutation path not already owned by Compose or Archive Operator.
- Static and live modes require different classification semantics.
- A retained projection can still grant an operation after Root/projection authority is lost.
