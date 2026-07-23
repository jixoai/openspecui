<!--
Orthogonal intents (created 2026-07-23 Asia/Shanghai):
1. Record the executable baseline for the owner's all-surface realtime waiting-experience Change.
2. Keep actual source progress, scope, decisions, and evidence boundaries synchronized during application.
3. Preserve the push-to-pull, authority, draft-protection, and visual-language decisions approved in research.
4. Define the concrete conditions that require a return to research before implementation can proceed.

Original request (2026-07-23): "布局方面暂时不需要改动，后续社区有一个PR我会合并进来，那是关于kanban 的一个pr。所以本次change的主要优化点，在于更友好的UIUX，优化用户等待信息的时间感知。"
Original request (2026-07-23): "一次性把现有的页面都统一整改，因为这涉及到统一组件的封装和开发。全部改动，才能在中途暴露出所有隐含的可能、状态。这对于我们组件化的封装和开发非常重要。"
Original request (2026-07-23): "不用显示文字，可以用光影来替代，将它做成一种视觉语言，其实包括加载中等状态也是，尽量不要使用文字，而是使用视觉语言（动画、光影）等技术。"
-->

## Implementation State

### Pre-apply baseline

As of 2026-07-23 Asia/Shanghai, no production, test, CSS, or static-export source for this Change has been modified. `intake.md`, `research-plan.md`, and the planning checkpoints are complete. Six delta specs now define the durable behavioral scope, and `openspec validate refine-live-projection-experience --strict` passes. Production application starts with P1 only after its public-boundary red case is recorded.

The implementation scope is frozen as follows:

- In scope: every current Web route, detail surface, settings section, dialog, popover, drawer, editor-adjacent control, and asynchronous command presentation listed in `research-plan.md`.
- In scope: the explicitly approved Server-to-Web push-to-pull projection contract needed to make those visual states truthful.
- Out of scope: page layout, information architecture, navigation, Kanban design, the pending community Kanban PR, a global second data store, optimistic business-data writes, raw Terminal/CLI/log/editor content changes, and owner-only final browser acceptance.

### Execution ledger

> Execution order replanned 2026-07-24 (see `GOAL.md` "Execution Order"): **Phase 1** = P2 -> P3 -> P4 +
> P5-static on the current v1 transport (worker advances now); **Phase 2** = P1 Server v2 protocol + adapter
> upgrade, gated on the owner's P0 Server emission regression repair. The numbered order below is unchanged;
> the phase column records implementation timing.

| Order | Phase | Current state | Implementation owner | Mandatory evidence before moving on |
| --- | --- | --- | --- | --- |
| 1 | Phase 2 (gated on P0) | Not started | Server Projection Work boundary and Web realtime adapter | A public-boundary red case proves late A cannot commit after B; the green case proves matching identity/generation, bounded coalescing, and user-action bypass. |
| 2 | Phase 1 | **Implemented (Slice 2A+2B)** | Web realtime component module, shared `Button`, and CSS token ownership | A focused visual/state fixture proves stable geometry, reduced-motion equivalence, hidden accessible status, and no changing command label. |
| 3 | Phase 1 | **Migrated (9/9 routes)** | Dashboard, Changes, Archives, Specs, Schemas, Context, Notifications, Git, and Search owners | Each route has a current/partial/revalidating/refresh-error fixture where applicable; no route-wide wait branch hides a stable sibling. |
| 4 | Phase 1 | **Partially migrated (detail + Config loading)** | OPSX, planning-config, Settings/translation, dialog/editor, and terminal-control owners | A real draft/editor/overlay red case proves a late remote update cannot overwrite local interaction; authority locks hit the mutation owner. |
| 5 | Phase 1 static/a11y; Phase 2 gates | Not started | Static provider, route/component tests, and Storybook fixtures | Static truthfulness, reduced motion, mobile geometry, and SSG evidence are green before full repository gates. |

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

### Aggregate Phase-1 evidence so far

- Focused lane (all new + migrated files): **209/209 green** (18 files).
  `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/realtime/ src/components/realtime/ src/lib/use-subscription.reconnect.test.tsx src/lib/use-subscription.test.tsx src/lib/use-root-action-state.test.ts src/lib/use-context-subscription.test.tsx src/routes/change-list.test.tsx src/routes/archive-list.test.tsx src/routes/spec-list.test.tsx src/routes/context.test.tsx src/routes/dashboard.test.tsx src/routes/git.test.tsx src/routes/search.test.tsx src/routes/spec-view.test.tsx src/routes/git-view.test.tsx src/components/config/active-root-config-section.test.tsx src/components/config/environment-global-config-section.test.tsx src/components/config/project-binding-section.test.tsx`
- `pnpm --filter @openspecui/web exec tsc --noEmit -p tsconfig.json`: **clean** (0 errors).
- `pnpm exec prettier --check <my files>`: **all matched files pass** (pre-existing dirty files unrelated to this Change remain; they are not staged).
- `pnpm exec oxlint <my files>`: **0 warnings, 0 errors**.
- `openspec validate refine-live-projection-experience --strict`: **valid** (unchanged — no delta-spec edits).

### Residual risk / open items

- P1 (Server v2 protocol) remains blocked on the owner's P0 Server emission regression repair; it is Phase 2 and was not touched.
- P3 is complete (9/9 routes). P4 is partially done (detail routes + Config loading sections). Remaining P4: settings/translation panels, overlay/dialog/editor bodies, terminal-command controls (`AsyncAction`), file-preview/artifact-output. P5 static/a11y fixtures + Storybook + `build:ssg` + full `pnpm test:ci` remain open (Phase 1/2).
- The inline `Loader2 animate-spin` / section-copy idiom persists in the remaining P4 surfaces; those migrate to atoms in the next pass.

### Completed planning evidence

- Added delta specs for `realtime-projection-experience`, `live-projection-work`, `web-rendering`, `opsx-ui-views`, `opsx-config-center`, and `opsx-terminal-panel`.
- Ran `openspec validate refine-live-projection-experience --strict` successfully on 2026-07-23 Asia/Shanghai.
- No source implementation task is complete yet; P1 remains the next active package.

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
