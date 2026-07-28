<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Track only implementation evidence accepted after the PR #208 rewrite.
2. Separate contract, presentation, Operator, and delivery slices.
3. Keep superseded evidence and final owner acceptance explicit.

Owner decision (2026-07-28): implement the reviewed Kanban rewrite.
-->

## Current State

Status: **rewrite approved; implementation reopened**.

The contributor implementation at commits `5def094` and `9763458` is characterization input only. Its old
frontend-only completion claims, lifecycle names, helper tests, SSG registration evidence, and green-gate counts
are superseded by the 2026-07-28 fixed-point review.

## Slice Evidence

### A. Projection contract

- [ ] Shared archive-time/range helper is implemented and tested in browser-safe Core.
- [ ] Dashboard Summary carries exact tracked-task phase counts and bounded recent archives.
- [ ] Server and static providers derive the same contract without extra live Adapter I/O.

### B. Shared readonly presentation

- [ ] Objective lane model and `ReadonlyKanban` are implemented with motion continuity.
- [ ] Dashboard Workflow Progress is replaced; Dashboard Active Changes remains.
- [ ] Static `/board` uses the same readonly projection and route manifest.

### C. Interactive Operator surface

- [ ] Change Detail and Board use one `useChangeOperatorLauncher`.
- [ ] Board exposes Apply/Archive icon commands and archive drag as launcher-only behavior.
- [ ] Active and archive regions preserve independent loading, updating, retained-error, row-error, and
      progressive evidence.
- [ ] DnD uses `DataTransfer` identity and current-row lookup; no module-global payload exists.

### D. Delivery

- [ ] Focused typed tests and component fixture tests pass.
- [ ] Clean SSG build and strict Change validation pass.
- [ ] Full repository gates pass and PR #208 is pushed for owner acceptance.
- [ ] Owner visual acceptance recorded before archive or merge.

## Loopback Triggers

- Any proposed lane requires a fact not emitted by OpenSpec CLI/projections.
- Board needs a mutation path not already owned by Compose or Archive Operator.
- Static and live modes require different classification semantics.
- A retained projection can still grant an operation after Root/projection authority is lost.
