<!--
Orthogonal intents (updated 2026-07-25 Asia/Shanghai):
1. Record the executable baseline for the owner's all-surface realtime waiting-experience Change.
2. Keep actual source progress, scope, decisions, and evidence boundaries synchronized during application.
3. Preserve the push-to-pull, authority, draft-protection, and visual-language decisions approved in research.
4. Define the concrete conditions that require a return to research before implementation can proceed.
5. Record the independently requested P1-A correction evidence without closing its review-owned checkpoints.

Original request (2026-07-23): "布局方面暂时不需要改动，后续社区有一个PR我会合并进来，那是关于kanban 的一个pr。所以本次change的主要优化点，在于更友好的UIUX，优化用户等待信息的时间感知。"
Original request (2026-07-23): "一次性把现有的页面都统一整改，因为这涉及到统一组件的封装和开发。全部改动，才能在中途暴露出所有隐含的可能、状态。这对于我们组件化的封装和开发非常重要。"
Original request (2026-07-23): "不用显示文字，可以用光影来替代，将它做成一种视觉语言，其实包括加载中等状态也是，尽量不要使用文字，而是使用视觉语言（动画、光影）等技术。"
-->

## Implementation State

### Historic planning baseline

The 2026-07-23 baseline predates the unreviewed Web-first candidate recorded below. `intake.md`,
`research-plan.md`, and the planning checkpoints define the durable behavioral scope; Change checkboxes remain
unchecked until independent review accepts their named evidence. Production application resumes with the
bounded P1-A public-boundary red case recorded in the current worker Goal.

The implementation scope is frozen as follows:

- In scope: every current Web route, detail surface, settings section, dialog, popover, drawer, editor-adjacent control, and asynchronous command presentation listed in `research-plan.md`.
- In scope: the explicitly approved Server-to-Web push-to-pull projection contract needed to make those visual states truthful.
- Out of scope: page layout, information architecture, navigation, Kanban design, the pending community Kanban PR, a global second data store, optimistic business-data writes, raw Terminal/CLI/log/editor content changes, and owner-only final browser acceptance.

### Execution ledger

> Execution order was replanned 2026-07-24: Phase 1 delivered the Web-first candidate on v1. The former P0
> Server-emission blocker was revalidated on 2026-07-25 and is stale in the current tree. Phase 2 is now
> eligible, but begins with one bounded vertical slice, P1-A Dashboard Summary, before Trends, Git, or Changes.

| Order | Phase                              | Current state                                                           | Implementation owner                                                                         | Mandatory evidence before moving on                                                                                                                                         |
| ----- | ---------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Phase 2, P1-A                      | Implemented; pending independent review                                 | Dashboard Summary Projection Work boundary and its real Web adapter                          | The v2-after-implementation acceptance fixed point is green. No historical pre-fix red was obtained; the same Web fixture fails after bypassing the exact active-wake gate. |
| 2     | Phase 1                            | **Implemented (Slice 2A+2B)**                                           | Web realtime component module, shared `Button`, and CSS token ownership                      | A focused visual/state fixture proves stable geometry, reduced-motion equivalence, hidden accessible status, and no changing command label.                                 |
| 3     | Phase 1                            | **Migrated (9/9 routes)**                                               | Dashboard, Changes, Archives, Specs, Schemas, Context, Notifications, Git, and Search owners | Each route has a current/partial/revalidating/refresh-error fixture where applicable; no route-wide wait branch hides a stable sibling.                                     |
| 4     | Phase 1                            | **Migrated (detail + Config + Settings loading)**                       | OPSX, planning-config, Settings/translation, dialog/editor, and terminal-control owners      | A real draft/editor/overlay red case proves a late remote update cannot overwrite local interaction; authority locks hit the mutation owner.                                |
| 5     | Phase 1 static/a11y; Phase 2 gates | **Static truthfulness proven; reduced-motion/mobile/Storybook pending** | Static provider, route/component tests, and Storybook fixtures                               | Static truthfulness, reduced motion, mobile geometry, and SSG evidence are green before full repository gates.                                                              |

### P1-A Dashboard Summary v2 applied evidence (2026-07-25 Asia/Shanghai)

- **Production owners**: `packages/core/src/dashboard-summary-transport.ts` defines strict browser-safe
  wake/read contracts; `packages/server/src/dashboard-projection-service.ts` derives a SHA-256 opaque identity
  from the Server-owned Summary Work and issues a data-free wake; `packages/server/src/router.ts` bridges
  root replacement and owns the typed pull; `packages/web/src/lib/use-dashboard.ts` accepts a pull only when
  its identity and work generation still equal the active wake.
- **Public Server green**: `dashboard-summary-router.test.ts` starts a real `createServer` with watcher off,
  uses its real Context and `appRouter` caller, replaces only typed CLI availability/Doctor/Context results,
  and proves `subscribeSummary` contains no data/snapshot/batch/progress while `getSummary` correlates to its
  opaque identity and generation. `dashboard-projection-service.test.ts` additionally proves cold/cache start
  has one initial wake and recomputation adds one `server-push` wake. Command:
  `pnpm --filter @openspecui/server exec vitest run src/dashboard-projection-service.test.ts src/dashboard-summary-router.test.ts --pool=threads --maxWorkers=1 --testTimeout=15000 --hookTimeout=15000` -> 2 files, 7 tests passed.
- **Web acceptance fixed point**: `use-dashboard.test.ts` was added after v2 implementation and drives the
  actual mocked tRPC subscription/query callback boundary: A wake -> deferred A pull -> root-rebind B wake -> B
  commit -> late A resolution. The final Summary remains B.
  Command: `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/use-dashboard.test.ts` -> 1 file, 3 tests passed.
- **Remove-guard mutation proof, not historical red**: no pre-fix implementation was available to produce a
  historical red. Temporarily replacing `!isActiveWake(wake)` with `!active` in the real adapter acceptance
  condition made the same late-A fixture fail at `use-dashboard.test.ts:176`: received Summary A
  (`specifications: 1`) instead of B (`2`). The exact gate was restored before final green runs. This is mutation
  evidence only; it does not satisfy checkpoint 2.2's requested historical pre-fix red.
- **Checked boundary**: `pnpm --filter @openspecui/server typecheck` and
  `pnpm --filter @openspecui/web typecheck` passed. The existing broad `router.test.ts` transport lane remains
  excluded from P1-A evidence because its pre-existing unrelated checked-fixture errors are not this contract;
  the new public fixture is included in `tsconfig.git-tests.json` and has no fabricated Context or unsafe cast.
- **Scope**: Trends, Git, Changes, generic Projection Work transports, burst coalescing, user-action bypass,
  visual atoms, layout, SSG work, broad gates, and owner browser walkthrough remain out of this slice. All P1-A
  checkboxes remain unchecked until independent review accepts the named evidence.

### P1-A independent-review correction (2026-07-25 Asia/Shanghai)

The first P1-A candidate is **not accepted**. The focused tests and typechecks passed, but they did not prove
three production boundaries required by the v2 contract:

1. **Cached A must become display-only on B's first wake.**
   `useReactiveProjectionSubscription` restores the global fixed-key Summary cache as non-updating content.
   The Summary adapter then initialized `hasDisplayData` as `false`, so its first B wake did not emit
   `recompute-started`. A therefore remained visually current until B's deferred pull settled. The correction
   must retain A but publish revalidation/display-only state immediately, and commit B as current only after the
   matching B read returns. It must not key a client cache by a client-selected identity or create a second
   Summary truth.
2. **The loading benchmark must follow the migrated transport.**
   `packages/server/bench/live-projection-loading.bench.ts` still predicates Dashboard cold/reload/page
   completion on `isProjectionSnapshot(subscribeSummary)`. The v2 subscription deliberately has no snapshot, so
   each affected scenario times out. It must measure `Summary wake -> Server-owned getSummary pull -> matching
typed read`, while Trends and Git retain their v1 benchmark paths.
3. **The Web test must preserve its public input type.**
   The A/B fixture models every tRPC subscription callback as `unknown`; it can inject an invalid Summary wake
   without a compiler failure. Split the Summary callback fixture to use `DashboardSummaryInvalidation`, keep
   legacy projection event typing separate for Trends/Git, and describe the fixture accurately as a mocked tRPC
   callback boundary rather than a live transport.

The existing v2-after-implementation A/B test remains useful mutation proof but not historical red evidence.
The correction worker must add one named red/green/mutation proof for each listed production boundary before
requesting another independent review. No P1-A checkbox may be closed during the correction.

### P1-A correction candidate evidence (2026-07-25 Asia/Shanghai)

- **Cached-A production owner and red**: `useReactiveProjectionSubscription` now supplies the existing cache
  fact to the real Summary adapter; only that adapter initializes its display fact from `hasCached`. With this
  line temporarily restored to the rejected `false`, the named cached-A test failed after B's first wake:
  expected `isUpdating: true`, received `false` (1 failed, 5 skipped). This is both a direct pre-correction replay
  and the exact mutation-resistance proof for the cache demotion transition; no cache key, cache store, or other
  projection policy changed.
- **Cached-A green and late-A retirement**:
  `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/use-dashboard.test.ts` -> 1 file,
  6 tests passed. The fixed point primes cache A, mounts the real Summary hook, sends typed root-rebind wake B,
  observes readable A with `isUpdating: true` while B is deferred, then observes current B. Separate tests prove
  both late A resolve and late A reject cannot change B data, updating state, or error state.
- **Checked mocked callback boundary**: `dashboard-summary-test-fixture.ts` is part of the regular Web
  `src` typecheck and defines Summary `onData` as `DashboardSummaryInvalidation`; Trends/Git retain their legacy
  fixture. Its exact-type assertion failed with `TS2344: Type 'false' does not satisfy the constraint 'true'`
  when only that input was mutated to `unknown`. This proves checked mocked callback injection, not real tRPC
  serialization; the existing checked `dashboard-summary-router.test.ts` separately owns real Server/tRPC
  wake/read serialization evidence.
- **Benchmark correlation red/green/mutation**: the new checked pair fixture initially failed because the
  mismatch helper returned instead of rejecting (`expected [Function] to throw an error`). After correction,
  identity and generation mismatches both throw; removing those exact throws made the same fixture fail 2/2.
  `pnpm --filter @openspecui/server exec vitest run src/dashboard-projection-service.test.ts src/dashboard-summary-router.test.ts src/live-projection-loading-summary.test.ts --pool=threads --maxWorkers=1 --testTimeout=15000 --hookTimeout=15000`
  -> 3 files, 9 tests passed. `tsconfig.transport-tests.json` checks both the benchmark and pair fixture.
- **Isolated real benchmark evidence**: OpenSpec 1.6 initialized
  `/tmp/openspecui-p1a-bench.YQBn5s/project` with an isolated `XDG_DATA_HOME`; each scenario used its own Server
  port and a 60,000ms per-measurement timeout. `dashboard` returned `fatalError: null`: cold wake 9,142.10ms ->
  matching `dashboard.getSummary.first-renderable` 10,823.57ms; reload wake 1,901.73ms -> matching pull
  3,694.22ms. `dashboard-page` returned `fatalError: null`: wake 7,060.04ms -> matching pull 9,288.44ms,
  followed by unchanged v1 Trends/Git snapshot measurements. Every Summary read reported the same opaque
  identity/generation as its wake, `freshness: current`, and no Summary measurement timed out.
- **Final checked lanes**: `pnpm --filter @openspecui/web typecheck` and
  `pnpm --filter @openspecui/server typecheck` passed after all mutations were restored. No browser, static,
  broad workspace, PR, merge, archive, or release action ran.
- **Residual limitation**: this remains one Summary-only correction candidate. Trends, Git, Changes, burst
  coalescing, user-action bypass, and generic cache behavior remain unchanged. The original P1-A A/B fixture was
  added after v2 implementation, so it remains acceptance/mutation evidence rather than a historical 2.2 red;
  2.1-2.3 stay unchecked pending independent review.

### P1-A correction independent reviewer acceptance (2026-07-25 Asia/Shanghai)

Independent contract and architecture review found no production defect in `d1740335`. The data-free wake
remains Server-owned, `getSummary` remains an input-free current pull, the shared subscription hook exposes only
the read-only cache-presence fact, and only the Summary adapter uses that fact to demote retained A on B's first
wake. Its local active-wake gate rejects both late A resolution and rejection after B becomes current. The
checked mocked callback truthfully proves injected `DashboardSummaryInvalidation` shape without claiming live
tRPC serialization, and the benchmark holds the subscription through an identity/generation-matching pull.

An independent Terra verification passed the committed Web fixture `6/6`, Server fixtures `9/9`, both package
typechecks, scoped Prettier/Oxlint, commit/diff checks, and strict Change validation. A transient model-service
503 interrupted only Terra's planned duplicate benchmark replay; it did not occur in a test or product process.
The main reviewer therefore created a fresh OpenSpec 1.6 fixture under an isolated `XDG_DATA_HOME` and replayed
both real scenarios:

```text
dashboard:      fatalError=null
  cold   wake 1,613.47ms -> matching pull 2,989.63ms
  reload wake 1,345.75ms -> matching pull 2,680.25ms
dashboard-page: fatalError=null
  wake 2,620.63ms -> matching pull 4,920.40ms
  Trends current v1 snapshot 1,372.21ms; Git current v1 snapshot 1,507.91ms
```

Every Summary pair carried the same opaque identity and work generation, `freshness: current`, and no timeout.
The correction candidate is accepted for downstream dependency review. Checkpoints 2.1-2.3 remain open because
this review cannot manufacture checkpoint 2.2's missing historical pre-v2 red; that truthful ledger limitation
does not invalidate the current runtime contract or the downstream loading-regression confirmation.

### P0 Server-emission revalidation (2026-07-25 Asia/Shanghai)

The asserted blocker was not a current source regression. `61612c3` is documentation-only; the relevant
production correction is already present in `95bc2b9`:

```text
cache-hit reactive resolution
  -> trackRootContextDependencies(cached state)
  -> RuntimeInvalidationIndex context generation advances
  -> invalidation-key mismatch retires the cache entry
  -> reactive resolution returns B; B is the only cacheable snapshot
```

Focused replay used the current production owner, not a hand-called downstream callback:

```text
pnpm --filter @openspecui/server exec vitest run \
  src/planning-root-service.current-snapshot.test.ts \
  --pool=threads --maxWorkers=1 --testTimeout=10000 --hookTimeout=10000 --reporter=verbose
  PASS: 3/3

pnpm --filter @openspecui/server exec vitest run \
  src/git-repository-binding-router.test.ts \
  --pool=threads --maxWorkers=1 --testTimeout=15000 --hookTimeout=15000 --reporter=verbose
  PASS: 7/7

pnpm --filter @openspecui/server typecheck:git-tests
  PASS
```

The default fork-pool invocation remained running without rendering a test result in this local harness;
the single-worker thread-pool replay completed all named tests. This is runner behavior, not evidence of a
failed Server assertion. No P0 source edit is authorized. P1 is unblocked, while broad gates remain closed.

## Implemented evidence (2026-07-24 Phase 1)

### Slice 2A — headless state law + adapters + Web-side root-cause fix

- **Owner files**: `packages/web/src/lib/realtime/state.ts`, `adapters.ts`, `index.ts`; `packages/web/src/lib/use-subscription.ts`.
- **Root-cause fix**: `useAuthoritativeSubscription` transport-lifecycle callbacks
  (`onConnectionStateChange`/`onStopped`/`onComplete`) previously flipped `isLoading: true` unconditionally,
  relabeling retained cached data as initial-loading on every WebSocket reconnect/stop/complete — the single
  largest structural driver of the reported "pervasive Loading". The fix sets `isLoading: previous.data === undefined`,
  so retained content stays readable/copyable with authority revoked (`waiting`) and only current-dependent
  mutations lock. When no data exists yet, the initial-loading surface remains visible.
- **Red (recorded)**: `use-subscription.reconnect.test.tsx` — 2 tests failed pre-fix
  (`isLoading` was `true` over cached data during `onConnectionStateChange('connecting')` and `onStopped`).
- **Green**: same 2 tests pass post-fix; `state.test.ts` 14/14; existing 6.11-law `use-subscription.test.tsx`
  18/18 unchanged (no regression). Command:
  `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/use-subscription.reconnect.test.tsx src/lib/use-subscription.test.tsx src/lib/realtime/state.test.ts`.
- **Mutation-resistance (recorded)**: reverted `isLoading: previous.data === undefined` back to
  `isLoading: true` via `sed`; the 2 named tests failed again for the exact intended reason; restored from
  backup; all green. Backup/restore performed on a single file; no broad staging.
- **Evidence type**: unit (focused Vitest lane).

### Slice 2B — composable visual atoms + CSS

- **Owner files**: `packages/web/src/components/realtime/{realtime-projection,realtime-skeleton,realtime-cue,realtime-progress,realtime-primitives,async-action}.tsx`, `index.ts`; `packages/web/src/styles/realtime.css` (imported via the atoms barrel, mirroring `terminal-effects.css`).
- **Contract**: `RealtimeProjectionRoot` publishes only `data-state`/`data-authority`/`data-cause` on a minimal element — **no Card/border/page-wrapper/route-layout/navigation** (asserted in `realtime-atoms.test.tsx`). Atoms: skeleton geometry (line/row/card/inventory), revalidation luminance cue + settle cue, truthful progress (indeterminate for `total==='unknown'`, determinate only for known, **no fabricated %/ETA**), concise `RealtimeError`/`RealtimeEmpty` (text retained for errors/empty/recovery per law), `RealtimeAccessibleStatus` (hidden live region for reduced-motion/a11y), `AsyncAction` over `Button.activity` (**label unchanged**: `Save` stays `Save`, `aria-busy` + activity lock, does not close dialog/discard draft).
- **CSS**: extends existing theme tokens + native transitions; `overflow-anchor: auto` on skeleton inventory; `prefers-reduced-motion` block disables shimmer/settle/progress motion and substitutes a static luminance band (the existing `index.css:970` reduced-motion block only covered View Transitions; `animate-pulse`/`animate-spin` were uncovered).
- **Green**: `realtime-atoms.test.tsx` 8/8 (Root data-attrs + no chrome, AsyncAction label-unchanged + aria-busy, progress indeterminate/determinate/null, accessible-status mirrors topology). Command: `pnpm --filter @openspecui/web exec vitest run --project unit src/components/realtime/realtime-atoms.test.tsx`.
- **Evidence type**: unit (focused Vitest lane). Storybook fixtures remain a P5 task.

### Root-action-state authority-decoupling (Slice 2A follow-through)

- **Owner files**: `packages/web/src/lib/use-root-action-state.ts`, `use-context-subscription.ts` (read-only consumer).
- **Discovery**: the Slice 2A root-cause fix exposed a hidden coupling — `selectRootActionState` derived the root-action lock from the boolean `isLoading`. With reconnect no longer flipping `isLoading`, a `ready` cached Root Context projection during reconnect would wrongly unlock root actions, violating the 6.11-law "cached data is display-only during reconnect".
- **Fix**: `selectRootActionState` now takes `authorityState: 'current' | 'waiting' | 'failed'` and locks root actions when authority is not `current` (`input.authorityState !== 'current'`), independent of `isLoading`. `isLoading` still covers the true first load. This is the correct decoupling: UI loading presentation and mutation authority are now separate facts.
- **Green**: `use-root-action-state.test.ts` 4/4 (updated helper to pass `authorityState`); `use-context-subscription.test.tsx` 2/2 (the "keeps cached A displayable and root actions locked through lifecycle states" case now passes via the authority lock).
- **Evidence type**: unit (focused Vitest lane).

### Slice 3 — inventory/regional route migration (complete)

Migrated 9 of 9 inventory routes from the full-tree `route-loading animate-pulse` early-return (or local
loading copy) to chrome-preserving skeleton bodies (page header stays mounted; body renders
`RealtimeSkeletonInventory` / `RealtimeSkeletonCard`; progress shown via `RealtimeProgress` where a
projection emits it):

- `routes/change-list.tsx` — replaced early-return with page-chrome + skeleton + `RealtimeProgress`; 14/14 existing tests green (the negative `Loading changes...` assertions still pass; the retained-row `Refreshing changes...` status preserved).
- `routes/archive-list.tsx` — same pattern; updated `archive-list.test.tsx:79` SSR test to assert the new visual skeleton (`rt-skeleton`) rather than the removed `Loading archived changes...` text; 9/9 green.
- `routes/spec-list.tsx` — same pattern; 10/10 green (negative assertions preserved).
- `routes/schemas.tsx` — same pattern; (no dedicated route test file; covered by typecheck).
- `routes/dashboard.tsx` — replaced the summary early-return with page-chrome + 6 skeleton cards + skeleton inventory; replaced the regional `Loading dashboard trends...` text with a 2-card skeleton region. Regional isolation preserved (Summary current while Trends/Git wait). Updated `dashboard.test.tsx:387` to assert the trends skeleton region instead of the removed text; 17/17 green.
- `routes/context.tsx` — replaced inline `Loading context...` with `RealtimeSkeletonInventory` (chrome already preserved); updated `context.test.tsx:77` to assert the visual skeleton; 11/11 green.
- `routes/git.tsx` — **token-authority/reconnect-lock preserved**: both hard-return gates (`scopeNonAuthoritative` and `overviewQuery.isLoading && !overview`) remain hard blocks per the Git repository-rebind law (cached scope data is not made current during reconnect). Only the wait presentation changed to a skeleton region (`data-testid="git-loading-region"`). Updated `git.test.tsx` (5 assertions across scope/overview gates) from text to the testid; 17/17 green.
- `routes/search.tsx` — demand-driven: replaced the local `Searching...` + `Loader2` spinner with a `RealtimeSkeletonInventory` result region (stays local to the result area, no server-push claim). Updated `search.test.tsx:301` to assert the skeleton; removed now-unused `Loader2` import; 10/10 green.
- Notifications has no route-level loading gate (item-level only); no migration needed.

### Slice 4 (partial) — detail routes + Config loading surfaces

Migrated the detail-loading and Config-section loading bodies from `route-loading animate-pulse` text to
visual skeletons. The shared-element detail header stays mounted (so the detail View Transition does not snap);
only the body becomes a luminance skeleton. Git detail authority gates stay hard blocks (token-authority
preserved), matching the Git list migration.

- `components/opsx/opsx-detail-layout.tsx` — `OpsxDetailLoadingPage` body changed from `OpsxDetailStatePanel` text to a `RealtimeSkeletonInventory` + hidden `rt-sr-status` live region (a11y equivalent). Header preserved.
- `routes/spec-view.tsx` — `SpecLoading` body changed to skeleton; updated `spec-view.test.tsx:191` to assert `rt-skeleton`; 6/6 green.
- `routes/git-view.tsx` — 3 loading branches (scope-authority gate, detail-with-handoff body, detail-without-handoff) changed to skeletons (`data-testid="git-detail-loading"`); authority gates stay hard blocks. Updated `git-view.test.tsx` (4 assertions); 12/12 green.
- `components/config/{active-root,environment-global,project-binding}-config-section.tsx` — loading bodies changed to skeletons (visual-only; draft/mutation logic untouched per the Config surface ownership law). Updated 2 config tests to assert `rt-skeleton`; 52/52 green across the 3 sections.

Remaining P4 surfaces: settings/translation panels, overlay/dialog/editor bodies, terminal-command controls (`AsyncAction` adoption), file-preview/artifact-output loading. These use inline `Loader2 animate-spin` / section copy rather than `route-loading`; they migrate to atoms in the next pass.

### Slice 4 (remaining) + P5 static truthfulness

- `routes/settings.tsx` — replaced the last routine `Loading...` copy (Project Directory resolution) with a `RealtimeSkeletonLine`; 60/60 settings tests green. Remaining `Loader2 animate-spin` instances are command-feedback indicators (`saveMutation.isPending` etc.), which are permitted command activity per law (label-preserving); they are not routine lifecycle copy.
- P5 static truthfulness: added `lib/realtime/static-truthfulness.test.ts` proving a static snapshot renders as `current`/`empty` and never synthesizes `revalidating`/`initial-loading`/`server-push`/`reconnect`; 3/3 green. Required static tests (`entry-client-static.test.tsx`, `static-data-provider.opsx.test.ts`) 10/10 green. Clean SSG rebuild (`rm -rf dist-ssg .vite && build:ssg`) succeeds; rendered `index.ssg.html` contains no fabricated skeleton/loading — static mode reuses the same atoms but projects only real snapshot data.

### Mirror-geometry skeleton refactor (2026-07-24 owner direction)

Owner feedback: skeleton 之间需要有 gap，结构需符合客观布局情况。参考 shadcn 组合思想，项目化定制（项目无 components.json，现有组件是自研 brutalist 直角风格）。

- **Atom 重构** (`components/realtime/realtime-skeleton.tsx`): `RealtimeSkeletonInventory` 新增 `mode: 'list-divide' | 'grid-cards' | 'plain'`。`list-divide` = `border divide-y rounded-lg`（镜像 change/archive/spec/git 列表惯例，行紧贴靠分隔线）；`grid-cards` = `grid gap-3`（镜像 dashboard 指标网格）；`plain` = `space-y-2`（默认有 gap，杜绝挤压）。修复了 React key 警告（Fragment 包裹 renderRow）。
- **路由镜像 skeleton** (`components/realtime/route-skeletons.tsx` 新增): `ChangeListSkeleton`/`ArchiveListSkeleton`/`SpecListSkeleton`（icon+标题+副行+Badge/计数的镜像行）、`GitWorktreeSkeleton`（border px-2.5 py-2 镜像 WorktreeRow）、`DashboardSummarySkeleton`（grid-cols-2..6 ×6 卡片）、`DashboardTrendsSkeleton`（sm:grid-cols-2 ×2 卡片）、`DetailPanelSkeleton`（堆叠内容行）、`ConfigFormSkeleton`（section border p-4 + header + labeled 字段行）。
- **各路由接入**: change-list/archive-list/spec-list/schemas → 列表镜像；dashboard → summary+trends 网格镜像；git/git-view → worktree+detail 镜像（token-authority 硬门保留）；spec-view/OpsxDetailLoadingPage → detail 面板镜像（shared-element header 保留）；3 个 Config section → form 镜像（draft 逻辑未碰）；context → detail 面板；search → 结果行镜像。
- **测试**: `route-skeletons.test.tsx` 9/9 断言镜像结构（divide-y/border、grid 列数、gap、section+字段行）+ 默认 plain gap 不挤压。
- Evidence type: unit (focused Vitest lane).

### Aggregate Phase-1 evidence so far

- Focused lane (all new + migrated files + static + skeleton refactor): **291/291 green** (23 files, incl. required static tests).
  `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/realtime/ src/components/realtime/ src/lib/use-subscription.reconnect.test.tsx src/lib/use-subscription.test.tsx src/lib/use-root-action-state.test.ts src/lib/use-context-subscription.test.tsx src/routes/change-list.test.tsx src/routes/archive-list.test.tsx src/routes/spec-list.test.tsx src/routes/context.test.tsx src/routes/dashboard.test.tsx src/routes/git.test.tsx src/routes/search.test.tsx src/routes/spec-view.test.tsx src/routes/git-view.test.tsx src/routes/settings.test.tsx src/components/config/active-root-config-section.test.tsx src/components/config/environment-global-config-section.test.tsx src/components/config/project-binding-section.test.tsx src/entry-client-static.test.tsx src/lib/static-data-provider.opsx.test.ts src/components/realtime/route-skeletons.test.tsx`
- `pnpm --filter @openspecui/web exec tsc --noEmit -p tsconfig.json`: **clean** (0 errors).
- `pnpm exec prettier --check <my files>`: **all matched files pass** (pre-existing dirty files unrelated to this Change remain; they are not staged).
- `pnpm exec oxlint <my files>`: **0 warnings, 0 errors**.
- `openspec validate refine-live-projection-experience --strict`: **valid** (unchanged — no delta-spec edits).
- Static SSG: `rm -rf packages/web/dist-ssg packages/web/.vite && pnpm --filter @openspecui/web build:ssg` **succeeds**; rendered static HTML contains no fabricated loading/skeleton.

### Residual risk / open items

- P1 is no longer blocked by P0. P1-A is intentionally limited to the Dashboard Summary v2 vertical slice;
  Trends, Git, Changes, P1 coalescing, and user-action bypass remain separate unchecked work.
- P3 is complete (9/9 routes). P4 is partially done (detail routes + Config loading sections). Remaining P4: settings/translation panels, overlay/dialog/editor bodies, terminal-command controls (`AsyncAction`), file-preview/artifact-output. P5 static/a11y fixtures + Storybook + `build:ssg` + full `pnpm test:ci` remain open (Phase 1/2).
- The inline `Loader2 animate-spin` / section-copy idiom persists in the remaining P4 surfaces; those migrate to atoms in the next pass.

### Completed planning evidence

- Added delta specs for `realtime-projection-experience`, `live-projection-work`, `web-rendering`, `opsx-ui-views`, `opsx-config-center`, and `opsx-terminal-panel`.
- Ran `openspec validate refine-live-projection-experience --strict` successfully on 2026-07-23 Asia/Shanghai.
- The recorded Web-first candidate is not checkbox-complete until independent review accepts its named
  evidence. P1-A is the next authorized applied-code package.

Every TypeScript/TSX production and test file created by these packages must have its timestamped orthogonal-intent/original-request header. Each package starts with its named red case at the real public or mutation boundary, records its actual failure, then adds the green and mutation-resistance proof. A passing transpile-only fixture, a disabled-control assertion, or a manually invoked downstream callback does not satisfy that evidence requirement.

### Runtime invariants to preserve during application

```text
invalidate(identity, generation, cause)
                 |
                 v
       bounded client pull / acceptance gate
                 |
        +--------+--------+
        |                 |
        v                 v
matching current      retained display-only
commit                + local failure/recovery evidence
```

- Only a matching current pull commits business content or causes a changed-item settle cue. A push never commits content itself.
- Retained `display-only` content is readable/selectable/copyable; it never grants current-dependent mutation authority.
- Changes progress, Dashboard regional arrival, Root Context authority, and Git Code/Planning binding tokens remain source facts. The new presentation layer does not flatten them into `isLoading`.
- A local dirty draft, pending save, or open editable overlay remains its own owner. Remote revalidation becomes local update-available evidence and must not replace the draft, close the overlay, or change a command label.
- Normal lifecycle is visual: stable skeleton geometry, local luminance, native settling, and truthful progress. Errors, empty conclusions, conflicts, blocks, recovery actions, and raw evidence remain textual.
- Static mode does not synthesize Live/revalidation activity. The global Status Bar remains the sole global connection-status surface.

## Decisions Taken

1. The approved presentation topology is `idle | initial-loading | empty | initial-error | partial | current | revalidating | refresh-error`, with `authority` and `cause` as orthogonal facts.
2. The migration uses a shadcn-style composition model: headless adapters/reducer, visual atoms, then route/overlay composition. No monolithic state panel, forced Card, or page-layout ownership is permitted.
3. The target protocol is a breaking version-2 invalidation/pull contract. It preserves exact projection identity and generation, has no v1 compatibility alias, and does not add a parallel frontend truth source.
4. Normal waits use existing theme tokens, native CSS, View Transitions, stable DOM keys, and `overflow-anchor: auto`. `motion/react`, hand-rolled JS animation loops, fake percentages/ETA, global loading overlays, and routine visible lifecycle copy are rejected.
5. Command labels remain commands. Shared `Button.activity` becomes the visual lock foundation; a local activity treatment and hidden accessible equivalent replace `Saving...` or equivalent label substitutions.
6. Current Web surfaces are migrated as one Change, but the implementation remains package-ordered so each transport and lifecycle failure can be isolated before later route edits conceal it.
7. Automated evidence stops at focused Vitest, Storybook, basic browser fixtures, static rebuild, and repository gates. Final end-to-end browser walkthrough and acceptance remain owner responsibilities.

## Divergence Notes

- No divergence from `research-plan.md` has occurred at artifact creation time.
- No frontend or backend implementation has been started, so there is no source/test evidence to report yet.
- Delta specifications are now present and `openspec validate refine-live-projection-experience --strict` passes. This is Change-document validity only; it is not a claim that source implementation, tests, CI, or browser acceptance has passed.
- The completed `accelerate-live-projection-loading` Change remains archived and its durable `live-projection-work` specification remains the baseline. This Change extends that baseline rather than reopening the archived work.

## Loopback Triggers

Return to `research-plan.md` and obtain an explicit owner decision before progressing when any of the following occurs:

1. A target projection cannot provide a typed current pull plus identity/generation evidence without weakening existing Root, Store, Git, or CLI provenance, or requires a second unrestricted data source.
2. A source cannot distinguish initial, partial, current, revalidating, and retained-failure facts honestly, making one of the eight target states invented rather than observed.
3. Draft/overlay protection requires a global draft store, cross-overlay ownership, navigation/layout changes, or a change to Config/Terminal domain semantics.
4. A required visual atom needs to impose a Card, page grid, navigation behavior, manual scroll/focus bookkeeping, or changes the pending Kanban PR's scope.
5. Static output cannot use the same display mapping without fabricating live/revalidation activity, or SSG structure requires a separate display implementation.
6. The named red test cannot fail at the real lifecycle or mutation owner, or its mutation-resistance proof can be masked by an earlier guard.
7. A full-surface migration reveals a separate product decision about caching, persistence, Worker execution, service-worker behavior, polling, cross-project orchestration, or notification policy that was not approved here.
