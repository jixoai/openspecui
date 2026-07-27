<!--
Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
1. Preserve reproducible production-path latency observations for Dashboard and Changes.
2. Separate controlled CLI, kernel, Manager, and Dashboard phase measurements from page measurements.
3. Record factual causal constraints without presenting a single sample as a universal SLO.
4. Provide the evidence input for the performance Change's implementation plan.
5. Record measured P1 resource bounds and P2 Root Context gateway evidence without converting them into a universal SLO.

Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
-->

# Live Projection Loading Evidence

## Snapshot

```text
captured: 2026-07-23 04:44:15 CST
HEAD:     ec7bf71 (feat/openspec-cli-16-contract-baseline)
Node:     v24.15.0
CLI:      OpenSpec 1.6.0
input:    2 Git worktrees, 13 Specs, 3 active Changes, 53 archived Changes
```

All values below are wall-clock milliseconds from one developer machine. They prove the named path
was slow or completed, but they are not cross-machine SLOs. The WebSocket rows are the production
Server/tRPC subscription path. The other rows are controlled, real-code phase measurements.

## Reproduction Commands

Run from the repository root. `pnpm --filter` changes the child process CWD, so `--dir` is explicit.

```bash
NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--conditions=development" \
  pnpm --filter @openspecui/server exec tsx \
  bench/live-projection-loading.bench.ts -- \
  --dir /Users/kzf/Dev/GitHub/jixoai-labs/openspecui \
  --scenario dashboard --timeout 12000

NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--conditions=development" \
  pnpm --filter @openspecui/server exec tsx \
  bench/live-projection-loading.bench.ts -- \
  --dir /Users/kzf/Dev/GitHub/jixoai-labs/openspecui \
  --scenario status --timeout 25000

NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--conditions=development" \
  pnpm --filter @openspecui/server exec tsx \
  bench/cli-projection-latency.bench.ts -- \
  --dir /Users/kzf/Dev/GitHub/jixoai-labs/openspecui

NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--conditions=development" \
  pnpm --filter @openspecui/server exec tsx \
  bench/dashboard-phase-latency.bench.ts -- \
  --dir /Users/kzf/Dev/GitHub/jixoai-labs/openspecui

NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--conditions=development" \
  pnpm --filter @openspecui/server exec tsx \
  bench/opsx-warmup-latency.bench.ts -- \
  --dir /Users/kzf/Dev/GitHub/jixoai-labs/openspecui --timeout 20000
```

## Production First Payloads

| Scenario                             | First payload                |                 Result |
| ------------------------------------ | ---------------------------- | ---------------------: |
| Fresh Server, Dashboard only         | `dashboard.subscribe`        |            11,488.31ms |
| Same Server, fresh Dashboard client  | `dashboard.subscribe`        |             8,841.33ms |
| Fresh Server, Config only            | `opsx.subscribeConfigBundle` |            10,151.66ms |
| Fresh Server, Status only            | `opsx.subscribeStatusList`   |            16,067.98ms |
| Fresh Server, Changes only           | `change.subscribe`           |             7,079.15ms |
| Fresh Server, Dashboard page fan-out | `dashboard.subscribe`        |             9,853.14ms |
| Fresh Server, Dashboard page fan-out | Config / Status              | no payload by 10,000ms |
| Fresh Server, Changes page fan-out   | `change.subscribe`           |             7,938.59ms |
| Fresh Server, Changes page fan-out   | Status                       | no payload by 15,000ms |

The control transport probe received `rootContext.subscribe`'s initial `loading` event in 73.12ms.
Therefore the multi-second samples are not explained by WebSocket connection establishment.

## Phase Measurements

### Root and CLI

```text
checkAvailability                            542.39ms
doctorRoot and context (parallel)       1,915.44ms / 1,918.86ms
schemas                                 1,927.21ms
workflowStatus x3 (parallel)      2,073.74ms .. 2,111.77ms
applyInstructions x3 (parallel)  1,925.69ms .. 1,931.11ms
```

The production `PlanningRootServiceManager.runReactiveOperation()` was invoked three times with the
same resolved root and took 2,704.65ms, 1,599.76ms, and 1,528.76ms. This is a measured repeated
acquisition, not a Root change.

### OPSX and Dashboard

```text
OpsxKernel.warmup()                    10,550.73ms
  result                              2 schemas / 3 changes / 3 statuses

DashboardOverviewService.init()         2,218.21ms
DashboardOverviewService.getCurrent()       0.12ms
DashboardOverviewService.refresh()      2,240.30ms

loadDashboardOverview()                 2,794.97ms
buildDashboardGitSnapshot()               667.18ms
listSpecsWithMeta()                       616.30ms
listChangesWithMeta()                     712.05ms
listArchivedChangesWithMeta()             703.00ms
```

The direct Dashboard loader values vary with filesystem and process cache state; their consistent
relationship matters: they are materially below the 7-16 second production first payloads. Git is a
real cost but not the measured dominant cost in this input.

## Causal Constraints

```text
new page subscription
  -> new ReactiveContext + new task
       -> PlanningRootServiceManager acquisition
            -> CLI availability + doctor + context
       -> projection-specific work

OPSX Status List
  -> waitForWarmup()
       -> schemas + schema projections
       -> all Change status + Apply + artifact instruction/output projections
       -> Status List
```

The source establishes the following facts:

1. Web `useSubscription` has a module-local `Map`; a browser refresh destroys it.
2. `createReactiveSubscription()` creates a new `ReactiveContext` and executes its task for every
   subscriber. It has no server-side projection single-flight or replay cache.
3. `dashboard.subscribe` calls `DashboardOverviewService.refresh('subscription')`, not
   `getCurrent()`. The measured service cache can answer in 0.12ms, but that path is bypassed.
4. Every Manager operation calls `resolveServerRootContext()` before returning the active record,
   including unchanged-root operations.
5. `OpsxKernel.waitForWarmup()` performs the full four-phase warmup before Status List can emit.
   Its per-Change warmup additionally requests Apply Instructions and per-artifact Instructions/outputs.

The production timing and source structure together support a multi-cause diagnosis. They do not prove
that any single command is always the slowest on every project; implementation must add phase tracing
before selecting cache TTLs, hash scopes, or worker concurrency.

## Current Serial Recheck

The original snapshot above is retained as the first controlled baseline. A serial recheck was run on
2026-07-23 05:08:29 +08:00 after the Change itself was added to the workspace. This is a new input state,
not a replacement of the historical sample:

```text
HEAD:     e131b68 (feat/openspec-cli-16-contract-baseline)
input:    2 Git worktrees, 13 Specs, 4 active Changes, 53 archived Changes
execution: explicit --dir commands below, run serially
```

```bash
NODE_OPTIONS="--conditions=development" pnpm --filter @openspecui/server exec tsx \
  bench/live-projection-loading.bench.ts -- \
  --dir /Users/kzf/Dev/GitHub/jixoai-labs/openspecui --scenario dashboard --timeout 30000

NODE_OPTIONS="--conditions=development" pnpm --filter @openspecui/server exec tsx \
  bench/live-projection-loading.bench.ts -- \
  --dir /Users/kzf/Dev/GitHub/jixoai-labs/openspecui --scenario changes --timeout 30000

NODE_OPTIONS="--conditions=development" pnpm --filter @openspecui/server exec tsx \
  bench/live-projection-loading.bench.ts -- \
  --dir /Users/kzf/Dev/GitHub/jixoai-labs/openspecui --scenario status --timeout 30000

NODE_OPTIONS="--conditions=development" pnpm --filter @openspecui/server exec tsx \
  bench/dashboard-phase-latency.bench.ts -- \
  --dir /Users/kzf/Dev/GitHub/jixoai-labs/openspecui

NODE_OPTIONS="--conditions=development" pnpm --filter @openspecui/server exec tsx \
  bench/opsx-warmup-latency.bench.ts -- \
  --dir /Users/kzf/Dev/GitHub/jixoai-labs/openspecui --timeout 30000

NODE_OPTIONS="--conditions=development" pnpm --filter @openspecui/server exec tsx \
  bench/planning-root-acquire-latency.bench.ts -- \
  --dir /Users/kzf/Dev/GitHub/jixoai-labs/openspecui --attempts 3
```

| Serial scenario or phase        |                    Current sample |
| ------------------------------- | --------------------------------: |
| Dashboard cold first payload    |                        7,402.14ms |
| Dashboard reload on same Server |                        4,355.41ms |
| Changes first payload           |                       15,160.98ms |
| OPSX Status List first payload  |                       13,499.61ms |
| Dashboard loader                |                        1,281.81ms |
| Dashboard Git snapshot          |                          334.22ms |
| Dashboard service init          |                          924.45ms |
| Dashboard service getCurrent    |                            0.08ms |
| Dashboard service refresh       |                          849.44ms |
| OPSX Kernel warmup              |                        8,693.72ms |
| Root acquisition 1 / 2 / 3      | 11,866.94 / 5,860.20 / 5,421.35ms |

All six serial benchmark commands exited `0` and returned the expected current cardinalities. The current
numbers vary substantially from the first baseline because the active-Change inventory changed from three to
four, process/filesystem cache state changed, and Root acquisition is sensitive to the current CLI/runtime
state. The causal relationship remains stable: direct leaf work and the cached Dashboard snapshot are much
faster than production first payloads, while repeated Root acquisition, full OPSX warmup, and aggregate
subscription orchestration remain on the critical path. These samples are evidence for phase instrumentation
and work sharing, not an absolute latency SLO.

## P1 Projection Work Budget Recheck

Captured 2026-07-23 08:03:23 CST on the current workspace. The command is read-only and intentionally records
payload size and Work behavior beside duration; it is not a CI latency gate.

```bash
NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--conditions=development" \
  pnpm --filter @openspecui/server exec tsx \
  bench/projection-work-budget.bench.ts -- \
  --dir /Users/kzf/Dev/GitHub/jixoai-labs/openspecui
```

| Representative projection      |    Duration | Serialized snapshot |
| ------------------------------ | ----------: | ------------------: |
| Dashboard overview             | 10,483.80ms |        50,851 bytes |
| Active Changes with metadata   |  6,453.61ms |        74,424 bytes |
| Archived Changes with metadata |  6,190.12ms |       397,522 bytes |

The exact durations are input/cache-state-sensitive and are not compared with the earlier serial samples. The
largest observed serialization is about 19% of one 2MiB owner cache budget. P1 therefore keeps a 2MiB ceiling
per typed owner registry, 32 cached snapshots, 64 Work identities, a 256-entry payload-free trace, and at most
eight registries per Server (16MiB aggregate snapshot ceiling). CLI, filesystem, Git, and CPU each start at one
slot: the sample provides no evidence that more concurrent I/O improves tail latency, and P1 does not schedule
broad warmup.

The same run's controlled Work probe emitted two subscriber payloads after exactly one leaf call and recorded
the phase order `request -> transport-start -> start -> request -> transport-start -> join ->
first-stable-payload -> complete -> cancel`. This establishes the baseline event order for P2-P5 migrations;
it does not claim that an unmodified route already uses Projection Work.

## P1 Fixed-Point Evidence

The old identity-less helper was first run with a deliberately failing `one call` expectation. It failed at the
named production boundary with `expected 2 to be 1`. The final checked registry tests instead prove one shared
loader and one `ReactiveContext` for same identity, stale display replay, LRU eviction, late A retirement, phase
trace bounds, scheduler foreground priority, and Server-local typed registry bounds.

For mutation resistance, temporarily removing registry lookup made the shared fixed point report three loader
calls, and bypassing `isCurrentRun` made the A-to-B case publish `A` before `B`. A first controller-only mutation
remained green because the generation equality independently blocked A; it is characterization of a redundant
guard, not claimed as mutation evidence. Source was restored before the final focused green/typecheck run.

## P2 Root Context Gateway Recheck

Captured 2026-07-23 08:35:54 CST after the current-snapshot gateway was added. The command uses the real Server
and three sequential `runReactiveOperation()` acquisitions against the same effective root:

```bash
NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--conditions=development" \
  pnpm --filter @openspecui/server exec tsx \
  bench/planning-root-acquire-latency.bench.ts -- \
  --dir /Users/kzf/Dev/GitHub/jixoai-labs/openspecui --attempts 3
```

| Same-root attempt |     Result |
| ----------------- | ---------: |
| 1                 | 3,098.53ms |
| 2                 |    16.79ms |
| 3                 |     0.07ms |

The root path was `/Users/kzf/Dev/GitHub/jixoai-labs/openspecui` for all three attempts and the command exited
`0`. The older serial root benchmark (`11,866.94 / 5,860.20 / 5,421.35ms`) used a different workspace/runtime
moment, so these absolute values are not a cross-run SLO comparison. The controlled checked fixed point provides
the causal proof: two same-generation operations and two same-generation reactive subscribers invoke one
`checkAvailability`/`doctorRoot`/`context` resolution; one `context` invalidation produces exactly one B
resolution; an error state is never replayed as current.

## P3-P5 Page Delivery Recheck

Captured 2026-07-23 Asia/Shanghai after Dashboard regional Work, progressive Changes, demand-driven OPSX,
and Web admission order were implemented. The current input has 13 Specs, 4 active Changes, and 53 archived
Changes. Each command uses a fresh isolated Server on port `34800`; numbers are wall-clock samples, not a
cross-run SLO.

```bash
NODE_OPTIONS=--conditions=development pnpm --filter @openspecui/server exec tsx \
  bench/live-projection-loading.bench.ts -- \
  --dir /Users/kzf/Dev/GitHub/jixoai-labs/openspecui --scenario dashboard --timeout 60000

NODE_OPTIONS=--conditions=development pnpm --filter @openspecui/server exec tsx \
  bench/live-projection-loading.bench.ts -- \
  --dir /Users/kzf/Dev/GitHub/jixoai-labs/openspecui --scenario changes --timeout 60000

NODE_OPTIONS=--conditions=development pnpm --filter @openspecui/server exec tsx \
  bench/live-projection-loading.bench.ts -- \
  --dir /Users/kzf/Dev/GitHub/jixoai-labs/openspecui --scenario dashboard-page --timeout 60000

NODE_OPTIONS=--conditions=development pnpm --filter @openspecui/server exec tsx \
  bench/live-projection-loading.bench.ts -- \
  --dir /Users/kzf/Dev/GitHub/jixoai-labs/openspecui --scenario changes-page --timeout 60000
```

| Scenario                            | First renderable fact               | Current sample |
| ----------------------------------- | ----------------------------------- | -------------: |
| Fresh Server, Dashboard             | current Summary snapshot            |     9,009.92ms |
| Same Server, fresh Dashboard client | stale-display-only Summary snapshot |     1,690.81ms |
| Fresh Server, Changes               | first row batch                     |     4,843.78ms |
| Same Server, fresh Changes client   | first row batch                     |        49.96ms |
| Fresh Server, Dashboard page order  | current Summary snapshot            |    12,785.22ms |
| Fresh Server, Changes page order    | first row batch                     |     9,944.99ms |

The Dashboard cold trace reached `root-ready` at 6,674.17ms and its Summary leaf at 9,008.50ms. The Changes
trace reached `root-ready` at 4,734.40ms and emitted one completed row at 4,843.78ms. This demonstrates that
remaining cold latency is chiefly Root/CLI plus primary filesystem work; it is no longer a hidden wait for
Dashboard Git, trends, Status, Config, or later Change rows.

The page-order probes record admission, not a claim that all background work is fast:

```text
Dashboard page:
  Summary starts at      83.86ms, first snapshot at 12,785.22ms
  Trends starts at   12,884.40ms
  Git starts at      12,885.01ms
  Config starts at   12,885.25ms
  Status starts at   12,886.71ms

Changes page:
  first row at        9,944.99ms
  Status starts at    9,975.35ms
```

Web therefore admits only Summary in the initial Dashboard phase, then Trends, Git scope/Git, Config, and
Status after Summary becomes renderable. It admits Status on Changes only when at least one primary row is
renderable. Existing current snapshots can still be displayed immediately; they never become browser cache
authority or mutation authority during refresh.

### P3-P5 Fixed Points And Mutation Resistance

- Dashboard green: `DashboardProjectionService` delivers Summary while Git is deliberately unresolved, and its
  regional Web hook starts Trends/Git only after Summary data exists. Mutation: removing the Code Git binding
  token from the Projection Work identity makes the checked B test receive `code-binding-a` instead of
  `code-binding-b`; source was restored before green runs.
- Changes green: one finished row batch reaches the client before a deliberately slow later row; row errors
  retain prior rows and progress. Mutation: fixing the Planning-root generation in the Work identity makes the
  B test receive row `a` instead of row `b`; source was restored before green runs.
- OPSX green: a real `OpsxKernel` with `waitForWarmup()` replaced by a never-settling promise still completes
  `ensureStatusList()` and preserves typed Status evidence. Mutation: restoring `await this.waitForWarmup()`
  inside the real method makes that test fail with `Status List remained behind full warmup.` at 250ms; source
  was restored before green runs. An earlier Router-only mock stayed green because it mocked the method under
  test; it is rejected as characterization, not counted as mutation evidence.

Checked focused commands after restoration:

```text
pnpm --filter @openspecui/core exec vitest run src/opsx-kernel.test.ts src/opsx-types.test.ts
  2 files, 13 tests passed
pnpm --filter @openspecui/server exec vitest run
  reactive-subscription, projection-work, PlanningRoot, DashboardProjection, ChangesProjection
  8 files, 36 tests passed
pnpm --filter @openspecui/server exec vitest run src/router.test.ts -t <P3-P5 bridge cases>
  6 passed, 87 skipped
pnpm --filter @openspecui/web exec vitest run <P3-P5 hook and route cases>
  7 files, 58 tests passed
```

## P6 Fingerprint And Worker ROI

The following read-only benchmark ran on the same current workspace before any persistent cache or Worker was
added:

```bash
NODE_OPTIONS=--conditions=development pnpm --filter @openspecui/server exec tsx \
  bench/projection-fingerprint-roi.bench.ts -- \
  --dir /Users/kzf/Dev/GitHub/jixoai-labs/openspecui
```

| Measured operation                               | Input                              |           Current sample |
| ------------------------------------------------ | ---------------------------------- | -----------------------: |
| Metadata manifest                                | 366 files / 3,004,559 bytes        |      13.15ms .. 206.90ms |
| Full content SHA-256                             | same input                         |      63.29ms .. 268.94ms |
| In-memory SHA-256 only                           | same input                         |        3.90ms .. 10.49ms |
| Dashboard planning projection                    | 13 Specs / 4 Changes / 53 archives | 1,323.76ms .. 2,997.64ms |
| Markdown task projection                         | 299 files / 2,112,247 bytes        |         0.21ms .. 1.77ms |
| Worker digest, including 3,619,988-byte transfer | same logical input                 |                 709.54ms |

The controlled unchanged observations matched 4/4 and a changed content input missed correctly, but that is not
a production persistent-cache hit rate. The Worker is materially slower than main-thread hashing in this sample,
and no deployed hit rate proves that persistent hashing would recover its filesystem/eviction/diagnostic cost.
Decision: do not add a persistent hash cache and do not add a Worker pool in this Change. Keep the bounded
Server memory snapshots plus explicit reactive invalidation; revisit only with production-safe hit-rate and
CPU-bound evidence.

Mutation checks were run against this fixed point. Removing the cache-hit branch restored two CLI resolutions;
making the snapshot match ignore the invalidation identity prevented the B subscriber pair from converging.
The source was restored before the focused Manager/Root Context suite, checked test typecheck, production
typecheck, and formatting check. P2 does not yet improve Dashboard, Changes, or OPSX independently; those remain
P3-P5 work packages.

## Final Automated Gate Record

Captured 2026-07-23 Asia/Shanghai after the Project Binding snapshot-boundary correction. A launch Binding write
now invalidates `project/context` before the detached Root preview, while an imperative root operation cannot
seed the reactive Root snapshot cache. The real write-then-converge fixture keeps the A binding visible while
the A lease is held and exposes B only after release. Code Git refresh evidence now subscribes to the independent
Dashboard Git region rather than reviving the retired aggregate Dashboard refresh.

```text
pnpm test:ci                                                   exit 0
pnpm test:browser:ci                                           exit 0
pnpm format:check                                              exit 0
pnpm lint:ci                                                   exit 0
pnpm typecheck                                                 exit 0
pnpm --filter @openspecui/web build:ssg                        exit 0
pnpm exec openspec validate accelerate-live-projection-loading
  --type change --strict --json                                exit 0
```

`test:browser:ci` is component/Storybook preparation evidence; it does not replace the owner-only final browser
walkthrough. The SSG and Web test lanes printed non-fatal build/jsdom warnings, but their exit status was zero.
