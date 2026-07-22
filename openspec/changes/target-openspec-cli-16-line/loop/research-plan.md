<!--
Orthogonal intents (created 2026-07-15 Asia/Shanghai):
1. Record verified upstream and repository facts that constrain adaptation.
2. Preserve the architecture decisions approved through Wayfinder.
3. Sequence the work around shared contracts before product surfaces.
4. Bind material risks to explicit mitigations.
5. Define verification across CLI, reactive, live, static, App, and delivery boundaries.

Original request (2026-07-15): "你直接给我一份合理的，符合openspec团队设计哲学与预期的效果。"
Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
Owner-reported debt (2026-07-22): "整个过程中，几乎都在 Loading，切换个页面也等，做任何动作也在等，给我的感觉就是非常卡。"
-->

## Research Findings

### Source law

- `references/openspec` is the official upstream submodule and is pinned to `v1.6.0` (`e1b51d1`). The repository-local OpenSpec CLI currently reports `1.5.0`; it can manage this change's artifacts but is not evidence that the product is adapted to 1.6.
- OpenSpecUI 5.x nominally targets OpenSpec CLI 1.5.x. The audit found incomplete adaptation risk beginning in 1.4: `/opsx:sync` joined the core profile in 1.4, Stores and resolved roots changed the operating model in 1.5, and 1.6 adds `/opsx:update`, Oh My Pi, Trae delivery, tracked-task globs, stricter validation/archive behavior, and empty-Store correctness.
- OpenSpec CLI JSON and exit status are the workflow source of truth. Workflow payloads are mostly camelCase; Store, Context, Doctor, and embedded root fields use documented snake_case. Parsers must preserve required meaning while tolerating additive fields.
- OpenSpec 1.6 References expose a one-level read-only Spec index. They do not expose referenced changes or recursively follow another Store's References.
- Store registration belongs to the backend process's inherited OpenSpec data home. `XDG_DATA_HOME` replaces the complete user-data scope; it is not a project registry overlay.

### Current repository constraints

```text
launch projectDir
      |
      +-- ConfigManager / OpenSpecAdapter / DocumentService
      +-- server router and subscriptions
      +-- Git / terminal / notifications
      `-- export snapshot

Current implicit law: launch projectDir == writable OpenSpec root
OpenSpec 1.5+ law:    launch projectDir -> CLI root selection -> writable planning root
```

- Core and server services commonly construct paths and adapters from the launch `projectDir`. This is incorrect for declared or explicit Store roots and can target the wrong repository.
- Existing CLI execution already has the correct authority boundary, but resolved root, Store flags, `artifactPaths`, `existingOutputPaths`, `actionContext`, References, JSON diagnostics, and exit status are not yet one durable application contract.
- The reactive filesystem is currently project-root oriented. Store discovery includes a five-second polling path; the effective data home and dynamically registered Store roots are not first-class observation roots.
- `packages/web/src/lib/use-subscription.ts` already lets live and static modes share React pages by changing providers. This is the correct parity seam.
- `ExportSnapshot.specs`, Spec routes, search, cache keys, dashboard links, and SSG enumeration use bare `specId`. Different owned/referenced sources can legally contain the same id.
- Task projection currently scans every schema-matched Markdown artifact. OpenSpec 1.6 formal progress scans only the artifact selected by `apply.tracks`, with top-level `tasks.md` fallback when schema or tracked output resolution yields nothing.
- Tool initialization and hook/invocation contracts hard-code workflow vocabularies. Adding only a Settings badge would leave `/opsx:update` inaccessible and initialization state incorrect.
- `packages/app` is already the persistent multi-project shell, while `packages/web` is the project workspace. Environment-scoped Store administration therefore belongs in App, not an alternate Web entry or a new package without multiple consumers.

### Approved product and protocol boundaries

```text
App
  +-- backend connections / tabs
  +-- runtime environments keyed by opaque envUri
  +-- Home + Environment Center
  `-- experimental Store Manager
         +-- Inspector
         +-- Context Matrix
         `-- Inventory

Project WebUI
  +-- one launch project
  +-- one CLI-selected writable planning root
  `-- zero or more read-only Reference Spec sources
```

- `envUri` identifies backend host identity plus effective OpenSpec data home. It is backend-issued, opaque, stable across ports/projects/process restarts for the same pair, and separate from `apiBaseUrl`.
- Hosted capability names are `stores.inspect`, `stores.mutate`, and `contexts.inspect`. They describe compatibility, never permissions.
- Inventory projects `openspec store list --json`; Inspector projects `openspec store doctor [id] --json`; project Context projects `openspec context --json`. OpenSpecUI may add provenance envelopes but must not reinterpret upstream facts.
- Store mutations are backend-owned operations with `accepted -> running -> succeeded | failed`; unrecoverable terminal loss is `indeterminate`. V1 has no Cancel and no automatic retry.
- The optional Backend Access Gate is one shared Bearer credential for the entire backend boundary. `--auth` generates it; `--password` normalizes an operator secret. It introduces no account, role, ACL, or permission model.
- Reactive consistency is push invalidation followed by client pull. Push messages identify invalidated facets; they do not become a competing Store state database.

### Approved projection boundaries

- `RootContext` distinguishes launch project, writable planning root, root source, optional Store id, CLI health, Reference health, and effective data-scope diagnostics.
- `SpecIdentity` is `(owned, specId)` or `(referenced, storeId, specId)`. Source is part of identity across routes, cache keys, search, provider lookup, view transitions, and SSG.
- `trackedTaskProgress` is formal workflow truth. `documentChecklistSummary` is secondary analytics. `applyInstructionProgress` is the raw Apply result. No generic compatibility `progress` alias is retained.
- Static export supports direct Reference Specs only through CLI list/show. When effective References exist, `--references=include|omit` is mandatory. Include is complete-or-fail; omit records explicit omission. Snapshots remove absolute paths, data-home/registry paths, remotes, backend identity, and path-bearing raw diagnostics.

## Decision & Plan (For Approval)

Approval state: the manager approved each architecture boundary through the Wayfinder tickets and approved convergence into this OpenSpec loop on 2026-07-15. Implementation must loop back here only if a listed boundary proves technically impossible or materially changes product behavior.

### Phase 1: Establish CLI contracts and compatibility fixtures

1. Update the OpenSpecUI major-line compatibility contract for CLI 1.6 without using version acceptance as feature-completeness proof.
2. Add typed CLI executor projections for root/context, list/show by Store, workflow status/instructions, Store list/doctor/mutations, validate, and archive. Preserve JSON payload, structured diagnostics, stderr, and exit status with command-specific adapters.
3. Add 1.6 contract fixtures for nearest root, declared Store fallback, explicit Store, References, empty healthy Store, strict archive failure, scenario-loss protection, tracked-task globs, `sync`, and `update`.
4. Keep 1.4/1.5 regression coverage beside 1.6 fixtures so previously missed contracts cannot remain hidden behind the new version gate.

### Phase 2: Replace `projectDir` root assumptions

1. Introduce a core Root Context resolver backed by CLI root/context results.
2. Separate launch-project services from planning-root services. Pass resolved root and provenance explicitly into adapters, document services, workflow actions, config, Git planning scope, terminals, and export.
3. Preserve CLI-provided `changeRoot`, Store flags, artifact paths, existing output paths, action context, References, and root diagnostics end to end.
4. Remove path reconstruction from launch cwd. Root-dependent actions remain unavailable while root resolution is loading or unhealthy.
5. Add one shared public Root Context subscription and consume it in the project shell before adapting individual pages.

### Phase 3: Deepen the reactive kernel

1. Generalize reactive observation from one project tree to a dynamic environment observation set: launch project roots, effective OpenSpec data home, registered Store roots, and connected planning roots.
2. Map filesystem and CLI-mutation outcomes to `envUri`-scoped invalidation facets.
3. Keep data queries authoritative: subscribers receive invalidation, then pull fresh CLI projections. Coalesce duplicate invalidations and make them idempotent.
4. Replace Store polling as the primary path. Retain bounded polling only for watcher failure, missing paths, or platform limitations.
5. Test two clients sharing an environment, external Store edits, registry mutations, root removal, reconnect, and concurrent CLI conflict behavior.

### Phase 4: Adapt the project workspace

1. Shell and Dashboard: show launch project and active planning root separately; gate root-dependent surfaces on CLI/root/Reference health.
2. Changes, Change detail, Archive, and OPSX actions: operate only on the writable root; add `update`; preserve CLI paths/flags; surface strict validation/archive results without fallback retries.
3. Specs, Spec detail, Search, and view transitions: introduce the shared Spec Catalog, Owned/Referenced scopes, compound routes, collision-safe cache/search identities, and immutable referenced entries.
4. Config and Context: split Project Binding, Active Root Config, and Environment Global Config; rename project Stores to Context; expose registry/Reference diagnostics without project-local registry semantics.
5. Git and Terminal: make code repository versus planning repository and launch cwd versus planning-root cwd explicit before every operation.
6. Settings and initialization: add `sync`, `update`, Oh My Pi, Trae, CLI/root/data-scope diagnostics, and complete workflow drift checks across tool state, hooks, command generation, and tests.
7. Notifications: keep records project-backend scoped while adding root/context invalidations and health events.
8. Replace generic task `progress` with the three approved projections and update dashboard, list/detail, notifications, static snapshot, tests, and labels according to their separate authority.

### Phase 5: Preserve live/static parity

1. Move source-aware Spec Catalog mapping into shared browser-safe code used by both providers.
2. Replace flat snapshot identity and `/specs/$specId` with compound identity and owned/referenced routes.
3. Make snapshot generation resolve the active planning root through CLI rather than constructing `OpenSpecAdapter(projectDir)` as root truth.
4. Add `--references=include|omit`; materialize direct included References through official CLI list/show commands and refuse partial publication.
5. Add explicit not-declared/included/omitted metadata and sanitize machine-sensitive provenance, including current absolute `meta.projectDir`.
6. Update static hydration, search, dashboard, route enumeration, SSG, and tests together. Rebuild SSG before visual judgment.

### Phase 6: Establish App and hosted-environment behavior

1. Extend backend health with protocol version, `apiBaseUrl`, opaque `envUri`, CLI/server versions, root/context summary, and optional capabilities.
2. Add the optional whole-backend Bearer gate across HTTP API, tRPC HTTP/subscriptions, PTY WebSocket, files, terminal, notifications, and future Store operations. Keep credentials session-memory only; consume auto-launch fragments once.
3. Build App Home/Connections with retained backend entries, transient credentials, reachability states, reconnect/open/remove/reorder actions, and first-run connection flow.
4. Build Environment Center grouped by `envUri`, showing connected projects, compatibility, data-scope diagnostics, and optional capabilities without inferring environment identity from URLs.
5. Implement the experimental Store Manager inside `packages/app`: Store Inspector as primary, Context Matrix as sibling, and Inventory as wide-screen scan. Mutations use backend-owned lifecycle and explicit destructive confirmation.
6. Keep Store Manager experimental and out of the OpenSpecUI 6.0 support gate. Do not extract a new package until another real consumer shares a stable protocol module.

### Phase 7: Deliver in reviewable slices

1. Land this artifact set as the planning baseline.
2. Implement sequentially through contract-focused PRs: CLI/Root Context; reactive/server; project WebUI/task/workflows; static export; App/access/environment; experimental Store Manager.
3. Include focused changesets for each publishable behavior slice and keep this OpenSpec change active until all accepted slices converge.
4. After every merged slice, update `loop/implementation.md` and `loop/checkpoints.md`. Any architecture or scope divergence returns to Intake/Research Plan before more code.
5. Finalize only after cross-slice acceptance, archive verification, and protected-branch delivery gates pass.

### 6.16 execution split: interaction latency without authority regression (2026-07-22)

The owner's pervasive-Loading report is real, but it is not one backend latency claim. The current
implementation combines four independent facts into similar visual waiting states:

```text
route first visit         -> independent subscription has no cache -> content data unknown
Root cached remount       -> cached display exists, but no replacement stream has proved it current
detail forward navigation -> View Transition waits for a prefetch query before route commit
Root refresh              -> manager resolves Doctor/Context -> root writes must stay locked
artificial route gate     -> Settings/Archive add one client-only frame with no network dependency
```

The first production package is a safety correction, not a visual optimization: Root Context must use
the existing authoritative-subscription lifecycle so cached A can remain visible while `isLoading` stays
true and root-dependent actions stay locked until current B emits. It must propagate real tRPC
`connecting`, `pending`, `stopped`, `complete`, and error callbacks. This closes the gap where the
generic retained cache can otherwise make a cached `ready` Root Context appear write-authoritative during
remount/reconnect.

After that focused correction, do the following packages independently and in this order:

1. Instrument navigation click, subscription-first-data, Root-ready, and detail-prefetch phases. Do not
   infer server latency from a visual spinner or use sleeps as evidence.
2. Change the detail View Transition prefetch policy only with a slow-query red case. Route commit may be
   decoupled from prefetch, but Git binding tokens and compound Spec identity cannot be dropped or
   relabeled by a late prefetch.
3. Remove the Settings/Archive client-only one-frame gates as isolated route slices, then audit list and
   Config topology one owner at a time. Initial no-data, empty, stale/updating, current, and error must
   stay distinguishable.

No package may globally suppress Loading, unlock a root mutation from stale data, turn a root error into
success, or conflate presentation continuity with current operation authority. The owner performs final
visual/browser acceptance; agent evidence ends at focused Vitest and component-level fixtures.

#### 6.16-B: detail-navigation phase timing

The next package measures only the existing detail-navigation coordinator. `runPreparedViewTransition`
is the sole production boundary that observes the request, detail preparation outcome, real route update,
and View Transition settlement without inventing cross-owner ordering.

```text
requested(area, from, to, attempt)
  -> prepare-settled(ready | cancelled | skip-vt)
  -> route-update-issued
  -> transition-settled | failed(stage)
```

Store a typed, bounded, process-memory sample with monotonic phase durations. Reuse the existing local
bounded-log discipline, but create a navigation-specific owner; do not add navigation fields to the
translation log. A newer attempt in the same route area supersedes the old request. Late A effects remain
attributed to A in history, but cannot alter B or reclaim latest-request evidence. The record is diagnostic evidence only: no persistence, network
upload, Notification, console output, settings surface, or user-facing analytics belongs in this package.

Focused evidence starts through the real `VTLink`/navigation coordinator with a controlled slow prepare.
It proves the four ordered phases and their durations, then proves A pending -> B settled -> late A records
its own superseded effect without rewriting B. Removing only the real-update-issued record must make the
named phase assertion red; restoring phase publication as latest-request ownership must make the late-A
assertion red. Keep `140ms`/`2500ms`, prefetch
policy, subscriptions, Root authority, Server behavior, Settings/Archive gates, and page Loading unchanged.
Checkpoint `6.16` stays open. Subscription-first-data and Root-ready timing require separate packages
because the current protocol supplies no navigation correlation token.

Independent review correction: TanStack `navigate()` returns a Promise that resolves when navigation is
complete, but the current production callback deliberately discards it. The synchronous callback boundary
therefore proves only `route-update-issued`, never Router or DOM commit. Do not await that Promise inside
this measurement-only package because doing so would change View Transition/navigation policy. Likewise,
the pre-existing late-A route update must not be silently hidden: label A superseded, record its later
prepare/update/settlement against A, and keep B as the latest request. A rejected prepare/update/transition
must end in a typed failed state rather than remain indefinitely prepared or update-issued.

#### 6.16-C: remove the live Settings artificial mount gate

The live `Settings` route currently creates a local `loading=true`, clears it in a passive effect, and
returns `Loading settings...` before that effect. This state observes no network, subscription, Router,
View Transition, or Settings-data readiness fact. It is an artificial mount gate that hides preferences
and the real Settings composition for one client frame on every mount.

Remove only this local state/effect/early return. The fixed point renders the real `Settings` component
before effects and proves the Settings composition is already present while `Loading settings...` is
absent. When the Config subscription already supplies cached non-default values, every writable local
draft synchronized by passive effects must also initialize from that Config on the same render. A visible
default draft plus an enabled Save control is not first-frame continuity. Temporarily restoring only the
local gate, or resetting cached draft initialization to defaults, must make the corresponding exact test
red. Do not change
`use-settings-tool-subscriptions`, `SettingsStatic`, static Appearance-only behavior, subscription data
flow, or any real loading/updating/error topology.

Archive owns a separate artificial `requestAnimationFrame` gate. Its real data wait is already represented
by `isLoading && !archived`, but removing it remains the next independent package with its own resolved-data
red and initial-no-data green. It must not be folded into the Settings commit.

## Capability Impact

### New or Expanded Behavior

- CLI-backed Root Context and source-aware Spec Catalog.
- Read-only Reference Specs across live project views and consented static exports.
- Multi-root reactive observation with environment-scoped invalidation.
- Hosted environment identity/capabilities and backend-owned Store mutation protocol.
- Optional whole-backend Bearer Access Gate.
- App Home/Connections, Environment Center, and experimental Store Manager composition.
- Explicit static Reference inclusion/omission and privacy redaction.

### Modified Behavior

- OpenSpecUI compatibility advances to the CLI 1.6 line and audits missed 1.4/1.5 contracts.
- All project pages move from launch-directory assumptions to CLI-resolved root provenance.
- Workflow/tool delivery adds `sync`, `update`, Oh My Pi, and Trae completeness.
- Generic task progress is replaced by formal tracked progress, document statistics, and raw Apply progress.
- Store polling becomes a fallback behind the shared reactive kernel.
- Spec routes/search/cache/snapshot identity become source-aware and intentionally breaking.
- Validate/archive UI follows CLI exit status and diagnostics without silent bypass.

## Risks and Mitigations

- **Cross-package blast radius:** root, Spec identity, and task semantics affect core/server/web/cli/app. Mitigation: land typed contracts and fixtures first, then migrate consumers in dependency order; do not maintain parallel old/new public models.
- **CLI shape drift:** upstream intentionally mixes naming conventions and may add fields. Mitigation: command-specific Zod schemas validate required meaning, preserve raw payload/diagnostics for evidence, and tolerate additive fields.
- **Wrong-root mutation:** any fallback to launch cwd can modify the wrong repository. Mitigation: root-dependent operations require resolved Root Context; tests use separate code and planning repositories and assert actual mutation paths.
- **Reactive fan-out and watcher lifecycle:** dynamic Store roots can leak watchers or emit storms. Mitigation: reference-count environment observation roots, coalesce facet invalidations, test unregister/removal cleanup, and keep polling bounded.
- **Security overclaim:** a shared Bearer secret can be mistaken for authorization or encryption. Mitigation: name it Access Gate, expose no role vocabulary, require authentication on every transport, keep credentials transient, and document HTTPS/WSS as deployment responsibility.
- **Static data disclosure:** Reference bodies and current absolute paths can cross repository ownership. Mitigation: no default include, complete-or-fail materialization, explicit omission state, structured allowlist serialization, and redaction tests against paths/remotes/env identity.
- **Identity migration link breakage:** replacing `/specs/$specId` affects navigation and generated sites. Mitigation: treat compound routes as one deliberate breaking change, update live/static route trees and every producer together, and reject ambiguous bare-id lookup.
- **Task regression:** secondary checklist statistics could accidentally drive readiness. Mitigation: distinct types and names with no generic alias; test `0/0` as `no-tasks` and keep archive authority in CLI results.
- **Upstream Apply inconsistency:** `instructions apply` can differ from tracked glob progress. Mitigation: preserve both attributed projections and display divergence rather than normalize it.
- **Experimental App scope pressure:** Store Manager can delay the correctness baseline. Mitigation: preserve project/root correctness as the 6.0 gate, ship App work in later reviewable slices, and retain explicit experimental labeling.
- **Artifact manager version mismatch:** the local artifact CLI is 1.5 while the target is 1.6. Mitigation: use the declared schema for planning, but validate product contracts against the pinned 1.6 source and executable fixtures rather than the artifact CLI version.

## Verification Strategy

### Contract matrix

```text
Root source       nearest | declared Store | explicit Store
Reference state   none | healthy | unresolved | duplicate specId | self-reference
Store state       populated | empty healthy | missing | removed during observation
Task state        tracked glob | tasks.md fallback | no tasks | Apply divergence
Export policy     no refs | include | omit | missing flag | include failure
Transport         HTTP | tRPC WS | PTY WS | reconnect | invalid credential
```

- Run contract tests against the pinned OpenSpec 1.6 implementation or deterministic first-party JSON fixtures for every matrix branch.
- Assert filesystem effects in separate launch/planning/Reference repositories, not only returned paths.
- Validate Store/Context/Doctor envelopes, exit codes, empty roots, Reference diagnostics, strict archive failures, and scenario-loss behavior.

### Package-focused checks

- `packages/core`: Root Context, CLI schemas/executor, task projections, Spec identity/catalog, reactive observation registry, hook/tool workflow vocabulary.
- `packages/server`: root-scoped services, invalidation subscriptions, access middleware across transports, hosted environment/projection/mutation lifecycle.
- `packages/web`: all named project pages, loading/error states, compound routes, search/cache/view transitions, static provider parity, responsive/browser acceptance.
- `packages/cli`: 1.6 compatibility, `--auth`, `--password`, export `--references`, snapshot redaction, auto-launch credential handoff.
- `packages/app`: connection persistence without credential persistence, `envUri` grouping, capability degradation, Store Inspector/Context/Inventory, mutation terminal states.

### Static and browser acceptance

- Run focused static provider and entry tests, then clean/rebuild SSG with `pnpm --filter @openspecui/web build:ssg`.
- Compare live and static Owned/Referenced lists, colliding Spec ids, detail routes, search results, translation/copy actions, and omission states.
- Exercise desktop and mobile App/project workflows, including loading, stale data, reconnect, destructive confirmation, and multi-client reactive updates.
- Inspect generated `data.json` for forbidden absolute paths, data-home/registry values, remote URLs, `envUri`, and raw path-bearing diagnostics.

### Delivery gates

- Run `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, and `pnpm test:browser:ci` before each PR according to affected scope.
- Add `.changeset/*.md` for every publishable behavior change.
- Keep `main` protected; merge only through passing PR checks.
- After final implementation acceptance, verify OpenSpec change completeness and archive flow before release/version automation.
