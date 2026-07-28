<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Turn the owner's full-surface waiting-experience request into an evidence-led realtime projection plan.
2. Define one composable visual lifecycle over current, partial, stale, failed, and static projection facts.
3. Inventory every current Web/App route and overlay without changing information architecture or the pending Kanban layout work.
4. Set production owners, red/green proof, mutation-resistance, and owner-only browser-acceptance boundaries for implementation.

Original request (2026-07-23): "布局方面暂时不需要改动，后续社区有一个PR我会合并进来，那是关于kanban 的一个pr。所以本次change的主要优化点，在于更友好的UIUX，优化用户等待信息的时间感知。"
Original request (2026-07-23): "一次性把现有的页面都统一整改，因为这涉及到统一组件的封装和开发。全部改动，才能在中途暴露出所有隐含的可能、状态。这对于我们组件化的封装和开发非常重要。"
Original request (2026-07-23): "不用显示文字，可以用光影来替代，将它做成一种视觉语言，其实包括加载中等状态也是，尽量不要使用文字，而是使用视觉语言（动画、光影）等技术。"
Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）"
Original request (2026-07-27): "我已经全面走查了，结果是指的肯定的，绝大部分功能基本都通过了，更多的问题是在一些 UI/UX 的问题上，这属于后续需要打磨的问题。"
Original request (2026-07-28): "backend a 会重新打开一个浏览器窗口，而不是聚焦原本的窗口；从底层封装，后续可能对接 OpenTray 原生窗口。"
Owner acceptance feedback (2026-07-28): "基本全部通过。列表骨架之间需要 gap 或分割线；Static 导出后的 /context 页面没数据。"
-->

## Research Findings

### Current implementation facts

| Fact                                                                                                 | Objective evidence                                                                                                                                                                                                                                                                                                                                                          | Consequence for this Change                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live Projection Work is provenance-bound and progressive.                                            | `packages/server/src/projection-work/types.ts` defines identity, freshness, work generation, stage, batch, completion, and failure. `ChangesProjectionService` emits individual rows and real progress; Dashboard owns independent Summary, Trends, and Git Work streams.                                                                                                   | The visual layer must retain these facts. It cannot infer progress, freshness, or update completion from a boolean or page copy.                                                                                                                                                                    |
| The current transport is snapshot push, not the agreed push-to-pull contract.                        | `ProjectionWorkEvent` carries snapshots and batches over the WebSocket; `createPlanningRootProjectionWorkSubscription` forwards those events directly. `useSubscription` commits `onData` to its cache.                                                                                                                                                                     | The new contract must be explicit: a server event invalidates one identity; a typed client pull returns the current identity and generation; only that matching pull may commit business content. This must be a protocol migration, not a relabel of the existing stream.                          |
| Web subscription state is fragmented.                                                                | `useSubscription` exposes `data/isLoading/error`; `useReactiveProjectionSubscription` adds `isUpdating`; `useAuthoritativeSubscription` adds current versus waiting/failed authority; `useChangesSubscription` independently adds batches, row errors, and progress.                                                                                                        | A normalized headless model is required before visual migration. Existing source-specific facts remain attached as typed metadata instead of being discarded.                                                                                                                                       |
| There is already a late-publication boundary but it is not a complete presentation contract.         | `SubscriptionLifecycleOwner` retires hook generations before state/cache publication. Root Context and Git separately use `AuthoritativeSubscriptionState`.                                                                                                                                                                                                                 | The new adapter must preserve retirement, identity, Root/Store/Git provenance, and write locks while projecting a single visual lifecycle. It must not turn cached data current.                                                                                                                    |
| Route-wide loading copy remains common.                                                              | Dashboard, Changes, Archives, Specs, Schemas, Context, Git, Git detail, detail layouts, Config sections, Settings, Search, and translation surfaces render `route-loading`, `animate-pulse`, spinners, or changing `Saving...` labels.                                                                                                                                      | Initial geometry and local revalidation need reusable primitives; retained content must not disappear behind a page-wide wait state.                                                                                                                                                                |
| Global connection truth already has an owner.                                                        | `use-server-status.ts` and `components/layout/status-bar.tsx` own Live, offline, and reconnecting presentation.                                                                                                                                                                                                                                                             | Local regions show only their local effect. This Change does not duplicate a WebSocket status indicator in every page.                                                                                                                                                                              |
| The base UI already supports the intended direction.                                                 | `Button` has an `activity` lock; `index.css` has theme tokens, View Transitions, and `prefers-reduced-motion`; `view-transitions-toolkit` is installed. `overflow-anchor` is not currently used.                                                                                                                                                                            | Reuse native CSS and existing View Transition ownership. Add composable visual atoms and native scroll anchoring rather than `motion/react`, JS animation loops, or manual focus/scroll bookkeeping.                                                                                                |
| The repository can test components, but final walkthrough remains human-owned.                       | Web has Vitest unit coverage and a Storybook Vitest/Playwright project; existing stories are narrow. Project policy reserves final end-to-end browser acceptance for the owner.                                                                                                                                                                                             | The Change can require focused unit, Storybook, and basic fixture evidence. It must explicitly stop before claiming final browser acceptance.                                                                                                                                                       |
| A fresh browser Document cannot reuse Web module-local cache.                                        | `subscription-lifecycle.ts` stores snapshots in a module-local `Map`; `ProjectionWorkRegistry` retains bounded snapshots on the Server, but `DashboardProjectionService.getSummary()` waits for a current replacement rather than returning the retained typed state. Measured same-Server Dashboard reload remained about 6.35s and the threshold red case reached 12.81s. | A typed read must expose retained `stale-display-only` data immediately and then converge through the existing wake/pull generation gate. Browser persistence is neither required nor allowed.                                                                                                      |
| App Store and Root Context owners wait for the first WebSocket notice before their first typed Pull. | `use-store-data.ts` connects Store list/Doctor transports but calls `pull()` only from `onNotice`; `connection-observation.tsx` probes health and connects Root Context transport but returns without an initial Pull when `invalidateProjection` is false.                                                                                                                 | Initial mount and fresh Document must Pull once immediately. The notice remains lifecycle invalidation, not the only admission signal.                                                                                                                                                              |
| App route ownership currently destroys the Sessions runtime.                                         | `SessionsRoute` owns `HostedShell`; navigating away unmounts the route and every iframe. Existing HostedShell tests cover updates inside a mounted shell, not App route transitions.                                                                                                                                                                                        | `HostedShell` must move under persistent `AppLayout`; `/sessions` controls visibility only. A unit-level router fixture must prove iframe DOM identity survives route round-trips.                                                                                                                  |
| App loading presentation is not yet aligned with the shared lifecycle language.                      | Store Inventory, Store Inspector, and Context Matrix use text `LoadingView`; Environment can render an empty conclusion while backend observations are still `checking`; Connections adds a global text spinner after retaining its rows.                                                                                                                                   | Reuse Web realtime skeleton/cue atoms from the App's existing Web source import boundary, preserve local rows, and reserve text for terminal empty/error conclusions.                                                                                                                               |
| Start-command presentation is browser-coupled below Server readiness.                                | `coordinateStartCommandBrowserTarget` injects `openBrowser(target: string)` and constructs a private URL before calling it. The installed PWA manifest already declares `launch_handler.client_mode: focus-existing`; the same-origin App relay calls `window.focus()`, but a browser leader acknowledgement leaves the new source Document open.                           | Replace the raw browser callback with one semantic presentation request. Keep URL construction inside the Browser presenter; retire any successfully forwarded transient source best-effort. A future OpenTray presenter consumes the same backend/credential intent without browser URL ownership. |

### Full-surface inventory

| Surface family                     | Physical surfaces                                                                                                                                                                     | Current fact owner                                                                                                                              | Required migration boundary                                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inventory and regional projections | `dashboard.tsx`, `change-list.tsx`, `archive-list.tsx`, `spec-list.tsx`, `schemas.tsx`, `context.tsx`, `notifications.tsx`                                                            | Dashboard regional subscriptions, Changes batches, Archive reactive subscription, ordinary catalog/config subscriptions, Root Context authority | Preserve independent regional arrival. Dashboard may show Summary while Trends or Code Git revalidates; Changes may show partial rows and real progress; Root/notification authority stays truthful.          |
| Detail and workflow routes         | `change-view.tsx`, `archive-view.tsx`, `spec-view.tsx`, `git-view.tsx`, `opsx-new.tsx`, `opsx-compose.tsx`, `opsx-propose.tsx`, `opsx-verify.tsx` and OPSX detail/output components   | Detail subscriptions, OPSX status/instruction/artifact subscriptions, Git query state                                                           | Replace detail-wide loading text with stable detail skeletons and local output/file states. Keep raw CLI evidence and workflow instructions textual.                                                          |
| Git, Search, and Terminal          | `git.tsx`, `git-view.tsx`, `search.tsx`, `terminal.tsx`, Git panels, terminal dispatch controls                                                                                       | Git binding authority, TanStack query state, debounced search, terminal stream/session state                                                    | Git keeps Code/Planning token locks; Search gets local input/result geometry without pretending it is server-pushed; Terminal preserves raw stream/log text and receives only control-level pending feedback. |
| Config and Settings                | `config.tsx`, `settings.tsx`, `settings-static.tsx`, `settings-translation-panel.tsx`, Project Binding, Active Root, Environment Global, OpenSpec diagnostics/initialization sections | Root action state, planning-config subscriptions, local drafts, mutation state, tool/model streams                                              | Revalidation never overwrites a dirty draft or open editor. Display-only content remains selectable, while current-dependent saves remain locked. Static settings expose only real static facts.              |
| Overlays, editors, and commands    | Global archive modal, folder editor/viewer, pop area, terminal spawn/shell dialogs, translation/model dialogs, tool-initialization controls, shared buttons/popovers/drawers          | Local mutation state, preview/file query state, dialog drafts, routed overlay lifecycle                                                         | Give each operation a local visual pending lock without changing its command label, closing its overlay, or replacing a draft. Menus and overlays retain their existing layout and ownership.                 |
| App orchestration surfaces         | Connections, Environment, Store Inventory, Store Inspector, Context Matrix, persistent Sessions iframe                                                                                | App-lifetime Connection/Mutation owners, Store Push/Pull adapter, HostedShell tab runtime                                                       | Pull Server projections before the first notice, distinguish unresolved from empty, retain readable same-locator data during revalidation, and preserve iframe identity across App route changes.             |

### 2026-07-27 loopback: fresh-document and App continuity

```text
fresh browser document              App project route transition
        |                                      |
        v                                      v
module cache empty                    AppLayout remains mounted
        |                                      |
        v                                      v
typed Server read -> retained data    HostedShell remains mounted + hidden
        |                                      |
        v                                      v
display-only + background current     same iframe Document/session resumes
```

The earlier Web-only inventory was incomplete. The owner explicitly expanded the same waiting problem to all
similar pages, especially the new App surfaces. This is loopback trigger 7: a cross-document retention and
stateful App-route ownership decision. The approved resolution does not add browser persistence or polling.
It reuses Server Projection Work, performs one admission Pull before lifecycle notices, and elevates the
stateful iframe runtime to the already-persistent App layout owner.

## Decision & Plan (For Approval)

### 1. Make the realtime contract explicit

The target lifecycle is push-to-pull. A push is a wake-up fact, never replacement business content.

```text
filesystem / CLI / mutation / reconnect / root rebind
                         |
                         v
server: invalidate { identity, generation, cause }
                         |
                         v
client: join bounded same-identity revalidation window
                         |
                         v
typed pull: current snapshot { identity, generation, content, progress }
                         |
             +-----------+-----------+
             |                       |
             v                       v
matching current commit       failure keeps prior display-only evidence
             |                       |
             v                       v
settle visual state           refresh-error + recovery action
```

Implementation creates one version-2 realtime projection protocol at the Server and Web boundary. It carries an identity-only invalidation event and a typed current-snapshot read. The pull result is accepted only when both identity and generation still match the active Web owner. No v1/v2 dual semantic route, raw JSON fallback, optimistic business-data write, or client-side reconstruction of a Planning root is allowed.

Bursty invalidations for one active identity join a bounded coalescing window. A user command, terminal completion, retry, and explicit root rebind bypass that delay. Hidden routes do not subscribe or prewarm only to make a later visual state look fresh.

### 2. Normalize presentation facts before rendering

Introduce a type-safe, headless `RealtimeProjectionState<T, TMeta>` family under a dedicated Web module. It adapts Projection Work, ordinary subscriptions, authoritative subscriptions, TanStack query state, and local command state without erasing their actual source facts.

```text
content topology

no content                         has displayable content
-----------                        ----------------------
idle                               partial
initial-loading                    current
empty                              revalidating
initial-error                      refresh-error

orthogonal facts on every state
-------------------------------
authority = current | display-only
cause     = initial | server-push | user-action | reconnect | root-rebind
identity  = exact projection provenance
generation= current owner/work generation
```

| State             | Meaning                                                      | Normal visual language                                                                                                           | Interaction rule                                                                                     |
| ----------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `idle`            | No request has been admitted yet.                            | No invented motion or status copy.                                                                                               | Nothing is made current by absence.                                                                  |
| `initial-loading` | A visible surface requested its first result.                | Surface-shaped skeleton with stable dimensions and low-contrast luminance movement.                                              | Operations requiring the result are locked.                                                          |
| `empty`           | A current pull has authoritatively resolved no rows/content. | Stable empty conclusion, with text only when a conclusion or action is needed.                                                   | Current empty truth may enable the actions that are valid without rows.                              |
| `initial-error`   | First pull failed with no readable result.                   | Concise error and recovery action, never an infinite spinner.                                                                    | Failure evidence remains visible and mutations stay locked.                                          |
| `partial`         | Real batches have arrived but the Work has not completed.    | Existing rows remain anchored; new rows settle in locally. Use determinate progress only when the server supplied a known total. | Partial data is displayable; an action that requires a complete/current projection stays locked.     |
| `current`         | A matching current snapshot committed.                       | No persistent status chrome. A brief settle effect may mark actual changed rows.                                                 | Current-dependent controls may operate under their existing domain guards.                           |
| `revalidating`    | Retained content is awaiting a matching replacement.         | Keep content in place and add a subtle local luminance sweep or edge light.                                                      | Retained content is `display-only`; copy/select remains available and current-dependent writes lock. |
| `refresh-error`   | Revalidation failed after content was already shown.         | Retain readable content; expose concise local failure/retry affordance.                                                          | It remains `display-only` until a current pull succeeds.                                             |

`progress.total === 'unknown'` produces indeterminate arrival motion only. It never produces a percentage, ETA, or fabricated completion claim. Row-level failure and partial data remain independently visible facts.

### 3. Build shadcn-style visual atoms, not a page shell

The component family is compositional. Its root provides state context and `data-state`, `data-authority`, and `data-cause`; it neither creates a Card nor chooses page layout.

```tsx
<RealtimeProjection.Root state={projection}>
  <RealtimeProjection.InitialSkeleton shape="list" />
  <RealtimeProjection.RevalidationCue />
  <RealtimeProjection.Progress progress={projection.meta.progress} />
  <RealtimeProjection.Content>{children}</RealtimeProjection.Content>
  <RealtimeProjection.ChangedItem itemKey={id}>{row}</RealtimeProjection.ChangedItem>
  <RealtimeProjection.Recovery />
</RealtimeProjection.Root>
```

Planned atoms:

- A headless state root and adapter hooks that expose the normalized model and no layout ownership.
- Skeleton geometry for list, detail, editor, panel, and compact control surfaces; it reserves real dimensions and avoids reflow.
- A local revalidation cue, batch-arrival/changed-item cue, and truthful progress primitive driven only by real metadata.
- An `AsyncAction` composition over `Button.activity`, preserving the command label and icon while applying a visual lock, `aria-busy`, and hidden status equivalent. It does not replace `Save` with `Saving...`.
- A small recovery/empty/block surface for cases where text and action are necessary. It never hides raw Terminal, CLI, log, or editor content.

CSS extends existing theme tokens and native View Transition rules. It uses color-mixed luminance, pseudo-elements, stable DOM identity, and short settle transitions. Each list/stream container opts into `overflow-anchor: auto`; no manual scroll restoration, focus ledger, infinite JS animation loop, global loading overlay, persistent toast, or fixed percentage bar is introduced. The existing reduced-motion branch disables non-essential lifecycle motion while preserving contrast and semantic state.

### 4. Migrate transport adapters and routes in one Change

The migration is complete only when all listed visible surfaces use the shared model. A route may retain domain-specific rendering, but it may not add another equivalent `isLoading` interpretation.

1. Add the version-2 invalidation/pull transport and a generation-safe Web adapter. Preserve `ProjectionWorkIdentity`, Root Context authority, Git binding token, and typed error evidence. Map Changes batch rows/progress to `partial`; map Dashboard regional Work independently rather than reviving a page barrier.
2. Add visual atoms and CSS tokens, then adapt `useSubscription`, `useReactiveProjectionSubscription`, `useAuthoritativeSubscription`, Changes, Dashboard, planning config, OPSX, Search, and command mutations through typed adapters. Remove duplicate presentation branches only after their owner adapter is proven.
3. Migrate inventory routes: Dashboard, Changes, Archives, Specs, Schemas, Context, Notifications, Git, and Search. Each region keeps current content during revalidation, rather than returning a route-wide `Loading...` element.
4. Migrate details and workflows: Change, Archive, Spec, Git detail, OPSX New/Compose/Propose/Verify, artifact output, and file preview. Stable identifiers feed existing View Transitions; file or output loading stays local to the relevant pane.
5. Migrate Config, Settings, translation, dialogs, popovers, drawers, editors, archive modal, and terminal controls. A remote update observed while a draft/editor/overlay is active marks a local update-available path; it never replaces a dirty draft or closes the interaction. Static mode receives truthful snapshots only and has no synthetic invalidation/revalidation effect.
6. Remove remaining routine visible `Loading...`, `Updating...`, and `Saving...` lifecycle copy from normal paths. Keep concise text for empty conclusions, errors, authority blocks, conflicts, terminal/CLI evidence, and recovery commands.

No step changes navigation, route ownership, page grid, Kanban layout, or the future community PR's intended files. The existing Status Bar remains the only global connection-status presentation.

### 5. Work-package proof plan

| Package                                                   | Production owner                                                                                              | Precise red fixed point                                                                                                                                                                             | Green fixed point                                                                                                                                                                                                                                    | Mutation-resistance proof                                                                                                                 | Stop condition                                                                                                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1: realtime transport and reducer                        | `packages/server/src/projection-work`, server router, Web realtime adapter                                    | Start with current A, receive A invalidation, rebind to B, then resolve A's pull late. Pre-change direct snapshot handling must demonstrate why A can be committed without the new acceptance gate. | Only a matching current B pull commits; A cannot alter B cache, progress, cue, or authority. Same-identity burst invalidations perform one bounded pull; user retry bypasses the window.                                                             | Bypass/remove the identity plus generation check and show the late-A test fails at the real adapter boundary.                             | Stop for an owner decision if a projection cannot expose a typed current pull without weakening Root/Store/Git provenance or needs a second data source.   |
| P2: visual primitives                                     | Web realtime component module, `Button`, `index.css`                                                          | Render `current -> revalidating -> current` and `current -> revalidating -> refresh-error`; existing route-wide text/spinner behavior is the failing baseline.                                      | Stable geometry, local light cue, brief changed-item settle, hidden accessible equivalent, and no command-label substitution.                                                                                                                        | Remove `data-state`/reduced-motion styling or the activity lock and make the Storybook/Vitest assertion fail.                             | Stop if an atom needs to own a Card, page grid, or replace raw evidence text to render.                                                                    |
| P3: projection route migration                            | Dashboard/Changes/Archives/Specs/Schemas/Context/Notifications/Git/Search owners                              | Dashboard Summary current while Trends is pending; Changes has batches; Git reconnect retains A; Search input changes rapidly. Existing page/region loading branches expose the wrong state.        | Each affected region renders its own normalized state; Code Git remains usable under its current Code binding while Planning waits; Search remains demand-driven.                                                                                    | Remove regional identity/authority mapping and show stale data either wrongly unlocks a control or overwrites a newer region.             | Stop if a source lacks an observable identity/generation or its domain owner cannot state which controls require current data.                             |
| P4: details, Config, Settings, overlays, and commands     | OPSX detail/output, planning-config sections, Settings/translation, dialogs, folder editor, terminal controls | Dirty Config/editor or open dialog receives a remote update during save/revalidation. Existing direct state sync or label replacement is the failing baseline.                                      | Draft is retained, update availability is local, save lock follows authority, command label stays stable, and raw Terminal/CLI/editor data remains untouched.                                                                                        | Remove the dirty-generation/authority guard and show a late update clears or overwrites the active draft in the real mutation owner test. | Stop if preservation requires a global draft store, cross-overlay ownership, or altering the existing Config/Terminal domain contract.                     |
| P5: static, accessibility, and visual regression evidence | static provider, Storybook fixtures, route/component tests                                                    | Static route is made to appear Live/revalidating, or reduced-motion still runs the lifecycle animation.                                                                                             | Static snapshots state only what exists; reduced-motion has a non-motion equivalent; known and unknown progress remain truthful at desktop and mobile fixture dimensions.                                                                            | Remove the static/reduced-motion branch and prove the relevant fixture fails.                                                             | Stop if SSG structure diverges from the live adapter instead of sharing its display mapping.                                                               |
| P1-B: fresh-document retained read                        | Projection Work registry, Dashboard Summary typed contract, Server Router, Web Summary adapter                | A dormant Server snapshot exists while a new Web module cache is empty; the pre-fix typed read blocks until replacement Work is current.                                                            | The first read returns retained `stale-display-only` data immediately, the UI stays display-only, and a matching current pull later restores authority and admits secondary regions.                                                                 | Remove retained-state delivery or accept retained data as current; the same fixture must fail on latency/state or authority.              | Stop if delivery requires browser persistence, exposes filesystem provenance, or creates a second Summary truth.                                           |
| P6: App projection and session continuity                 | App Store/Root adapters, App routes/state views, AppLayout/HostedShell                                        | Mount Store/Root without a notice, render Environment while checking, and navigate Sessions -> Environment -> Sessions.                                                                             | Initial typed Pull settles retained/current Server state, unresolved is not empty, shared visual atoms replace routine loading copy, and iframe DOM identity is unchanged.                                                                           | Remove the initial Pull or persistent layout host and make the same focused fixture fail.                                                 | Stop if App must persist sensitive business snapshots, weaken locator generation, or keep ordinary hidden routes subscribed.                               |
| P8: host-neutral App presentation                         | CLI start-command presentation owner, Browser presenter, App launch owner/relay                               | The real start coordinator exposes only `openBrowser(string)`, and a browser leader returns `forwarded` without retiring the newly opened source Document.                                          | The coordinator submits a typed project-web/hosted-app presentation request; Browser builds the private URL at the last responsible moment; forwarded browser/PWA sources both retire best-effort, while local/fallback application remains mounted. | Replace semantic presenter dispatch with a raw URL callback or remove browser-forwarded retirement; the corresponding focused test fails. | Stop if ordinary browser focus is claimed as guaranteed, credentials must be logged/persisted, or OpenTray details are invented before its adapter exists. |

## Capability Impact

### New or Expanded Behavior

- Add a `realtime-projection-experience` capability specification for the eight-state presentation topology, authority/cause dimensions, push-to-pull acceptance rule, visual primitives, accessibility fallback, and static truthfulness.
- Expand `live-projection-work` so its public contract explicitly distinguishes invalidation, typed current pull, client commit eligibility, bounded coalescing, and visual lifecycle evidence.
- Add reusable Web primitives that allow any route, region, command, or overlay to compose a state cue without inheriting a layout, Card, or page shell.
- Expand `hosted-app-distribution` so App Store/Root projection admission and stateful Sessions iframe continuity follow the same retained-content lifecycle without browser snapshot persistence.
- Expand `hosted-app-distribution` with one host-neutral presentation intent. Browser/PWA and future OpenTray
  presentation are adapters, not separate Server-start workflows.

### Modified Behavior

- Modify `web-rendering`, `opsx-ui-views`, `opsx-workflow-ui`, `opsx-config-center`, and `opsx-terminal-panel` deltas only where their existing surface moves from boolean loading presentation to the shared lifecycle model.
- Keep `web-notifications` and the global Status Bar as the authority for connection truth; local routes only render their own impact.
- Preserve existing Root/Store/Git binding and Config ownership requirements. This Change changes presentation and the explicitly approved projection transport contract, not the meaning of a Planning root, Store, Reference, or Git scope.

## Risks and Mitigations

| Risk                                                                 | Mitigation                                                                                                                                                           |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A visual refactor accidentally treats stale cache as current.        | State accepts a commit only after matching identity/generation; `display-only` is an explicit authority fact and current-dependent mutations use it.                 |
| A server push fan-out causes redundant pulls or background work.     | Coalesce only active same-identity invalidations in a bounded window; foreground/user/terminal transitions bypass it; hidden routes stay cold.                       |
| Retained content disguises a failure.                                | `refresh-error`, row errors, root/CLI evidence, and recovery controls remain textual and actionable; no endless shimmer replaces failure.                            |
| A draft or overlay is overwritten by a live update.                  | Local dirty/pending generation remains the owner. Incoming data becomes update-available evidence until the user resolves, saves, cancels, or reopens.               |
| Motion is distracting, inaccessible, or causes layout movement.      | Use stable skeleton dimensions, native CSS/Views Transitions only, existing theme tokens, `prefers-reduced-motion`, hidden status text, and `overflow-anchor: auto`. |
| The all-surface migration changes the Kanban/community layout scope. | Changes are constrained to state adapters, local cues, and existing control surfaces. No route/grid/nav composition is redesigned.                                   |
| Static mode or SSG drifts from live display behavior.                | Share adapters/atoms where facts overlap; static mode has no synthetic push or update cue; rebuild and test SSG before judging output.                               |
| Automated checks are mistaken for final acceptance.                  | Agent evidence ends at focused Vitest, Storybook, and basic fixture Playwright. The owner performs the final browser walkthrough.                                    |

## Verification Strategy

1. Write each P1-P5 red test against the actual public adapter or mutation owner before implementation. Record that it fails for the named lifecycle reason; a disabled-button assertion or manually invoked downstream callback is not red evidence.
2. Add unit coverage for all eight states, `current -> revalidating -> current`, `current -> revalidating -> refresh-error`, partial batches, real known/unknown progress, coalescing, user-action bypass, reconnect, root rebind, A/B retirement, display-only write lock, dirty-overlay update availability, static mode, and reduced motion.
3. Add composable Storybook fixtures for the atoms and representative Dashboard, Changes, Config/editor, detail, and command surfaces. Exercise light/dark, compact/mobile dimensions, and the reduced-motion branch. Basic browser fixtures are preparation evidence only.
4. Run focused Web and Server lanes first, including the existing subscription, Changes, Dashboard, route continuity, Config, Settings, and Projection Work suites. Then run `pnpm --filter @openspecui/web test`, `pnpm --filter @openspecui/web test:browser:ci`, and the required repository gates: `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, and `pnpm test:browser:ci`.
5. For static-facing changes, run the required focused static tests and rebuild from fresh artifacts: `pnpm --filter @openspecui/web test -- src/entry-client-static.test.tsx src/lib/static-data-provider.opsx.test.ts`, then `pnpm --filter @openspecui/web build:ssg` after removing stale `packages/web/dist-ssg` and `packages/web/.vite` if output appears unchanged.
6. Add delta specs before strict Change validation. At this research-plan stage, strict validation is expected to remain blocked solely by the absent delta spec; later artifacts must run `openspec validate refine-live-projection-experience --strict` successfully.
7. Stop after automated evidence and hand the owner a compact manual acceptance matrix: initial open, retained-content server update, burst update, reconnect, root rebind, dirty editor/dialog, static export, reduced motion, desktop, and mobile. Do not report that walkthrough as complete unless the owner performs it.

## 2026-07-28 Hosted Presentation Research Addendum

```text
Server ready + runtime-only credential
                 |
                 v
typed presentation request
├─ project-web
└─ hosted-app { App base, backend locator }
                 |
                 v
host presenter
├─ Browser: build private URL -> installed PWA focus-existing
|                              -> ordinary page relay -> focus leader + retire source best-effort
└─ OpenTray: future native show/focus adapter
```

- A normal browser does not expose a portable CLI API that guarantees focus of an arbitrary existing tab/window.
  The product contract therefore distinguishes the installed-PWA standard path from the ordinary-browser
  best-effort relay path.
- The current PWA manifest and `launchQueue` consumer already form the standards-based native-like path. This
  package does not change their URL/credential semantics.
- The raw credential remains runtime-only. A presenter request may carry it to the selected adapter, but neither
  the public hosted URL, logs, persisted shell state, nor leader storage may contain it.
- OpenTray is not implemented in this Change. The only approved future-facing work is the typed presenter seam;
  no OpenTray package dependency, protocol guess, feature detection, or browser fallback alias is introduced.

## 2026-07-28 Owner Acceptance Closure Addendum

```text
published ExportSnapshot
|- meta.projectName / observedAt / version
|- meta.root: display-safe path / source / writable Store id
`- meta.referencePolicy: none | omit(count) | include(Store summaries)
                 |
                 v
Static /context: published facts only
                 X no CLI availability/raw evidence
                 X no registry/data-home/envUri
                 X no inferred Reference health
```

- `RealtimeSkeletonInventory(mode="list-divide")` currently depends on `divide-y`; the owner observed that the
  default `rt-skeleton-row h-14` surfaces still read as one clumped block. The physical owner is the shared mode
  container. It must create an explicit one-pixel separator without page-local margins or route-specific patches.
- Static `/context` is registered in the static router but is absent from the SSG route manifest, and
  `useContextSubscription` deliberately resolves to a permanent pending placeholder in static mode. The published
  snapshot already contains sufficient redacted facts. No `ExportSnapshot` expansion or fabricated `RootContext`
  is required.
- Static Context keeps the route because deleting it would fork live/static information architecture. It projects
  only the redacted root provenance, Reference export policy, project label, snapshot version, and observation time;
  unavailable runtime facts are stated explicitly rather than synthesized.

## 2026-07-27 Manager Walkthrough Research Addendum

| Observation                                                      | Production owner                                                       | Evidence and interpretation                                                                                                                                                                                                                                                                                  | Planning decision                                                                                                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Project Web with missing/invalid credential never exits Loading. | `packages/web/src/entry-client.tsx` live bootstrap before `App` import | Server HTTP and PTY guards correctly return unauthorized. The entry has no protected health admission and imports navigation, tRPC, WebSocket, and PTY owners, so every downstream surface independently rejects/reconnects. This is one missing authentication terminal-state owner, not many loading bugs. | Add an entry admission state machine. Never hide 401 inside PTY/tRPC or render the normal App before admission.                   |
| Terminal Clipboard is blocked inside App iframe.                 | App-owned iframe capability policy                                     | `HostedShellTabContent` emits no `allow`; Terminal keybindings use the Clipboard API. The Gate transport itself passed, so this is capability delegation, not credential delivery.                                                                                                                           | Delegate only Clipboard read/write. Browser execution remains manager acceptance because jsdom cannot enforce Permissions Policy. |
| SessionTabs Offline icon can lag the iframe.                     | accepted connection observation generation and tab presentation        | Both current branches derive from `tabRuntime`, but `ConnectionObservationOwner.refresh()` publishes `checking` before the terminal probe and tab rendering passes through shared Tabs composition. The observation is intermittent, so no root cause is yet proven.                                         | First reproduce at the owner-to-Tabs boundary; do not add polling or a second iframe-reported connection fact.                    |
| Inspector feels rebuilt after blur/focus.                        | App focus-triggered connection refresh plus Store Inspector projection | Focus and visible-document events explicitly call the shared connection owner's refresh. Current evidence does not prove React unmount; revalidation skeleton/cue and delayed CLI settlement can resemble reconstruction.                                                                                    | Test component identity, selection, settled content, and projection generations separately before choosing a fix.                 |
| Static export fails after a successful clean SSG build.          | Vite SSR output contract consumed by `packages/web/src/ssg/cli.ts`     | Fresh Vite 8 output on 2026-07-27 is `dist-ssg/server/assets/entry-server-IoFG1Olv.js`; the CLI imports `dist-ssg/server/entry-server.js`. A build-only check cannot prove export.                                                                                                                           | Publish/consume a build-owned manifest or deterministic entry; add a real clean-build -> CLI export fixture.                      |
| Mobile Inspector and Sessions overflow.                          | Store Inspector inline-size containment; App shell block-size budget   | Long path/metadata/diagnostic facts lack complete narrow-container containment. AppLayout owns a mobile header while HostedShell and its Tabs surface each declare `min-h-screen`.                                                                                                                           | Fix each physical owner independently. Preserve navigation and iframe persistence; this is containment, not a layout redesign.    |
