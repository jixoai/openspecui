<!--
Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
1. Keep implementation reality synchronized with the approved live-projection performance plan.
2. Preserve the boundary between display continuity and mutation authority while performance work is staged.
3. Record worker entry conditions, deliberate non-goals, and loopback triggers for independent slices.
4. Record P1-P6 implementation and checked evidence without overstating owner-only browser acceptance.

Original request (2026-07-23): "请你深入调查，给出一份持有客观证据的调查报告，并给出“系统性的解决方案”，并将它整理成 openspec change。"
-->

## Implementation State

- Research and controlled baseline measurement are complete. P1 Shared Projection Work, P2 Root Context reuse,
  P3 Dashboard regions, P4 progressive Changes, and P5 demand-driven OPSX are implemented on their named
  Server and Web owners.
- Five read-only benchmark files under `packages/server/bench/` capture the current Server, Root Context,
  Dashboard, Changes, and OPSX paths. The evidence report records the pinned CLI, isolated data scope,
  input inventory, commands, phase timings, and limitations.
- The measured problem is a server-side projection critical path, not a browser spinner problem: same-Server
  Dashboard reload is about 8.84s while an already-cached Dashboard snapshot reads in about 0.12ms; OPSX
  Status waits on a full Kernel warmup even though Status does not require its low-priority artifacts.
- The applied execution order is P1 observation/resource scheduling, P2 Root Context current-snapshot gateway,
  P3 Dashboard regions, P4 Changes batch stream, P5 OPSX demand planning, then P6 measured hash/Worker review.
  P6 deliberately adopts neither persistence nor Workers because its measured ROI gate is negative. Each phase
  remains independently reviewable.
- This artifact is planning evidence only. The worker must not claim a phase complete until its checkpoint has
  a checked red case, green case, mutation-resistance proof, and recorded verification evidence.

## P1 Delivery (2026-07-23 Asia/Shanghai)

- The owner approved the measured execution order by explicitly requesting
  `apply accelerate-live-projection-loading` before production work began.
- `packages/server/src/projection-work/` now contains the typed Work identity and lifecycle protocol, a bounded
  phase-only ring trace, a foreground/background scheduler, same-identity registry, LRU snapshot eviction, and
  a Server-local typed runtime pool. Existing `createReactiveSubscription()` and
  `createReactiveProjectionSubscription()` retain their current raw-payload contracts.
- Snapshot freshness is explicit: a current snapshot may replay; a dormant, invalidated, or replacement snapshot
  becomes `stale-display-only`. The registry guards every loader stage, batch, snapshot, cache write, completion,
  and failure by its current controller plus Work generation.
- Initial runtime budgets are intentionally conservative: CLI/filesystem/Git/CPU each have one slot; each typed
  owner registry has at most 32 snapshots and 2MiB; a Server has at most eight registries (16MiB aggregate
  snapshot ceiling), 64 Work identities per registry, and a 256-entry payload-free phase trace. No broad warmup
  uses this scheduler yet.
- Checked green evidence: `pnpm --filter @openspecui/server exec vitest run src/reactive-subscription.test.ts
src/projection-work/registry.test.ts src/projection-work/runtime.test.ts src/projection-work/scheduler.test.ts`
  (12 tests) and `pnpm --filter @openspecui/server exec tsc -p tsconfig.transport-tests.json --noEmit`.
- Exact red baseline: two identity-less `createReactiveProjectionSubscription()` subscribers invoked the same
  controlled leaf twice (`expected 2 to be 1`) before the new registry was used.
- Mutation resistance: bypassing registry lookup made the shared-work fixed point observe `leafCalls: 3` instead
  of `1`; bypassing `isCurrentRun` made the A-to-B fixed point observe `['A', 'B']` instead of `['B']`.
  A controller-only mutation stayed green because the generation equality still rejected A, so it was explicitly
  rejected as insufficient mutation evidence.

## P2 Root Context Gateway Delivery (2026-07-23 Asia/Shanghai)

- `PlanningRootServiceManager` now records the complete runtime invalidation identity
  `project + stores + context` before every resolution. A successful Root Context snapshot replays only while
  that exact identity and the active service record still match; CLI-owned error states never enter the cache.
- Every reactive cache hit still calls `trackRootContextDependencies()`, so each subscriber retains the current
  launch config, resolved-root config, Store registry, and runtime invalidation dependencies. A changed token
  clears the ready snapshot before resolving B; a token change during CLI work prevents A from being cached under
  B. The Root Context subscription continues to own the `refreshing` display snapshot, while mutation authority
  remains governed by the existing current-ready Root action gate.
- Checked exact red: before the gateway, two same-generation Manager operations called
  `checkAvailability`, `doctorRoot`, and `context` twice (`expected ... once, but got 2 times`).
- Checked green: `planning-root-service.current-snapshot.test.ts` proves one successful resolution for two
  same-generation operations, two reactive subscribers that each retain dependencies and jointly resolve exactly
  one B after invalidation, and immediate re-resolution after a CLI-owned error. Existing Manager lifecycle,
  stream/lease, Root subscription, and cold-start integration tests also remain green.
- Mutation resistance: disabling the cache-hit branch restored two CLI resolutions; bypassing invalidation-key
  matching prevented the B fixed point from converging. Both mutations failed before the source was restored.
- The real Server benchmark now observes one cold acquisition followed by current-snapshot replays:
  `3098.53ms`, `16.79ms`, and `0.07ms` for three same-root reactive attempts. This is machine/input-sensitive
  evidence, not a latency SLO and not evidence that Dashboard, Changes, or OPSX have migrated yet.

## P3 Dashboard Regional Delivery (2026-07-23 Asia/Shanghai)

- `DashboardProjectionService` owns separate Summary, Trends, and Code Git Work registries. Their identity retains
  Planning-root provenance, generation, and, for Git, the Code binding token. Router subscriptions bridge each
  region independently; a legacy aggregate reader composes only when all three current data values exist.
- `dashboard-summary.ts`, `dashboard-trends.ts`, and `dashboard-git-projection.ts` keep first-screen planning
  facts, optional historical calculations, and Code Git work in separate physical loaders. Summary no longer
  awaits Trends, Git, or OPSX facts.
- The Web hook subscribes Summary first. Only after Summary has display data does it admit Trends and Git; the
  Dashboard route then admits Git scope, OPSX Config Bundle, and OPSX Status List. Cached regional snapshots
  remain display-only during revalidation and cannot change Git or Root mutation authority.
- Exact green: a deferred Git leaf cannot prevent Summary delivery; the Web hook records no Trends/Git subscribe
  before Summary. Mutation resistance: replacing the Git binding identity with `null` made B return cached A;
  source was restored and the focused service/hook/router suite passed.

## P4 Progressive Changes Delivery (2026-07-23 Asia/Shanghai)

- `ChangesProjectionService` owns a generation-bound Work identity and maps inventory ids into bounded row batches.
  A completed row emits immediately with `{ completed, total }`; a later failure emits a row error while completed
  rows survive to the terminal snapshot.
- Router exposes the batch stream, `useChangesSubscription` retains rows and explicit progress, and `ChangeList`
  keeps row continuity plus a regional refresh/error state. It starts aggregate Status only after a primary row
  exists, so Status/Apply detail work cannot hold the list blank.
- Exact green: a deliberately pending second row leaves the first row visible; B generation owns B rows only.
  Mutation resistance: fixing the generation component of the Work identity made B return A rows; source was
  restored and the focused service/router/Web suite passed.

## P5 OPSX Demand Delivery (2026-07-23 Asia/Shanghai)

- `OpsxKernel.ensureStatusList()` starts only the Change-id inventory and per-Change typed Status leaves. It no
  longer waits for Schema, Apply Instructions, Artifact Instructions, or Artifact Output warmup. Those leaves stay
  independent, lazy operations with their original typed CLI evidence envelope.
- Router Status and Apply endpoints preserve command, stdout, stderr, exit status, diagnostics, selector, and
  root provenance. Web `useOpsxStatusListSubscription()` and `useOpsxConfigBundleSubscription()` accept explicit
  route admission without changing their default behavior for routes that need them immediately.
- Exact green: the real Kernel completes Status while its `waitForWarmup()` stub never settles. Mutation resistance:
  adding that await back to `ensureStatusList()` makes the exact test time out at 250ms. A Router mock did not
  exercise the real Kernel and is explicitly excluded from mutation proof.

## P6 Conditional Optimization Decision (2026-07-23 Asia/Shanghai)

- `projection-fingerprint-roi.bench.ts` measured 366 files / 3.0MB. Full content SHA-256 costs 63ms..269ms,
  while the Worker digest costs 710ms including structured-clone transfer; Markdown task projection itself costs
  less than 2ms in the sample.
- The 4/4 controlled repeated input matches establish deterministic measurement only, not a production-safe
  persistent-cache hit rate. No persistence, content hash cache, or Worker pool is added. Existing bounded
  Server snapshots and reactive invalidation remain the adopted system.

## Decisions Taken

- Use one Server-owned `Projection Work` protocol instead of route-local caches. A Work identity includes
  projection kind, planning-root identity/source, effective Store selector, owner generation or Git binding
  token where applicable, explicit selector, input fingerprint or invalidation generation, and protocol version.
- Share same-identity in-flight work and replay only a verified snapshot. Every snapshot carries provenance
  and freshness; stale or reconnecting data can remain visible but cannot authorize a mutation.
- Emit real `snapshot`, `stage`, `batch`, `complete`, and `failed` events with monotonic Work generation.
  Retired Root/Store/Git A work cannot publish to, invalidate, or relabel B.
- Treat Root Context currentness as a gateway. Same-generation reads reuse one validated resolution; refresh,
  invalidation, or root retirement creates the next generation and retains the existing action gate.
- Split Dashboard Summary, Git, trends, and workflow facts; stream Changes rows in bounded batches; make OPSX
  Status independent of full Kernel warmup. These are separate ownership and acceptance surfaces, not one
  aggregate loading flag.
- Keep memory caches bounded and invalidated by explicit reactive causes. Content hashing, persistence, and
  Workers remain conditional optimizations: they require measured ROI, non-sensitive revalidation, and bounded
  I/O/CPU resource classes before entering production.
- Preserve the existing Push invalidation -> Pull projection model, typed CLI evidence envelopes, Static-mode
  unavailable contracts, checked test fixtures, and the owner-only final end-to-end browser walkthrough.

## Divergence Notes

- The intake suggested a broad family of optimizations. The measured plan intentionally starts with shared
  projection ownership and demand separation; it does not add persistence, Worker threads, or an App-wide
  cache without evidence that the preceding slice leaves them as the dominant cost.
- Benchmark timings are controlled observations for the current workspace and pinned OpenSpec CLI, not CI
  pass/fail thresholds. Before/after comparison must report phase distributions and event order as well as
  wall-clock values.
- No existing active Change is modified or folded into this performance Change. Any Root, Git, Static, Store,
  or WebSocket contract change discovered during implementation must be recorded as a new scoped decision or
  looped back before code work continues.
- `pnpm exec openspec status --change accelerate-live-projection-loading --json` reports all four declared loop
  artifacts complete and `applyRequires: ["checkpoints"]`. The formal `specs/live-projection-work/spec.md`
  delta is present, so `pnpm exec openspec validate accelerate-live-projection-loading --type change --strict --json`
  passes. This validates the Change artifacts only; it does not claim runtime implementation.
- An earlier benchmark-specific TypeScript attempt reached unrelated Server diagnostics, but the final current
  workspace gate `pnpm typecheck` passes. There is no typecheck exemption for this Change.
- A serial recheck on current `e131b68` is recorded in the evidence report. It observes four active Changes and
  confirms Dashboard `7.40s` cold / `4.36s` reload, Changes `15.16s`, Status `13.50s`, direct Dashboard loader
  `1.28s`, cached `getCurrent()` `0.08ms`, and Kernel warmup `8.69s`. The earlier three-Change baseline remains
  historical evidence; both samples point to the same server-side orchestration and repeated Root/Warmup path.

## Loopback Triggers

- A proposed Work key cannot prove Root/Store/Reference/Git provenance, or a late A event can reach B state,
  cache, progress, or mutation authority.
- A current-snapshot shortcut weakens the Root action gate, hides CLI/transport evidence, or makes stale data
  look current during refresh, reconnect, or error.
- Resource limits cannot be expressed for CLI, filesystem, Git, or Worker work, or a benchmark shows that
  concurrency increases tail latency, starvation, or memory beyond the declared budget.
- OPSX Status still needs full warmup under the pinned CLI, or a lazy leaf loses raw stdout/stderr, exit,
  diagnostics, Store selector, or planning-root provenance.
- A focused red case does not fail at the named production boundary, a mutation-resistance proof is masked by
  an earlier guard, or a fixture relies on `as any`, fabricated non-null state, or transpile-only type evidence.
- Static export, unrelated active Changes, App multi-project orchestration, or final browser acceptance would
  need to be changed to make a phase appear green; stop and obtain a separately scoped decision.

## Final Automated Verification (2026-07-23 Asia/Shanghai)

- The Root Context snapshot correction preserves the established Project Binding settlement boundary: a
  successful launch write advances `project/context` invalidation before its detached preview, and only reactive
  operations can save a reusable Root snapshot. An imperative operation still confirms the CLI-selected root but
  cannot seed a later reactive replay. The checked Project Binding fixture keeps A visible while A's lease drains,
  then exposes B; the Git Router fixture proves a Code refresh invalidates only the Dashboard Git region.
- Focused Server evidence passed: `git-repository-binding-router.test.ts`,
  `git-repository-binding-service.test.ts`, `planning-config-router.test.ts`, and
  `planning-root-service.current-snapshot.test.ts` (26 tests across the two focused invocations).
- Required local gates passed: `pnpm test:ci` (including Core 449, Server 459, Web 914, and CLI 49 tests),
  `pnpm test:browser:ci` (xterm-input-panel 60 passed / 1 skipped; Web Storybook 12 passed),
  `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`,
  `pnpm --filter @openspecui/web build:ssg`, and
  `pnpm exec openspec validate accelerate-live-projection-loading --type change --strict --json`.
- The SSG build completed with its reported CSS pseudo-element and ineffective dynamic-import warnings. The Web
  unit lane also reported jsdom canvas support warnings; both commands exited successfully.
- This is automated preparation evidence only. The owner still performs the final Dashboard and Changes browser
  walkthrough; this Change is neither merged, archived, nor released here.

## Delivery Record (2026-07-23 Asia/Shanghai)

- `95bc2b9 feat: accelerate live projection loading` is the independently reviewable implementation commit. It
  contains the bounded Projection Work owners, Root snapshot gateway, Dashboard regions, progressive Changes,
  demand-driven OPSX, benchmarks, tests, package changeset, and the matching 5.2 verification record.
- The following docs-only checkpoint commit closes 5.4. Neither commit merges, archives, releases, pushes, or
  substitutes automated preparation evidence for the owner's final browser walkthrough.
