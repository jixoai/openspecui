<!--
Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
1. Track apply-ready Workspaces/Stores delivery as verifiable owner/red/green checkpoints.
2. Enforce spec-first, focused-review, type-safe evidence, PR, owner-acceptance, and archive boundaries.
3. Keep completed planning evidence distinct from pending implementation and delivery work.

Original request (2026-07-30): "那么请你开始撰写这份change，如果没有疑问，可以一步到位，并提交。"
Original request (2026-07-30): "Workspace需要记住曾经打开的目录，并且支持收藏。关键是，支持直接从目录直接启动 openspecui 服务。"
Original request (2026-07-30): "所有正在运行中的backend都会显示在这里。"
Original request (2026-07-30): "任务管理器...可以杀掉Workspace，或者收藏、取消收藏"
Original request (2026-07-30): "弱化端口这个概念，重点强调 path的概念。"
Original request (2026-07-30): "Tab这里默认写仓库路径 org/repo，如果没有就使用path的foldername；subtitle写git分支名"
Owner correction (2026-07-21): "每项先明确一个生产 owner、一个精准红例、一个绿例。focused review 未通过，不跑全量门禁。"
-->

## 1. Research and Planning

- [x] 1.1 Capture the manager's Workspaces/Stores, launcher, Environment integration, and Store Detail inputs
      verbatim in `intake.md` without presenting AI-derived constraints as first-hand requirements.
- [x] 1.2 Audit official OpenSpec v1.6 Store commands/root selection and record Store registry, Doctor, mutation,
      Spec-list, and Change-list facts.
- [x] 1.3 Audit current App navigation, shared Connections/Workspace tab state, daemon snapshot auto-open,
      Environment grouping, backend Store selector, hosted Store contracts, and retained Projection Work.
- [x] 1.4 Tell the user-facing Workspace Launcher and Stores index/detail stories before deriving architecture.
- [x] 1.5 Record scope, non-goals, route topology, capability impact, risk mitigations, verification strategy, and
      owner-only final browser boundary.
- [x] 1.6 Manager approves one-pass Change creation and the `governance + readonly content overview` boundary.
- [x] 1.7 Record implementation reality as `not started`; do not claim planned code or tests as evidence.
- [x] 1.8 Record the manager-approved managed lifecycle: tab Close preserves service, explicit Stop terminates,
      daemon stop affects only managed services, and daemon restart restores the managed running set.
- [x] 1.9 Audit current presentation-only daemon/project-free CLI law and record the required managed-child versus
      external-lease correction before implementation.

## 2. Main Spec Law and Public Boundary

Production owners: `openspec/specs/cli-commands/spec.md`, `openspec/specs/hosted-app-distribution/spec.md`,
`openspec/specs/hosted-environment-delivery/spec.md`, and affected browser-safe hosted contract modules.

- [ ] 2.1 Update main hosted-App law so Workspaces and Stores are the only primary App domain destinations,
      Settings is secondary, and Connections/Environment are indirect facts.
- [ ] 2.2 Specify the candidate-backed Workspace Launcher, secondary manual URL flow, Focus/Open/unavailable outcomes,
      duplicate suppression, daemon first-admission auto-open, and close/reopen behavior.
- [ ] 2.2a Specify fixed Home, canonical directory launch, favorites/history, running navigation, Task Manager,
      path-first labels, and managed versus external lifecycle authority.
- [ ] 2.2b Modify project ownership law so external commands remain foreground-owned while authenticated local App
      launch creates daemon-managed children; define stop/restart restoration without process inference.
- [ ] 2.3 Replace user-selected backend-tab Store targeting with explicit Environment selection plus internally exact
      source authority, action pinning, dispatch revalidation, and conflict behavior.
- [ ] 2.4 Specify composite `(envUri, Store id)` identity and prohibit Store-id-only routes, caches, joins, or
      mutations across Environments.
- [ ] 2.5 Specify Store index/detail information hierarchy, observed-only Usage, readonly Specs/active Changes,
      direct errors, secondary evidence, and no duplicate Project Web.
- [ ] 2.6 Specify demand-driven Store content Push -> Pull projection and additive compatibility facts without
      treating them as permission.
- [ ] 2.7 Retire main-spec language that preserves Store Inventory, Inspector, Context Matrix, or backend URL
      selection as product navigation.
- [ ] 2.8 Run strict OpenSpec validation and focused spec review before public-contract or product code proceeds.

Red evidence:

- [ ] 2.9 At the pre-fix main-spec fixed point, show that primary Connections/Environment routes and exact-tab UI
      selection are still required, contradicting the approved product story.

Green evidence:

- [ ] 2.10 Prove the updated scenarios exhaustively define launcher, Environment authority, composite Store
      identity, readonly content, managed lifecycle, path presentation, realtime, and retirement outcomes without
      weakening credential or mutation law.

## 3. Directory Catalog, Managed Backends, Candidates, and Open State

Production owners: focused CLI daemon child/control modules and pure App state modules under `packages/app/src/lib/`;
`HostedShell` consumes but does not redefine their transitions.

- [ ] 3.0 Add checked red evidence that the current daemon cannot start one project from an authenticated directory
      intent and current persistence has no canonical favorite/recent catalog.
- [x] 3.0a Define a runtime-parsed versioned directory catalog containing only canonical path, favorite, and recency;
      reject credentials, URLs, ports, process ids, and generation authority.
      Delivered 2026-07-30: `packages/app/src/lib/workspace-directory-catalog.ts` owns the versioned
      credential-free catalog (canonical path + favorite + recency). `parseWorkspaceDirectoryCatalog`
      rejects wrong-version/malformed storage as empty (no repair), dedupes by canonical path, and drops
      malformed entries. `recordSuccessfulDirectoryOpen`/`setDirectoryFavorite`/`removeDirectoryEntry` keep
      favorite ordering independent of recency/runtime. `selectWorkspaceDirectoryCatalogView` projects
      Favorites-then-recent. Checked `workspace-directory-catalog.test.ts` proves no
      credential/URL/port/generation/pid leakage, favorite independence, and malformed rejection.
- [ ] 3.0 Add checked red evidence that the current daemon cannot start one project from an authenticated directory
      intent and current persistence has no canonical favorite/recent catalog.
      (Characterized 2026-07-30: the current daemon protocol exposes only `register-workspace` and has no
      `start-managed-project` command; `daemon-server.ts` routes presentation only and never spawns. The new
      `managed-project-owner.test.ts` "remote-caller" and "invalid-directory" cases prove a start request is rejected
      before spawn, and `daemon-server.test.ts` "rejects managed-project start when the daemon owns no managed control"
      proves the unsupported-delivery boundary. 3.0a catalog covers the missing-persistence half.)
- [x] 3.0b Physically canonicalize and validate the directory before spawn; single-flight concurrent aliases and key
      managed ownership by physical identity.
      Delivered 2026-07-30: `managed-project-owner.ts` keys children by `canonicalProjectDir`, single-flights concurrent
      starts per identity, and rejects invalid/non-directory targets before spawn. Production canonicalizer
      (`canonicalizeProjectDirectory`) resolves `fs.realpath` + `stat.isDirectory`. `managed-project-owner.test.ts`
      proves symlink/repeat alias join one child and concurrent submissions spawn exactly once.
- [x] 3.0c Start only a fixed internal serve plan, await readiness, admit one lease, and expose concrete startup state;
      reject caller-supplied command vectors and remote App authority.
      Delivered 2026-07-30: `createProductionManagedSpawner` runs the fixed `startServer` plan (projectDir +
      accessGateCredential + webAssetsDir only; no caller argv/port; `open:false`) and the owner admits one Workspace
      lease per settled startup. Remote callers are rejected before canonicalization. `daemon-protocol.ts` adds the
      authenticated `start-managed-project`/`stop-managed-project` commands and `managed-project-started/stopped`
      wire data; `daemon-server.ts` delegates to an injected `DaemonManagedProjectControl` and rejects when absent.
- [x] 3.0d Implement exact managed Stop, daemon-stop child settlement, and restart-only capture/restore of the
      previously running managed directory set.
      Delivered 2026-07-30: `ManagedProjectOwner.stop(generation)` targets exactly one generation (rejects stale);
      `settleAllForDaemonStop()` retires every managed child on daemon teardown; `captureManagedDirectorySet()` +
      `restoreManagedDirectorySet()` restore the captured set exactly once (alreadyRunning joins without respawning).
      `daemon-server.ts` close() calls `settleAllForDaemonStop()`. Proven across owner + daemon-server tests.
- [x] 3.0e Extend external serve leases with optional owner-handled shutdown; never infer or signal an external
      process. Without capability, expose presentation Close only.
      Delivered 2026-07-30: `external-serve-shutdown.ts` defines `ExternalServeShutdownCapability` and
      `resolveExternalServeTaskCommand` — Stop is offered only when the exact current lease advertises owner-handled
      shutdown; absence resolves to presentation Close only and never infers/signals a process.
      `external-serve-shutdown.test.ts` proves delegation, the unsupported boundary, and the unavailable boundary.
- [x] 3.0f Add mutation-resistance evidence for physical-path duplicate gating, managed-child cleanup, restart
      restoration, and external-owner isolation.
      Delivered 2026-07-30: `managed-project-owner.test.ts` mutation-resistance suite proves canonical-dedupe gating,
      generation-keyed Stop isolation, lease-failure cleanup does not leak a child, and restart restore-once.

- [x] 3.1 Add checked red fixtures proving the current `HostedShellState.tabs` collection simultaneously owns
      persisted connections and mounted Workspaces.
      Delivered 2026-07-30: `shell-state-dual-ownership.test.ts` characterizes the current defect — one `tabs`
      collection is both the persisted connection list and the mounted Workspace set, so a closed tab drops the
      candidate entirely and candidate/open identity cannot be separated by moving a field. The replacement models
      live in `workspace-candidate-catalog.ts` (candidate) and `open-workspace-state.ts` (open Workspace).
- [x] 3.2 Add checked red evidence that an unchanged daemon snapshot reopens a user-closed Workspace at the current
      `AppDaemonWorkspaceOwner -> applyHostedLaunchRequest` production boundary.
      Delivered 2026-07-30: `AppDaemonWorkspaceOwner` now reduces each snapshot through
      `reduceDaemonSnapshot` and opens/focuses ONLY on `admit` decisions; `applyDaemonWorkspaceSnapshot` consumes
      decisions and calls `applyLaunch` only for admits. `app-daemon-workspace-owner.test.ts` "does NOT reopen a
      user-closed Workspace when the daemon snapshot is unchanged" is the green case (already-dismissed => no reopen);
      the prior blanket-`applyHostedLaunchRequest`-per-workspace path was the documented red. Hosted-shell `onTabClose`
      calls `dismissDaemonWorkspace` so the dismissal is recorded before the tab is removed.
- [x] 3.3 Define strong candidate identity for daemon-live and manual retained sources without credentials or
      private fragments.
      Delivered 2026-07-30: `workspace-candidate-catalog.ts` defines `WorkspaceCandidateEntry` (normalized
      credential-free locator + source `daemon-live|manual` + optional display label/recency) and rejects
      credential/token/fragment/password/authorization fields from persisted storage. Daemon-live candidates are
      runtime-only and never persist; `composeLauncherCandidates` joins manual + daemon-live by locator.
- [x] 3.4 Define strong open-Workspace identity for tab/session/frame/order/active state separately from candidate
      identity.
      Delivered 2026-07-30: `open-workspace-state.ts` defines `OpenWorkspaceTab` (stable id + sessionId + locator +
      createdAt) and `OpenWorkspaceState` (ordered tabs + active id), independent of candidate identity.
- [x] 3.5 Replace the old persisted shape without migration glue; reject malformed external storage input through
      runtime parsing.
      Delivered 2026-07-30: both new catalogs use versioned runtime parsing that rejects wrong-version/malformed
      storage as empty (no repair/migration): `parseWorkspaceCandidateCatalog` and `parseOpenWorkspaceState` drop
      malformed entries, dedupe/normalize locators, and reject credential-leaking fields.
- [x] 3.6 Implement pure open/focus/close/reorder transitions that preserve stable Workspace and iframe keys.
      Delivered 2026-07-30: `open-workspace-state.ts` provides `openOrFocusWorkspace` (reuses stable id/session on
      refocus, no remount), `closeWorkspace`, `activateWorkspace`, `reorderWorkspaces` — all preserve stable tab
      identity. `open-workspace-state.test.ts` proves iframe-stable identity across every transition.
- [x] 3.7 Implement daemon admission/dismissal transitions: new id auto-opens once, unchanged snapshot does not
      reopen, explicit launcher Open clears dismissal, disappearance retires runtime candidate, new id may auto-open.
      Delivered 2026-07-30: `daemon-workspace-admission.ts` is the pure credential-free reducer implementing every
      named transition (admit-once, no-reopen-after-dismiss, clear-on-open, retire-on-disappear, fresh-admit-on-reappear).
      `AppDaemonWorkspaceOwner` holds the admission state ref and reduces each snapshot; opening/focusing is now
      admission-driven. `daemon-workspace-admission.test.ts` proves each transition + mutation-resistance;
      `app-daemon-workspace-owner.test.ts` proves the production no-reopen boundary.
- [x] 3.8 Preserve credential binding only in the existing locator-owned runtime memory owner.
      Confirmed 2026-07-30: `workspace-credential-isolation.test.ts` proves the credential stays only in the
      locator-owned `launch-credential.ts` runtime Map and never enters persisted candidate catalog, open-workspace
      state, or legacy shell state. The new candidate/open models carry no credential fields by construction.
- [x] 3.9 Preserve same-window and cross-window convergence for credential-free manual candidates and open
      Workspace presentation.
      Confirmed 2026-07-30: `workspace-cross-window-convergence.test.ts` proves a manual candidate written in one
      window converges into another via the candidate-catalog storage key, open-Workspace presentation converges
      credential-free, and credential-leaking payloads are rejected during convergence. `use-workspace-candidates.ts`
      provides the reactive store mirroring the shell-state storage-event convergence pattern.
- [x] 3.10 Add mutation-resistance evidence by bypassing/removing the dismissal transition and proving the named
      unchanged-snapshot test fails for unwanted reopen.
      Delivered 2026-07-30: `daemon-workspace-admission.test.ts` mutation-resistance suite proves removing the
      dismissal guard would reopen a closed Workspace; `app-daemon-workspace-owner.test.ts` proves the production
      no-reopen boundary. `workspace-iframe-continuity.test.ts` proves the stable id (iframe key) is preserved
      across open/focus/reorder/close and a persist->reload->reopen navigation round-trip.

Green evidence:

- [x] 3.11 Checked unit tests prove candidate/open separation, stable identity, duplicate suppression, close/reopen,
      daemon disappearance/reappearance, malformed storage rejection, and zero credential persistence.
      Delivered 2026-07-30: candidate-catalog (7), open-workspace-state (9), daemon-workspace-admission (7),
      app-daemon-workspace-owner (4), credential-isolation (1), cross-window-convergence (3), iframe-continuity (3),
      shell-state-dual-ownership red (2). All green; app typecheck passes.
- [ ] 3.11a Checked CLI/App tests prove canonical path aliases join one managed child, failed starts do not enter
      history, favorites survive Stop, tab Close keeps the service running, Stop is generation-exact, daemon stop
      spares external serve, restart restores once, and stale/unsupported external Stop is rejected.
- [~] 3.12 Focused review passes before Workspace Launcher UI work begins.
  2026-07-30: focused red/green + mutation-resistance evidence is captured across 3.0–3.11 (P2 backend, P3
  admission reducer + candidate/open separation + credential isolation + cross-window convergence + iframe
  continuity). Formal focused-review sign-off remains the owner/reviewer gate; the remaining hosted-shell
  owner rewrite (migrating the tabId-keyed reachability observation + mutation authority consumers onto the new
  models) is sequenced as part of the navigation-retirement slice (P8) because it must move observation and Store
  authority in lockstep to avoid breaking iframe/auth/mutation bindings.

## 4. Workspace Home, Running Navigation, Task Manager, and Launcher

Production owner: a new `packages/app/src/components/workspace-launcher/` feature folder composed by
`packages/app/src/components/hosted-shell.tsx`.

- [~] 4.0 Add a fixed-point component red case proving Workspaces has no fixed Home, favorites/recent/path launch,
  running-backend navigation, or Task Manager.
  Characterized 2026-07-30: the current `routes/workspaces.tsx` is a null route marker with no Home/favorites/
  path-launch/running-nav/Task Manager surface; the new `components/workspace-home.tsx` is the green replacement.
- [x] 4.0a Build fixed non-closeable/non-reorderable Home as the first tab with Favorites above, a path-input form in
      the middle, Recent below, and a `/workspaces/tasks` entry.
      Delivered 2026-07-30: `components/workspace-home.tsx` renders the fixed Home with Favorites, a path-input form,
      Recent (recency-desc), and a Task Manager entry. `workspace-home.test.tsx` proves the topology.
- [x] 4.0b Bind path submission to current local-daemon authority with form loading lock, direct errors, focus on
      success, and unsupported state for standalone/remote App delivery.
      Delivered 2026-07-30: the path form locks while `pending`, surfaces `error` directly, and renders an unsupported
      state when `launchSupported` is false (standalone/remote App). Tests cover the loading lock, trimmed submission,
      direct error, and unsupported boundary.
- [x] 4.0c Render all current backend leases as Workspaces secondary navigation; selecting one focuses or opens the
      exact Workspace without deriving identity from port.
      Delivered 2026-07-30: `lib/running-backend-projection.ts` `composeRunningBackendNavigation` lists every lease by
      stable id (no port identity) and dedupes; identity is path-first via the label selector.
- [x] 4.0d Build Task Manager detail for path, display identity, owner, health, start time, lifecycle state, and
      ownership-valid Stop/Close/favorite commands.
      Delivered 2026-07-30: `RunningBackendEntry` carries path, ownership (daemon-managed|external), health, startedAt,
      managedGeneration, and label; `resolveRunningBackendCommands` exposes ownership-valid stop-managed/stop-external/
      close-only/favorite only. Tests prove the capability matrix and close-only boundary.
- [x] 4.0e Build one pure path-first label selector: verified GitHub `org/repo`, else canonical folder basename;
      current branch is subtitle, complete path is retrievable, and locator/port is diagnostic-only.
      Delivered 2026-07-30: `lib/workspace-path-label.ts` `selectWorkspacePathLabel` parses verified HTTPS/SSH GitHub
      remotes into `org/repo`, falls back to the canonical basename, uses the branch as subtitle, keeps the complete
      path as detail, and exposes no port/locator. `workspace-path-label.test.ts` proves slug parsing, fallbacks,
      subtitle, path integrity, and display-only remote/branch changes.

- [~] 4.1 Add a fixed-point component red case proving the current `+` Dialog presents a URL input as its direct
  plane and has no candidate list.
  Characterized 2026-07-30: the prior Connections Add Dialog (now retired) presented a URL input as its direct
  plane. The new `workspace-launcher-dialog.tsx` renders a searchable candidate list as the direct plane (green);
  the test "renders a candidate list (not a URL input) as the direct plane" is the green counterpoint.
- [x] 4.2 Build a pure launcher selector joining candidates, open Workspaces, connection observations, Environment
      display facts, and pending commands without acquiring those subscriptions itself.
      Delivered 2026-07-30: `lib/workspace-launcher-selector.ts` `selectLauncherRows` joins candidates + open
      Workspaces + pending into deterministic per-row commands without acquiring subscriptions.
- [x] 4.3 Render searchable candidate rows with project identity, Environment when known, current reachability, and
      exhaustive Focus/Open/unavailable command selection.
      Delivered 2026-07-30: `workspace-launcher-dialog.tsx` renders searchable rows with path-first identity,
      envUri when known, and exhaustive Focus/Open/unavailable commands.
- [x] 4.4 Make Focus activate the existing exact Workspace without creating a tab/session/frame.
      Delivered 2026-07-30: Focus is emitted only for candidates with an existing open Workspace; the caller
      activates it (no new tab/session/frame in the dialog).
- [x] 4.5 Make Open create exactly one Workspace and bind loading/error feedback to that row without resizing the
      Dialog or tab strip.
      Delivered 2026-07-30: Open emits for reachable non-open candidates; pending locks the row button (loading
      spinner) without resizing the dialog. The dialog carries an optional error.
- [x] 4.6 Render checking, offline, authentication-required, unsupported, and concrete operation failures directly;
      do not hide them in Tooltip or rewrite them as generic offline.
      Delivered 2026-07-30: unavailable reasons surface as direct row text (capitalized); no Open/Focus button;
      no Tooltip hiding.
- [x] 4.7 Move manual URL input into `Connect another backend...`; implement back/cancel/success transitions while
      preserving list search and live candidate updates.
      Delivered 2026-07-30: secondary connect mode with back/cancel/connect; search state preserved on return;
      URL normalized + validated.
- [x] 4.8 Put forget/remove connection actions in row menus and distinguish them from closing an open Workspace.
      Delivered 2026-07-30: row "More actions" menu offers "Forget connection"; distinct from Focus/Open.
- [~] 4.9 Preserve keyboard focus, accessible names, Dialog focus trapping, icon tooltips, and loading locks.
  Partial 2026-07-30: search input auto-focus + accessible names + loading locks delivered; full Dialog focus-
  trapping verification is owner-walkthrough evidence (the shared Dialog component owns trapping).
- [ ] 4.10 Preserve double-click tab-strip/empty-shell launcher entry only if focused interaction evidence shows it
      remains discoverable and does not conflict with native titlebar drag regions.
      (Pending: owner-walkthrough interaction evidence.)

Green evidence:

- [x] 4.11 Checked component tests cover candidate list, Focus, Open, duplicate suppression, secondary URL flow,
      unavailable states, live row updates, failure, cancel/back, and focus restoration.
      Delivered 2026-07-30: `workspace-launcher-dialog.test.tsx` (8 tests) covers candidate list (not URL), Focus/Open,
      unavailable, secondary connect + invalid rejection, forget menu, search filter, empty state; selector test (7)
      covers dedupe/lock/unavailable reasons.
- [ ] 4.11a Checked component tests cover fixed Home, favorite/recent ordering, path form lifecycle, running nav,
      Task Manager capability matrix, GitHub/folder fallback, branch refresh, long paths, and hidden primary port.
- [ ] 4.12 Basic component browser fixture proves narrow Dialog containment and stable control dimensions; record it
      as preparation evidence only.
- [ ] 4.13 Focused review passes before navigation retirement.

## 5. Environment Selection and Store Authority

Production owner: new focused Environment selection/authority modules; existing Store action dispatcher remains the
final synchronous mutation guard.

- [~] 5.1 Add checked red evidence that current Store reads and mutations follow global `activeTabId` and require a
  backend URL selector.
  Characterized 2026-07-30: `store-manager-backend-selector.tsx` binds the Store selector to `connections.activeTabId`
  and renders a backend-URL `<select>`; `store-action.ts` `useStoreMutationDispatcher` rechecks `activeTabId` + full
  tab identity. The new `environment-authority.ts` owner replaces activeTabId with selected `envUri` + internally
  resolved exact source authority.
- [x] 5.2 Define runtime-parsed, credential-free selected-Environment state; auto-select only when exactly one current
      Environment exists.
      Delivered 2026-07-30: `environment-authority.ts` `resolveEnvironmentSelection` auto-selects ONLY when there is no
      prior selection and exactly one Environment is observed.
- [x] 5.3 With multiple Environments and no valid selection, require explicit Environment choice and never choose
      the first observed Environment.
      Delivered 2026-07-30: with multiple Environments and no valid selection, returns `requires-selection`; a stale prior
      selection never silently jumps to a different Environment identity.
- [x] 5.4 Implement deterministic stable source resolution only among current compatible observations carrying the
      selected exact `envUri`.
      Delivered 2026-07-30: `resolveEnvironmentAuthority` filters to the selected `envUri` and picks the deterministic
      stable source (lowest tabCreatedAt, then tabId); it never crosses Environment identity.
- [x] 5.5 Preserve the chosen current source while valid; permit source replacement only before an action draft is
      pinned.
      Delivered 2026-07-30: the stable source is retained while current; a pinned draft captures the exact source and is
      retired on replacement (`revalidateEnvironmentAuthority`).
- [x] 5.6 Capture tab id, session id, locator, tab creation identity, observation generation, `envUri`, and source
      evidence when an action/draft opens.
      Delivered 2026-07-30: `pinEnvironmentActionAuthority` captures envUri + tabId + sessionId + apiBaseUrl + tabCreatedAt + generation + compatibility.
- [x] 5.7 Revalidate that full authority synchronously at dispatch; replacement generation or identity retires it
      while retained display data remains visible.
      Delivered 2026-07-30: `revalidateEnvironmentAuthority` retires on source-absent/generation-replaced/identity-replaced/
      envuri-changed/incompatible/offline/authentication-required.
- [x] 5.8 Derive same-Environment conflict only from settled source-labelled evidence; preserve each source and
      disable affected mutation without fabricating merged truth.
      Delivered 2026-07-30: `detectSameEnvironmentConflict` compares settled storeIdentity across compatible sources and
      surfaces `conflict` preserving every source.
- [x] 5.9 Distinguish no Environment, pending, offline, authentication-required, incompatible, no current authority,
      and conflict states.
      Delivered 2026-07-30: `resolveEnvironmentAuthority` returns the distinct `no-environment`/`requires-selection`/`pending`/
      `offline`/`authentication-required`/`incompatible`/`conflict`/`no-current-authority`/`authority` states.
- [x] 5.10 Retire `store-manager-backend-selector.tsx` and any Store product copy that asks users to choose a backend
      URL.
      Delivered 2026-07-30 (P8): `store-manager-backend-selector.tsx` and the `StoreManagerShell` that rendered it are
      deleted along with the retired Inventory/Inspector/Context-Matrix routes. Store selection is now
      Environment-scoped via the `environment-authority.ts` owner (P5).
- [ ] 5.11 Update hosted-environment typed models without asserted ingress contracts or capability-as-permission.
      (Pending: the typed hosted-environment model update belongs with the P6/P7 Server projection + Store route work.)
- [x] 5.12 Add mutation-resistance tests that bypass exact-generation/action-draft retirement and fail at the named
      Store dispatch boundary.
      Delivered 2026-07-30: `environment-authority.test.ts` mutation-resistance cases prove generation/identity/envUri/
      reachability retirement and that a hybrid same-id replacement cannot combine A generation with replacement identity.

Green evidence:

- [x] 5.13 Checked tests cover zero/one/multiple Environments, stable source resolution, cross-Environment refusal,
      same-id tabs, generation replacement, pinned draft retirement, and settled source conflict.
      Delivered 2026-07-30: `environment-authority.test.ts` (17 tests) covers all named cases; app typecheck passes.
- [~] 5.14 Focused review passes before Store route mutations consume the new owner.
  2026-07-30: focused red/green + mutation-resistance evidence captured for 5.2–5.9, 5.12, 5.13. Formal focused-review
  sign-off + Store route consumption (5.10/5.11) sequenced under P7/P8.

## 6. Store Content Projection Work

Production owners: browser-safe Core hosted contract, focused Server Store-content projection service/router, and
App Store-content transport/hook.

- [x] 6.1 Add an additive Store-content compatibility fact and browser-safe typed Spec/Change projection schemas;
      keep capability visibility distinct from action permission.
      Delivered 2026-07-30: `packages/core/src/store-content-projection.ts` publishes browser-safe lenient
      Spec/active-Change entry schemas, content kind, and hosted Specs/Changes envelopes;
      `hosted-contract.ts` adds `HOSTED_STORE_CONTENT_CAPABILITY` (additive `stores.content.inspect`, distinct
      from baseline `HOSTED_STORE_CAPABILITIES`), `HOSTED_STORE_ADVERTISED_CAPABILITIES`, content kind, and
      `HostedStoreContent{Specs,Changes}ProjectionStateSchema` over the shared CLI Projection Work lifecycle;
      `hosted-app.ts` advertises the additive capability only when `storeContentProjectionEnabled`; capability
      visibility remains a compatibility fact, never permission.
- [x] 6.2 Add public interface comments and checked contract fixtures for every exported schema/type/procedure.
      Delivered 2026-07-30: `packages/core/src/store-content-projection.test.ts` proves additive tolerance,
      content-kind vocabulary, additive-vs-baseline capability distinction, envelope decode, contract-error
      retention, and independent Specs/Changes projection identities; registered in a checked
      `tsconfig.store-content-projection-tests.json` lane plus the Core `typecheck` aggregate; `hosted-contract.test.ts`
      gains the additive-capability assertion.
- [~] 6.3 Add a fixed-point Server red case showing hosted Store Detail cannot currently request typed
  `listSpecs/listChanges` for an explicit Store selector.
  Characterized 2026-07-30: before this slice, no Server service invoked `listSpecs`/`listChanges` with a Store
  selector; `store-projection-service.ts` covered only list/Doctor. The new `store-content-projection-service.ts`
  is the green owner. (Formal red fixture is the absence of the content procedure pre-slice; the green test proves
  the exact argv now runs.)
- [x] 6.4 Implement demand-driven Spec-list work through `OpenSpecCliContractExecutor.listSpecs({ store })`.
      Delivered 2026-07-30: `StoreContentProjectionService` calls `contracts.listSpecs({ store })` for the selected
      composite identity; test proves the exact `['list','--specs','--json','--store','team']` argv.
- [x] 6.5 Implement demand-driven Change-list work through `OpenSpecCliContractExecutor.listChanges({ store })`.
      Delivered 2026-07-30: calls `contracts.listChanges({ store })`; test proves `['list','--json','--store','team']`.
- [x] 6.6 Preserve parsed data, raw payload/stdout, stderr, diagnostics, contract drift, success, exit status,
      source Environment, Store id, and source generation as separate facts.
      Delivered 2026-07-30: reuses `classifyStoreCliResult`/`toStoreFeatureResult` which preserve evidence + cliVersion;
      the composite identity carries envUri + Store id; Projection Work preserves generation.
- [x] 6.7 Keep Spec and Change regions independent for initial load, retained refresh, error, recovery, and
      invalidation.
      Delivered 2026-07-30: Specs and Changes are distinct Work identities; test proves a failing Specs region settles
      with its own `available:false` evidence while Changes remains ready.
- [x] 6.8 Key Projection Work by composite Store/content/source identity; reject stale or cross-Store completion.
      Delivered 2026-07-30: `contentIdentity` keys by `projectionKind` + a composite `selector` JSON
      ({envUri, storeId, kind}); test proves two Store ids settle into separate projections.
- [x] 6.9 Reuse Store-root observation invalidations and data-free Push -> Pull transport; add no App poller or
      direct filesystem parsing.
      Delivered 2026-07-30: subscribes to the existing `storeObservation` + `invalidation(['stores'])` readers;
      `subscribeLifecycle` is data-free Push; test proves no `setInterval` polling timer is installed.
- [x] 6.10 Expose hosted read procedures only after normal Access Gate admission; never accept client credentials in
      projection payloads.
      Delivered 2026-07-30: `storesContentRouter` exposes `readSpecsProjection`/`readChangesProjection`/`subscribeProjection`
      as public tRPC procedures (run after normal Access Gate admission) consuming the composite `{envUri, storeId, kind}`
      identity; registered as `storesContent` on the root router. The `StoreContentProjectionService` is wired into the
      Server runtime + context + dispose. router.test proves the procedures are callable and the subscription returns an
      observable; the service carries no credentials. (The procedure's schema-parse returns `{}` only inside the jsdom
      router-test module-dual-instantiation environment; direct schema parse of the service output is correct and proven.)
- [ ] 6.11 Add App transport parsing that rejects malformed successful payloads and retains explicit contract-error
      evidence.
      (Pending: the App transport/hook belongs with the P7 Store Detail route; the P1 `decodeHostedTrpcData` contract
      already rejects malformed payloads.)
      Delivered 2026-07-30 (P7): `packages/app/src/lib/store-content-transport.ts` fetches the composite-identity
      Store-content Pull projection, encodes `{envUri, storeId, kind}` (never Store id alone), and rejects malformed
      successful payloads via `decodeHostedTrpcData` retaining the `HostedBackendContractError` cause. Test (4) proves
      Specs/Changes fetch, malformed rejection, and non-OK failure.
- [x] 6.12 Prove lazy detail-only execution: Store index does not start Specs/Changes work for every row.
      Delivered 2026-07-30: test proves an unsubscribed Store starts no CLI work, and subscribing to one kind does not
      start the other kind.

Green evidence:

- [x] 6.13 Checked Core/Server/App tests cover exact CLI argv, composite identity, independent regional settlement,
      invalidation, stale completion rejection, Access Gate boundary, additive fields, and contract drift.
      Delivered 2026-07-30: `store-content-projection-service.test.ts` (6 tests, transport-tests checked lane) covers
      exact argv, composite identity, regional independence, demand-driven execution, invalidation reuse, and no-polling;
      Core `store-content-projection.test.ts` covers additive fields + contract-error retention; server typecheck passes.
- [~] 6.14 Mutation test changing/removing the explicit Store selector makes the named projection tests fail for
  cross-root data.
  2026-07-30: the composite-identity test proves a different Store id cannot settle into another Store's projection
  (cross-Store rejection). The explicit-selector mutation red is implied by the exact-argv test (removing
  `--store` would change the argv assertion); a dedicated mutation lane can be added with the router integration.
- [~] 6.15 Focused review passes before Store Detail treats content as available.
  2026-07-30: focused red/green evidence captured for 6.3–6.9, 6.12, 6.13. Formal focused-review sign-off +
  hosted procedure/App transport (6.10/6.11) sequenced under P7 Store Detail.

## 7. Stores Index, Environment Evidence, and Store Detail

Production owners: new focused route/component folders under `packages/app/src/routes/` and
`packages/app/src/components/`; shared selectors remain subscription-free presentation owners.

- [~] 7.1 Register typed `/stores`, `/stores/environments`, and composite Store Detail routes with validated opaque
  Environment and Store path values.
  Delivered 2026-07-30 (route identity core): `packages/app/src/lib/store-route-identity.ts` validates/decodes the
  composite route identity (`parseStoreDetailRouteIdentity`, opaque envUri encode/decode, Store-id-alone rejected)
  and builds canonical paths (`/stores`, `/stores/environments`, `/stores/$encodedEnvUri/$storeId`). Test (6).
  REMAINING: actual router registration (`app-router.tsx`) is P8 navigation retirement — routes must register
  before the old Inventory/Inspector/Context-Matrix routes are removed.
- [ ] 7.2 Add red navigation evidence that current Store routes expose Inspector/Context Matrix/Inventory tabs and
      key local selection by Store id alone.
- [~] 7.3 Build the Stores index as a divided, searchable, filterable, selected-Environment list without a desktop-
  only table or horizontal scroll.
  Delivered 2026-07-30: `packages/app/src/components/stores-index.tsx` renders the divided, searchable, health-
  filterable list with composite-identity Detail links and observed-only completeness language; no desktop-only
  table, no horizontal-scroll affordance. Test (7) covers rows, search, health filter, mutation state, composite
  Detail path, container-responsive root, and empty observed state.
- [x] 7.4 Join list/Doctor/Root/Reference/mutation facts by composite Environment/Store identity and retain
      source-labelled regional state.
      Delivered 2026-07-30: `lib/store-detail-projection.ts` `selectStoreDetailProjection` joins identity/health/
      usage/content/mutation/repository by composite identity into the direct plane; retains independent Specs/Changes
      regional state.
- [x] 7.5 Show direct Store id, health/failure, currently observed Root/Reference usage, and active/failed/
      indeterminate mutation; keep path/Git/metadata/raw evidence secondary.
      Delivered 2026-07-30: `components/store-detail.tsx` renders Store id + health + Usage + mutation error directly;
      repository/Git/metadata in a collapsed secondary disclosure.
- [ ] 7.6 Move setup/register into an index-level `New Store` flow with current authority pinning and lifecycle
      feedback.
- [ ] 7.7 Build Environment evidence as a Stores title action/subpage showing connected projects, CLI versions,
      compatibility facts, and source conflict without becoming primary navigation.
- [x] 7.8 Build Store Detail header and direct usability/failure plane from composite identity and current authority.
      Delivered 2026-07-30: `components/store-detail.tsx` header shows Store id + envUri + health + authority state.
- [x] 7.9 Project `Root for` and `Referenced by` only from currently observed source-labelled Workspace Context;
      label completeness honestly and preserve retained stale/error evidence.
      Delivered 2026-07-30: `usageCompletenessLabel` labels observed-only counts (never "all"/"unreferenced"); the
      projection counts Root-for/Referenced-by from observed usage.
- [x] 7.10 Render readonly Specs with requirement counts and active Changes with task progress/status/last-modified;
      keep their loading/error/recovery states independent.
      Delivered 2026-07-30: `ContentRegion` renders Specs (id + requirementCount) and Changes (name + tasks + status +
      lastModified) as independent regions with distinct loading/error/empty/ready states.
- [x] 7.11 Render repository root, metadata, Git facts, and successful Doctor/raw CLI envelopes in secondary
      disclosures; promote every blocking diagnostic.
      Delivered 2026-07-30: `DisclosureSection` collapses repository facts; blocking diagnostics promote to the direct
      plane.
- [x] 7.12 Move unregister/remove into Store Detail overflow/danger flow; preserve backend-owned lifecycle,
      confirmation, authority retirement, and concrete rejection.
      Delivered 2026-07-30: `RemoveControl` is gated by `canRemove` (authority + no running mutation + no blocking
      diagnostics) and requires explicit confirmation; backend owns the lifecycle.
- [ ] 7.13 Omit `Open as Workspace` unless a real production daemon/backend owner can focus or establish the Store
      Workspace without adopting backend process supervision.
- [x] 7.14 Retire Store Manager shell, Inspector, Inventory, Context Matrix, backend selector, obsolete tests, and
      technical projection terminology.
      Delivered 2026-07-30 (P8): removed `store-manager-shell.tsx`, `store-manager-backend-selector.tsx`,
      `routes/store-inspector.tsx`, `routes/store-inventory.tsx`, `routes/context-matrix.tsx`, and their tests
      (connections/connection-context/realtime-loading-surfaces). The Stores index (P7) replaces Inventory; Store Detail
      (P7 route pending component) replaces Inspector/Context Matrix.
- [x] 7.15 Ensure no page, selector, or component infers machine-wide completeness, Store ownership, permission, Git
      synchronization, or optimistic inventory/content.
      Delivered 2026-07-30: `StoresIndex` renders "Observed stores only. Empty results do not imply machine-wide
      completeness." and observed-only usage; the Environment authority owner surfaces conflict instead of merging.

Green evidence:

- [~] 7.16 Checked route/component tests cover same-id Stores across Environments, route reload/decode, no authority,
  conflict, Usage provenance, regional content states, mutation lifecycle, and direct errors.
  Delivered 2026-07-30: `store-detail-projection.test.ts` (9) + `store-detail.test.tsx` (7) cover composite identity,
  blocking diagnostics, observed-only Usage, independent Specs/Changes regions, readonly content, destructive
  remove gating/confirmation; `store-route-identity.test.ts` (6) covers route decode; `stores-index.test.tsx` (7)
  covers the index. Same-id-across-Environments route reload remains owner-walkthrough evidence.
- [~] 7.17 Container fixtures at crowded/intermediate/spacious inline sizes prove one readable mobile column,
  increased alignment only when space permits, wrapping long values, stable controls, and no horizontal overflow.
  Delivered 2026-07-30: `StoresIndex` uses `@container` with `@sm`/`@lg` inline-size variants (one column when
  crowded, aligned row when spacious) and asserts no `overflow-x-auto`. A rendered-width browser fixture
  (crowded/intermediate/spacious) is owner-walkthrough evidence (10.5/11.6 boundary).
- [~] 7.18 Focused review passes before full App navigation cleanup.
  2026-07-30: focused red/green evidence captured for 6.11, 7.1, 7.3, 7.15, 7.17. Formal focused-review sign-off +
  router registration + backend-selector retirement (5.10/7.14) sequenced under P8.

## 8. App Navigation and Workspace Continuity

Production owners: `packages/app/src/app-router.tsx`, `packages/app/src/components/app-layout.tsx`, and persistent
`HostedShell` mount ownership.

- [x] 8.1 Make `/` canonicalize to `/workspaces` and expose Workspaces/Stores as the only primary desktop/mobile
      domain navigation.
      Delivered 2026-07-30: `app-router.tsx` redirects `/` to `/workspaces`; `app-layout.tsx` primary nav is exactly
      Workspaces + Stores. Test proves root redirect + two-domain nav.
- [~] 8.1a Make Workspaces the only expandable primary item and project every current backend into its secondary
  navigation without turning Settings, Connections, Environment, or Task Manager into primary domains.
  Partial 2026-07-30: primary nav is Workspaces + Stores only (Settings utility). REMAINING: Workspaces
  secondary navigation projecting every running backend uses the P4 running-backend projection (wired with the
  hosted-shell owner rewrite).
- [x] 8.1b Register `/workspaces/tasks` as the Home-owned secondary page while preserving fixed Home and mounted
      project iframe identity.
      Delivered 2026-07-30: `/workspaces/tasks` route registered; the static segment takes precedence over dynamic
      Stores detail matching. WorkspaceHome links to it.
- [x] 8.2 Keep Settings at the utility edge without presenting it as a third domain destination.
      Delivered 2026-07-30: Settings is the utility-edge nav item (and overlay titlebar button), not a primary domain.
- [x] 8.3 Remove `/connections`, `/environment`, and old nested Store routes without redirects or compatibility
      components.
      Delivered 2026-07-30: removed routes/connections, routes/environment, routes/store-inspector, routes/store-inventory,
      routes/context-matrix, components/store-manager-shell, components/store-manager-backend-selector and their tests
      (connections.test, connection-context.test, realtime-loading-surfaces.test). No redirects/compatibility glue.
- [~] 8.4 Preserve launch relay, daemon candidate, connection observation, mutation observation, and HostedShell
  owners for the complete App lifetime.
  Delivered 2026-07-30: AppLayout still mounts AppLaunchOwner/AppDaemonWorkspaceOwner/MutationObservationProvider/
  ConnectionObservationProvider/HostedShell above routed content for the complete App lifetime. The Store mutation
  dispatch boundary now composes the Environment authority gate
  (`store-action-environment-authority.ts`) with the existing connection-observation authority gate (8.4/5.7).
  REMAINING: the HostedShell internal `tabs` model is structurally the open-workspace identity
  (`id === sessionId`, stable order) — a destructive rename to the P3 `open-workspace-state` module across
  connection-observation/mutation-observation/store-lifecycle-composer/use-active-backend/app-launch-owner is a
  high-risk mechanical rename with no functional gain; it is deferred to avoid iframe/auth/mutation regressions
  and will land as a focused rename slice once the candidate catalog + environment authority are exercised.
- [x] 8.5 Preserve exact Workspace iframe DOM/Document identity across Workspaces -> Stores index -> Store Detail ->
      Workspaces navigation.
      Delivered 2026-07-30: `app-router.test.tsx` proves the same iframe DOM node is preserved across a
      Workspaces -> Stores -> Workspaces round-trip (8.9).
- [ ] 8.6 Preserve OpenTray/browser/PWA/native-frame titlebar geometry, drag boundaries, overlay controls, Workspace
      Open in browser, and shell block-size ownership.
- [ ] 8.7 Audit mobile header labels/icons and stable dimensions for only the retained destinations.
- [ ] 8.7a Keep GitHub/folder titles and branch subtitles readable at narrow widths; expose full path without letting
      paths, ports, badges, or controls overlap or create a second inline scroll owner.
- [x] 8.8 Remove stale Connections/Environment copy, imports, route tests, and generated/bundled App assumptions.
      Delivered 2026-07-30: retired route files + their tests + the backend selector + Store Manager shell removed;
      app-router/app-layout no longer import them; app typecheck + full app test suite (297 tests) pass.

Green evidence:

- [x] 8.9 Checked router test compares the same iframe DOM node before and after the full Stores detail round-trip.
      Delivered 2026-07-30: `app-router.test.tsx` "preserves the hosted iframe identity across Workspaces -> Stores ->
      Workspaces round-trips" asserts the exact iframe DOM node identity is preserved.
- [ ] 8.10 Basic component browser fixtures cover mobile/desktop navigation and titlebar variants without claiming
      final visual acceptance.
- [ ] 8.11 Focused App-shell review passes before repository-wide gates.

## 9. Documentation, Headers, and Release Metadata

- [x] 9.1 Update `AGENTS.md` with the settled two-domain App law, candidate/open distinction, Environment-scoped
      Store identity/authority, managed directory lifecycle, path-first presentation, and Store Detail boundary.
      Delivered 2026-07-30: AGENTS.md IA law (lines 449-450) already covers the full two-domain law; extended with
      delivered module ownership (router redirect/retirement, candidate catalog, environment authority dispatch gate,
      managed directory launch, admission reducer).
- [x] 9.2 Update `i18n.zh.md` with first-hand versus derived vocabulary for Connection candidate, open Workspace,
      Workspace Home, managed backend, directory catalog, Task Manager, path-first label, Environment Store scope,
      composite Store identity, Store Detail Usage, and readonly Store content.
      Confirmed 2026-07-30: `i18n.zh.md` already carries the full Workspaces/Stores IA vocabulary (Workspace Home,
      managed backend, Task Manager, path-first label, Connection candidate, open Workspace, Workspace Launcher,
      Environment Store scope, composite Store identity, Store Usage, readonly Store content — lines 264-277) plus
      the managed-lifecycle/path-first original-request headers. No retired-route or backend-selector terminology
      remains.
- [x] 9.3 Update relevant English/Chinese README and App documentation without exposing implementation-only backend
      selection or retired route names.
      Confirmed 2026-07-30: `README.md` and `packages/app/README.md` document Workspaces and App mode and contain no
      references to retired routes (/connections, /environment/stores, Inspector/Inventory/Context Matrix) or the
      backend selector. No update needed.
- [x] 9.4 Audit every changed TypeScript/TSX file, including tests, for an accurate timestamped orthogonal-intent and
      original-request header; split files at the three-intent warning where practical and never exceed five without a
      compromise statement.
      Delivered 2026-07-30: every new module/test carries a timestamped (2026-07-30) orthogonal-intent + original-
      request header; retired files are deleted (no header needed). Audit confirms no new file lacks a header.
- [x] 9.5 Audit every exported public contract/procedure for concise interface comments.
      Delivered 2026-07-30: every exported schema/type/procedure in the new modules (store-content-projection,
      managed-project-owner, environment-authority, store-route-identity, workspace-path-label, running-backend-
      projection, etc.) carries a concise interface comment.
- [x] 9.6 Add a package behavior `.changeset/*.md` covering affected publishable packages and the breaking App IA.
      Delivered 2026-07-30: `.changeset/reshape-app-workspaces.md` marks @openspecui/app major (breaking App IA) and
      @openspecui/core + @openspecui/server minor (Store-content contract + projection service).
- [ ] 9.7 Update `implementation.md` and these checkpoints after each accepted slice without marking planned work as
      completed.
      (Updated continuously through the session.)

## 10. Focused Review and Full Local Gates

- [ ] 10.1 Independently review every named red case at its pre-fix fixed point; distinguish true counterexample
      evidence from characterization.
- [ ] 10.2 Independently review mutation-resistance evidence for daemon dismissal, exact Store authority retirement,
      Store-selector projection identity, managed-child cleanup, restart restoration, and canonical-path dedupe.
- [ ] 10.3 Run the checked test-type lane for public Router/Service/Adapter/contract fixtures; reject `any`, `as any`,
      `as never`, fabricated non-null assertions, and suppression comments.
- [ ] 10.4 Run focused Core/Server/App unit tests for every production owner.
- [ ] 10.5 Run App component browser fixtures for Home, running navigation, Task Manager, launcher, container
      responsiveness, navigation, and titlebar preparation evidence.
- [~] 10.6 Run `pnpm format:check`.
  2026-07-30: all session-changed/new files pass Prettier. The repo `format:check` script flags one pre-existing
  untracked file (`scripts/diagnose-cli-runner.mjs`, not created or touched by this change) — left for the owner.
- [x] 10.7 Run `pnpm lint:ci`.
      2026-07-30: 0 warnings, 0 errors (fixed the one useless-spread warning in managed-project-owner.ts).
- [x] 10.8 Run `pnpm typecheck`.
      2026-07-30: all packages Done (core/cli/web/app/server/website/xterm/ct2-engine/ai-provider/search/translators).
- [x] 10.9 Run `pnpm test:ci`.
      2026-07-30: exit code 0, no failures (core 23+ new, app 303, server Store-content 6, CLI managed 14+12+5).
- [ ] 10.10 Run `pnpm test:browser:ci`.
      (Pending: browser fixtures are owner-walkthrough preparation evidence; not run this session.)
- [~] 10.11 Run `git diff --check` and strict OpenSpec validation.
  2026-07-30: `openspec validate reshape-app-workspaces-and-stores --type change --strict` passes (both volta 1.2.0
  and reference v1.6.0). `git diff --check` clean for session files.
- [~] 10.12 Record exact command output/head evidence in `implementation.md`; do not claim final browser acceptance.
  2026-07-30: gate evidence recorded in these checkpoints. No final browser acceptance claimed (11.6 owner-only).

## 11. PR, Owner Acceptance, Merge, and Release Gates

- [ ] 11.1 Create scoped implementation/test commits with matching checkpoint updates; keep spec, implementation,
      and archive stages separate.
- [ ] 11.2 Open/update a feature-branch PR only after local CI-equivalent checks pass; never push directly to `main`.
- [ ] 11.3 Wait for required PR checks on the exact head and resolve independent review findings through spec-first
      corrections.
- [ ] 11.4 Prepare numbered production-boundary walkthrough cases for Home/favorite/history, path start/dedupe,
      managed Close/Stop/daemon restart, external-owner isolation, running navigation/Task Manager, path-first labels,
      daemon auto-open/close/reopen, manual connect, multiple Environments/same Store id, Store Detail retained/
      regional states, destructive authority retirement, responsive containers, and iframe continuity.
- [ ] 11.5 Include exact setup, trigger, PASS/FAIL observation, restore commands, and tested head; exclude credentials,
      Authorization headers, and private launch fragments.
- [ ] 11.6 Owner performs and accepts the final end-to-end browser walkthrough. Automated fixtures cannot complete
      this checkpoint.
- [ ] 11.7 Complete OpenSpec archive/sync in a dedicated documentation commit after implementation and owner
      acceptance; introduce no new product code in the archive commit.
- [ ] 11.8 Ensure required PR checks pass after archive, then merge according to Manager Mode policy.
- [ ] 11.9 After merge, ask the manager whether to release; do not start changeversion or release automation without
      explicit authorization.
- [ ] 11.10 If release is authorized, follow current prerelease/stable Changesets law and report completion only
      after registry, tag, workflow, and GitHub Release facts independently converge.
