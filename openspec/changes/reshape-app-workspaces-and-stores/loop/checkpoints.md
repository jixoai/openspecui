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
- [ ] 3.0b Physically canonicalize and validate the directory before spawn; single-flight concurrent aliases and key
      managed ownership by physical identity.
- [ ] 3.0c Start only a fixed internal serve plan, await readiness, admit one lease, and expose concrete startup state;
      reject caller-supplied command vectors and remote App authority.
- [ ] 3.0d Implement exact managed Stop, daemon-stop child settlement, and restart-only capture/restore of the
      previously running managed directory set.
- [ ] 3.0e Extend external serve leases with optional owner-handled shutdown; never infer or signal an external
      process. Without capability, expose presentation Close only.
- [ ] 3.0f Add mutation-resistance evidence for physical-path duplicate gating, managed-child cleanup, restart
      restoration, and external-owner isolation.

- [ ] 3.1 Add checked red fixtures proving the current `HostedShellState.tabs` collection simultaneously owns
      persisted connections and mounted Workspaces.
- [ ] 3.2 Add checked red evidence that an unchanged daemon snapshot reopens a user-closed Workspace at the current
      `AppDaemonWorkspaceOwner -> applyHostedLaunchRequest` production boundary.
- [ ] 3.3 Define strong candidate identity for daemon-live and manual retained sources without credentials or
      private fragments.
- [ ] 3.4 Define strong open-Workspace identity for tab/session/frame/order/active state separately from candidate
      identity.
- [ ] 3.5 Replace the old persisted shape without migration glue; reject malformed external storage input through
      runtime parsing.
- [ ] 3.6 Implement pure open/focus/close/reorder transitions that preserve stable Workspace and iframe keys.
- [ ] 3.7 Implement daemon admission/dismissal transitions: new id auto-opens once, unchanged snapshot does not
      reopen, explicit launcher Open clears dismissal, disappearance retires runtime candidate, new id may auto-open.
- [ ] 3.8 Preserve credential binding only in the existing locator-owned runtime memory owner.
- [ ] 3.9 Preserve same-window and cross-window convergence for credential-free manual candidates and open
      Workspace presentation.
- [ ] 3.10 Add mutation-resistance evidence by bypassing/removing the dismissal transition and proving the named
      unchanged-snapshot test fails for unwanted reopen.

Green evidence:

- [ ] 3.11 Checked unit tests prove candidate/open separation, stable identity, duplicate suppression, close/reopen,
      daemon disappearance/reappearance, malformed storage rejection, and zero credential persistence.
- [ ] 3.11a Checked CLI/App tests prove canonical path aliases join one managed child, failed starts do not enter
      history, favorites survive Stop, tab Close keeps the service running, Stop is generation-exact, daemon stop
      spares external serve, restart restores once, and stale/unsupported external Stop is rejected.
- [ ] 3.12 Focused review passes before Workspace Launcher UI work begins.

## 4. Workspace Home, Running Navigation, Task Manager, and Launcher

Production owner: a new `packages/app/src/components/workspace-launcher/` feature folder composed by
`packages/app/src/components/hosted-shell.tsx`.

- [ ] 4.0 Add a fixed-point component red case proving Workspaces has no fixed Home, favorites/recent/path launch,
      running-backend navigation, or Task Manager.
- [ ] 4.0a Build fixed non-closeable/non-reorderable Home as the first tab with Favorites above, a path-input form in
      the middle, Recent below, and a `/workspaces/tasks` entry.
- [ ] 4.0b Bind path submission to current local-daemon authority with form loading lock, direct errors, focus on
      success, and unsupported state for standalone/remote App delivery.
- [ ] 4.0c Render all current backend leases as Workspaces secondary navigation; selecting one focuses or opens the
      exact Workspace without deriving identity from port.
- [ ] 4.0d Build Task Manager detail for path, display identity, owner, health, start time, lifecycle state, and
      ownership-valid Stop/Close/favorite commands.
- [ ] 4.0e Build one pure path-first label selector: verified GitHub `org/repo`, else canonical folder basename;
      current branch is subtitle, complete path is retrievable, and locator/port is diagnostic-only.

- [ ] 4.1 Add a fixed-point component red case proving the current `+` Dialog presents a URL input as its direct
      plane and has no candidate list.
- [ ] 4.2 Build a pure launcher selector joining candidates, open Workspaces, connection observations, Environment
      display facts, and pending commands without acquiring those subscriptions itself.
- [ ] 4.3 Render searchable candidate rows with project identity, Environment when known, current reachability, and
      exhaustive Focus/Open/unavailable command selection.
- [ ] 4.4 Make Focus activate the existing exact Workspace without creating a tab/session/frame.
- [ ] 4.5 Make Open create exactly one Workspace and bind loading/error feedback to that row without resizing the
      Dialog or tab strip.
- [ ] 4.6 Render checking, offline, authentication-required, unsupported, and concrete operation failures directly;
      do not hide them in Tooltip or rewrite them as generic offline.
- [ ] 4.7 Move manual URL input into `Connect another backend...`; implement back/cancel/success transitions while
      preserving list search and live candidate updates.
- [ ] 4.8 Put forget/remove connection actions in row menus and distinguish them from closing an open Workspace.
- [ ] 4.9 Preserve keyboard focus, accessible names, Dialog focus trapping, icon tooltips, and loading locks.
- [ ] 4.10 Preserve double-click tab-strip/empty-shell launcher entry only if focused interaction evidence shows it
      remains discoverable and does not conflict with native titlebar drag regions.

Green evidence:

- [ ] 4.11 Checked component tests cover candidate list, Focus, Open, duplicate suppression, secondary URL flow,
      unavailable states, live row updates, failure, cancel/back, and focus restoration.
- [ ] 4.11a Checked component tests cover fixed Home, favorite/recent ordering, path form lifecycle, running nav,
      Task Manager capability matrix, GitHub/folder fallback, branch refresh, long paths, and hidden primary port.
- [ ] 4.12 Basic component browser fixture proves narrow Dialog containment and stable control dimensions; record it
      as preparation evidence only.
- [ ] 4.13 Focused review passes before navigation retirement.

## 5. Environment Selection and Store Authority

Production owner: new focused Environment selection/authority modules; existing Store action dispatcher remains the
final synchronous mutation guard.

- [ ] 5.1 Add checked red evidence that current Store reads and mutations follow global `activeTabId` and require a
      backend URL selector.
- [ ] 5.2 Define runtime-parsed, credential-free selected-Environment state; auto-select only when exactly one current
      Environment exists.
- [ ] 5.3 With multiple Environments and no valid selection, require explicit Environment choice and never choose
      the first observed Environment.
- [ ] 5.4 Implement deterministic stable source resolution only among current compatible observations carrying the
      selected exact `envUri`.
- [ ] 5.5 Preserve the chosen current source while valid; permit source replacement only before an action draft is
      pinned.
- [ ] 5.6 Capture tab id, session id, locator, tab creation identity, observation generation, `envUri`, and source
      evidence when an action/draft opens.
- [ ] 5.7 Revalidate that full authority synchronously at dispatch; replacement generation or identity retires it
      while retained display data remains visible.
- [ ] 5.8 Derive same-Environment conflict only from settled source-labelled evidence; preserve each source and
      disable affected mutation without fabricating merged truth.
- [ ] 5.9 Distinguish no Environment, pending, offline, authentication-required, incompatible, no current authority,
      and conflict states.
- [ ] 5.10 Retire `store-manager-backend-selector.tsx` and any Store product copy that asks users to choose a backend
      URL.
- [ ] 5.11 Update hosted-environment typed models without asserted ingress contracts or capability-as-permission.
- [ ] 5.12 Add mutation-resistance tests that bypass exact-generation/action-draft retirement and fail at the named
      Store dispatch boundary.

Green evidence:

- [ ] 5.13 Checked tests cover zero/one/multiple Environments, stable source resolution, cross-Environment refusal,
      same-id tabs, generation replacement, pinned draft retirement, and settled source conflict.
- [ ] 5.14 Focused review passes before Store route mutations consume the new owner.

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
- [ ] 6.3 Add a fixed-point Server red case showing hosted Store Detail cannot currently request typed
      `listSpecs/listChanges` for an explicit Store selector.
- [ ] 6.4 Implement demand-driven Spec-list work through `OpenSpecCliContractExecutor.listSpecs({ store })`.
- [ ] 6.5 Implement demand-driven Change-list work through `OpenSpecCliContractExecutor.listChanges({ store })`.
- [ ] 6.6 Preserve parsed data, raw payload/stdout, stderr, diagnostics, contract drift, success, exit status,
      source Environment, Store id, and source generation as separate facts.
- [ ] 6.7 Keep Spec and Change regions independent for initial load, retained refresh, error, recovery, and
      invalidation.
- [ ] 6.8 Key Projection Work by composite Store/content/source identity; reject stale or cross-Store completion.
- [ ] 6.9 Reuse Store-root observation invalidations and data-free Push -> Pull transport; add no App poller or
      direct filesystem parsing.
- [ ] 6.10 Expose hosted read procedures only after normal Access Gate admission; never accept client credentials in
      projection payloads.
- [ ] 6.11 Add App transport parsing that rejects malformed successful payloads and retains explicit contract-error
      evidence.
- [ ] 6.12 Prove lazy detail-only execution: Store index does not start Specs/Changes work for every row.

Green evidence:

- [ ] 6.13 Checked Core/Server/App tests cover exact CLI argv, composite identity, independent regional settlement,
      invalidation, stale completion rejection, Access Gate boundary, additive fields, and contract drift.
- [ ] 6.14 Mutation test changing/removing the explicit Store selector makes the named projection tests fail for
      cross-root data.
- [ ] 6.15 Focused review passes before Store Detail treats content as available.

## 7. Stores Index, Environment Evidence, and Store Detail

Production owners: new focused route/component folders under `packages/app/src/routes/` and
`packages/app/src/components/`; shared selectors remain subscription-free presentation owners.

- [ ] 7.1 Register typed `/stores`, `/stores/environments`, and composite Store Detail routes with validated opaque
      Environment and Store path values.
- [ ] 7.2 Add red navigation evidence that current Store routes expose Inspector/Context Matrix/Inventory tabs and
      key local selection by Store id alone.
- [ ] 7.3 Build the Stores index as a divided, searchable, filterable, selected-Environment list without a desktop-
      only table or horizontal scroll.
- [ ] 7.4 Join list/Doctor/Root/Reference/mutation facts by composite Environment/Store identity and retain
      source-labelled regional state.
- [ ] 7.5 Show direct Store id, health/failure, currently observed Root/Reference usage, and active/failed/
      indeterminate mutation; keep path/Git/metadata/raw evidence secondary.
- [ ] 7.6 Move setup/register into an index-level `New Store` flow with current authority pinning and lifecycle
      feedback.
- [ ] 7.7 Build Environment evidence as a Stores title action/subpage showing connected projects, CLI versions,
      compatibility facts, and source conflict without becoming primary navigation.
- [ ] 7.8 Build Store Detail header and direct usability/failure plane from composite identity and current authority.
- [ ] 7.9 Project `Root for` and `Referenced by` only from currently observed source-labelled Workspace Context;
      label completeness honestly and preserve retained stale/error evidence.
- [ ] 7.10 Render readonly Specs with requirement counts and active Changes with task progress/status/last-modified;
      keep their loading/error/recovery states independent.
- [ ] 7.11 Render repository root, metadata, Git facts, and successful Doctor/raw CLI envelopes in secondary
      disclosures; promote every blocking diagnostic.
- [ ] 7.12 Move unregister/remove into Store Detail overflow/danger flow; preserve backend-owned lifecycle,
      confirmation, authority retirement, and concrete rejection.
- [ ] 7.13 Omit `Open as Workspace` unless a real production daemon/backend owner can focus or establish the Store
      Workspace without adopting backend process supervision.
- [ ] 7.14 Retire Store Manager shell, Inspector, Inventory, Context Matrix, backend selector, obsolete tests, and
      technical projection terminology.
- [ ] 7.15 Ensure no page, selector, or component infers machine-wide completeness, Store ownership, permission, Git
      synchronization, or optimistic inventory/content.

Green evidence:

- [ ] 7.16 Checked route/component tests cover same-id Stores across Environments, route reload/decode, no authority,
      conflict, Usage provenance, regional content states, mutation lifecycle, and direct errors.
- [ ] 7.17 Container fixtures at crowded/intermediate/spacious inline sizes prove one readable mobile column,
      increased alignment only when space permits, wrapping long values, stable controls, and no horizontal overflow.
- [ ] 7.18 Focused review passes before full App navigation cleanup.

## 8. App Navigation and Workspace Continuity

Production owners: `packages/app/src/app-router.tsx`, `packages/app/src/components/app-layout.tsx`, and persistent
`HostedShell` mount ownership.

- [ ] 8.1 Make `/` canonicalize to `/workspaces` and expose Workspaces/Stores as the only primary desktop/mobile
      domain navigation.
- [ ] 8.1a Make Workspaces the only expandable primary item and project every current backend into its secondary
      navigation without turning Settings, Connections, Environment, or Task Manager into primary domains.
- [ ] 8.1b Register `/workspaces/tasks` as the Home-owned secondary page while preserving fixed Home and mounted
      project iframe identity.
- [ ] 8.2 Keep Settings at the utility edge without presenting it as a third domain destination.
- [ ] 8.3 Remove `/connections`, `/environment`, and old nested Store routes without redirects or compatibility
      components.
- [ ] 8.4 Preserve launch relay, daemon candidate, connection observation, mutation observation, and HostedShell
      owners for the complete App lifetime.
- [ ] 8.5 Preserve exact Workspace iframe DOM/Document identity across Workspaces -> Stores index -> Store Detail ->
      Workspaces navigation.
- [ ] 8.6 Preserve OpenTray/browser/PWA/native-frame titlebar geometry, drag boundaries, overlay controls, Workspace
      Open in browser, and shell block-size ownership.
- [ ] 8.7 Audit mobile header labels/icons and stable dimensions for only the retained destinations.
- [ ] 8.7a Keep GitHub/folder titles and branch subtitles readable at narrow widths; expose full path without letting
      paths, ports, badges, or controls overlap or create a second inline scroll owner.
- [ ] 8.8 Remove stale Connections/Environment copy, imports, route tests, and generated/bundled App assumptions.

Green evidence:

- [ ] 8.9 Checked router test compares the same iframe DOM node before and after the full Stores detail round-trip.
- [ ] 8.10 Basic component browser fixtures cover mobile/desktop navigation and titlebar variants without claiming
      final visual acceptance.
- [ ] 8.11 Focused App-shell review passes before repository-wide gates.

## 9. Documentation, Headers, and Release Metadata

- [ ] 9.1 Update `AGENTS.md` with the settled two-domain App law, candidate/open distinction, Environment-scoped
      Store identity/authority, managed directory lifecycle, path-first presentation, and Store Detail boundary.
- [ ] 9.2 Update `i18n.zh.md` with first-hand versus derived vocabulary for Connection candidate, open Workspace,
      Workspace Home, managed backend, directory catalog, Task Manager, path-first label, Environment Store scope,
      composite Store identity, Store Detail Usage, and readonly Store content.
- [ ] 9.3 Update relevant English/Chinese README and App documentation without exposing implementation-only backend
      selection or retired route names.
- [ ] 9.4 Audit every changed TypeScript/TSX file, including tests, for an accurate timestamped orthogonal-intent and
      original-request header; split files at the three-intent warning where practical and never exceed five without a
      compromise statement.
- [ ] 9.5 Audit every exported public contract/procedure for concise interface comments.
- [ ] 9.6 Add a package behavior `.changeset/*.md` covering affected publishable packages and the breaking App IA.
- [ ] 9.7 Update `implementation.md` and these checkpoints after each accepted slice without marking planned work as
      completed.

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
- [ ] 10.6 Run `pnpm format:check`.
- [ ] 10.7 Run `pnpm lint:ci`.
- [ ] 10.8 Run `pnpm typecheck`.
- [ ] 10.9 Run `pnpm test:ci`.
- [ ] 10.10 Run `pnpm test:browser:ci`.
- [ ] 10.11 Run `git diff --check` and strict OpenSpec validation.
- [ ] 10.12 Record exact command output/head evidence in `implementation.md`; do not claim final browser acceptance.

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
