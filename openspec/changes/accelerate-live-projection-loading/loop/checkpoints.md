<!--
Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
1. Gate the live-projection performance Change with independently reviewable work packages.
2. Preserve measurable latency, provenance, currentness, and authority requirements at every package boundary.
3. Keep final browser acceptance with the owner and prevent this Change from absorbing the active 1.6 correctness work.

Original request (2026-07-23): "请你深入调查，给出一份持有客观证据的调查报告，并给出‘系统性的解决方案’，并将它整理成 openspec change。"
-->

## 1. Research And Contract

- [x] 1.1 Capture the observed Dashboard, Changes, refresh, and pervasive-Loading symptoms without attributing a cause from UI copy alone.
- [x] 1.2 Record pinned-CLI, isolated-data-scope, controlled-input, first-payload, and phase-timing evidence in `research/2026-07-23-live-projection-evidence.md`.
- [x] 1.3 Define the Server-owned Projection Work protocol, complete identity, freshness/authority boundary, lifecycle events, and bounded resource classes.
- [x] 1.4 Record independent production owners, red/green/mutation-resistance requirements, and stop conditions for Root Context, Dashboard, Changes, and OPSX.
- [x] 1.5 Add the `live-projection-work` delta specification; strict Change validation must parse it.
- [x] 1.6 Obtain owner approval for the measured implementation order before production code begins. Owner
      explicitly requested `apply accelerate-live-projection-loading` on 2026-07-23 Asia/Shanghai.

## 2. Shared Projection Work

- [x] 2.1 Add bounded phase tracing at the subscription-to-projection boundary without creating user analytics or a second fact source.
- [x] 2.2 Implement same-identity single-flight work, current/stale display snapshots, explicit invalidation, cancellation, and generation retirement.
- [x] 2.3 Prove two same-identity subscribers share one owner work, while late Root/Store/Git A cannot publish into B.
- [x] 2.4 Define and enforce measured foreground/background concurrency and memory budgets before adding broad warmup.

## 3. Root And Page Projections

- [x] 3.1 Make a current Root Context snapshot reusable within one generation without weakening Root action readiness after refresh, failure, reconnect, or retirement. Checked Manager, Root subscription, and cold-start evidence proves one A resolution, one invalidated B resolution, no cached CLI error, and retained `refreshing` display state; mutation checks reject both removed cache sharing and ignored invalidation identity.
- [x] 3.2 Split Dashboard Summary, Git, trends, and workflow facts so a slow leaf cannot delay the first stable Summary.
- [x] 3.3 Stream Changes inventory and bounded row batches with honest progress; retain completed rows through later slow rows or terminal errors.
- [x] 3.4 Make OPSX Status demand-driven and independent from full Kernel warmup while preserving typed CLI evidence.
- [x] 3.5 Prove every package through its named production owner, exact red and green fixed points, and an unmasked mutation-resistance result.

## 4. Conditional Optimizations

- [x] 4.1 Measure content-fingerprint cost and hit rate before adding a bounded pure-projection cache.
- [x] 4.2 Measure persistence eligibility and deliberately do not add it: the controlled repeat is not a production hit rate, so no safe ROI/eviction case exists.
- [x] 4.3 Measure Worker eligibility and deliberately do not add it: Worker transfer/digest is slower than the measured main-thread work.

## 5. Verification And Delivery

- [x] 5.1 Re-run the controlled benchmark and record before/after phase distributions and event order for every implemented package.
- [x] 5.2 Run checked focused Vitest, affected component-level Playwright fixtures, format, lint, typecheck, and scoped SSG evidence where applicable. `pnpm test:ci`, `pnpm test:browser:ci`, format, lint, typecheck, SSG, and strict Change validation passed on 2026-07-23 Asia/Shanghai; Dashboard/Changes final browser acceptance remains owner-only.
- [x] 5.3 Keep the owner-only final Dashboard and Changes browser/visual walkthrough separate from automated preparation evidence.
- [ ] 5.4 Deliver implementation and matching checkpoint evidence in independently reviewable commits; do not merge, archive, or release until the owner approves.

## 6. Per-Package Evidence Contracts

These contracts are the fixed review points for 2.1-4.3. A package cannot be marked green from a downstream
handler assertion, a disabled control, or a benchmark that only happens to be faster.

### P1 Shared Projection Work

- Production owner: Server projection infrastructure at `packages/server/src/reactive-subscription.ts` and its
  Server-owned Work registry.
- Precise red: two same-identity subscribers invoke one controlled leaf twice, or retired A emits after B.
- Green: one bounded in-flight leaf is shared; each subscriber receives attributed events; A cannot publish into B.
- Mutation resistance: remove the registry join or generation-retirement transition and the corresponding red must fail.
- Stop condition: no route-local cache or unbounded scheduler without typed identity, resource budget, cancellation,
  and invalidation evidence.

### P2 Root Context Gateway

- Production owner: `PlanningRootServiceManager` and Root Context server boundary.
- Precise red: unchanged same-generation operations repeat availability/Doctor/Context resolution, or stale A is
  treated as current/authorized during B refresh.
- Green: one validation per generation; one B transition after invalidation; A remains display-only and locked.
- Mutation resistance: remove shared resolution or retirement guard and duplicate resolution/late A publication must fail.
- Stop condition: preserve operation draining, raw CLI diagnostics, dependency ownership, Store/Reference provenance,
  and Root action readiness.

### P3 Dashboard Regions

- Production owner: Dashboard overview service/router plus `use-dashboard` and Dashboard route regions.
- Precise red: `dashboard.subscribe` blocks on aggregate refresh despite a current snapshot, or slow Git/trend hides
  stable Summary.
- Green: Summary replays first; Git, trends, and workflow facts settle independently; Git B cannot relabel Git A.
- Mutation resistance: remove snapshot replay/independent Summary emission or binding-token validation and the red must fail.
- Stop condition: do not weaken Static provider or Code/Planning Git authority to improve perceived loading.
- Delivery proof: focused Server service/router and Web hook/route tests pass; Summary is admitted before Trends,
  Git scope/Git, and OPSX. Removing the Git binding token from the Work identity returns A under B and fails the
  exact service fixed point.

### P4 Changes Batches

- Production owner: Change router, planning-root adapter/document projection, and Change List route.
- Precise red: one controlled slow row prevents earlier rows from reaching the client, or unknown totals become fake percentages.
- Green: bounded batches and honest `{ completed, total | unknown }` progress render earlier rows and preserve partial errors.
- Mutation resistance: remove batch emission or unknown-total handling and the corresponding fixed-point test must fail.
- Stop condition: list rows remain name/task/time only; Status, detail, Apply, and artifact work stay on demand.
- Delivery proof: focused Server service/router and Web hook/route tests pass; first row and honest progress emit
  before a pending later row. Fixing the Work generation returns A rows under B and fails the exact service fixed
  point.

### P5 OPSX Demand Planner

- Production owner: `OpsxKernel` and OPSX router fetch/subscription functions.
- Precise red: slow Apply/artifact work behind `waitForWarmup()` blocks Status List first delivery.
- Green: typed Status arrives independently; lazy leaves retain full CLI evidence and settle separately.
- Mutation resistance: restore Status warmup dependency or remove lazy Work identity and status-before-Apply/evidence tests must fail.
- Stop condition: never trade CLI incompatibility, Store selector, diagnostics, or planning-root provenance for a fast empty list.
- Delivery proof: focused Core/Router/Web tests pass; the real Kernel delivers Status while `waitForWarmup()` never
  settles and retains the typed evidence envelope. Restoring the warmup await to the real Status method fails the
  exact 250ms fixed point.

### P6 Hash/Worker Optimization

- Production owner: Core projection primitives, only after P1-P5 establish the measured bottleneck.
- Precise red: path-only/scoped cache reuses different content, Root/Store, selector, version, or sensitive authority;
  hash/Worker overhead exceeds saved work.
- Green: equivalent versioned non-sensitive input hits within bounds; changed input misses; disabling optimization preserves correctness.
- Mutation resistance: remove one fingerprint/provenance component and the cross-input miss test must fail.
- Stop condition: record “no optimization adopted” when ROI, sensitivity, eviction, or Worker resource proof is negative.
- Delivery decision: metadata/content fingerprint timing is deterministic for controlled repeats but lacks a
  production persistent-cache hit rate; Worker digest plus transfer is slower than main-thread hashing. No
  persistent cache or Worker pool is adopted.
