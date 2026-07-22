<!--
Orthogonal intents (created 2026-07-23 Asia/Shanghai):
1. Preserve reproducible production-path latency observations for Dashboard and Changes.
2. Separate controlled CLI, kernel, Manager, and Dashboard phase measurements from page measurements.
3. Record factual causal constraints without presenting a single sample as a universal SLO.
4. Provide the evidence input for the performance Change's implementation plan.

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
