<!--
Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
1. Keep implementation reality distinct from the approved product/research plan.
2. Authorize an ordered worker Apply across App state, hosted protocol, Server projections, and product routes.
3. Preserve exact red/green, focused-review, predecessor-Change, and owner-acceptance stop boundaries.
4. Define objective loopback triggers for discoveries that invalidate the approved design.

Original request (2026-07-30): "那么请你开始撰写这份change，如果没有疑问，可以一步到位，并提交。"
Original request (2026-07-30): "Workspace需要记住曾经打开的目录，并且支持收藏。关键是，支持直接从目录直接启动 openspecui 服务。"
Owner lifecycle decision (2026-07-30): closing a tab preserves a managed service; explicit Stop terminates it; daemon stop affects only managed services; daemon restart restores the managed running set.
Original request (2026-07-30): "所有正在运行中的backend都会显示在这里。"
Original request (2026-07-30): "任务管理器...可以杀掉Workspace，或者收藏、取消收藏"
Original request (2026-07-30): "Tab这里默认写仓库路径 org/repo，如果没有就使用path的foldername；subtitle写git分支名"
Original request (2026-07-30): "我让另外一个 Agent 做了个开头，但我觉得它们做偏了，请你直接接手任务，review，并真正完成相关工作，我来做最终的 review"
-->

## Implementation State

The production implementation reached the Workspaces and Stores route families on top of `fdc3ac1`. Independent
review of `bb9e82e` found four production gaps: Launcher Open/Connect had no real pending transition, manual
candidates persisted before reachability succeeded, mobile omitted running-backend secondary navigation, and Store
Detail collapsed exact Environment conflict into generic authority loss. The current correction closes all four,
also makes isolated daemon fallback identity stable (preventing a candidate-probe render loop), rejects URL userinfo
from credential-free persistence, and gives dynamic Stores/Task rows physical layout continuity.

```text
Product decision       approved by manager
Official CLI research complete against references/openspec v1.6.0
App ownership research complete against current feat/opentray-app-mode worktree
Workspace lifecycle correction approved by manager
P1 typed contracts       landed (Store-content capability + browser-safe projection schemas + checked fixtures)
P2 managed backend       landed (canonical directory catalog, daemon child owner, exact Stop/restart restoration)
P3 candidate/open        landed (admission/dismissal reducer, credential isolation, iframe continuity)
P4 Workspace surfaces   corrected (probe-before-persist + mobile running navigation)
P5 Environment runtime  landed (persisted envUri selection, per-source collection, stable authority, conflict gate)
P6 Store content         landed (demand-driven Server Projection Work, typed Push -> Pull App transport)
P7 Store product         corrected (Detail preserves exact authority/conflict reason)
P8 navigation            corrected (mobile exposes running Workspace secondary navigation)
Review corrections       stable source survives redundant checking; cross-Store responses are rejected;
                         conflicts retain readonly source; Doctor failures do not block cleanup;
                         unregister and remove remain distinct composite-ledger actions
Current focused evidence App correction suite passes on the current worktree
Repository gates          full repository evidence remains prior-head; scoped correction evidence is current
External dirty blockers   format-check: user lockfile/script; test-ci: pre-existing Core/Server teardown timeouts
Implementation commit    bb9e82e (review fixed point; correction commit pending)
Pending delivery          owner walkthrough result, PR, archive/sync
Owner walkthrough      reserved for final handoff
```

Working tree base: `fdc3ac1` (`feat/opentray-app-mode`). Store-content Router ownership is already committed in
`c657aca`; the unrelated dirty `packages/server/src/router.ts` tracing delta is not required by this Change and is
excluded from its commit.

P2 managed-project backend verification on 2026-07-30:

- `managed-project-owner.test.ts` (14 tests): canonical dedupe/single-flight (3.0b), fixed-plan
  authenticated-local-App-only + readiness/lease (3.0c), exact Stop + daemon-stop + restart
  restore-once (3.0d), and mutation-resistance for dedupe/Stop-keyed/lease-cleanup (3.0f).
- `daemon-server.test.ts` (12 tests, +5 managed): authenticated start/stop delegation, structured
  rejection wire codes, unsupported-delivery rejection, and daemon-teardown child settlement.
- External foreground `serve` leases remain physically separate and currently publish `close-only`. The reserved
  `external-owner` compatibility fact has no callable App shutdown channel in this Change; Task Manager presents
  that limitation directly instead of fabricating Stop success.
- `openspecui typecheck` (incl. `tsconfig.command-tests.json` checked lane) passes; the
  `managed-project-production.ts` module wires the fixed `startServer` plan, `fs.realpath`
  canonicalization, and the owner→daemon control adapter.
- `daemon-protocol.ts` adds the versioned `start-managed-project`/`stop-managed-project` commands and
  `managed-project-started`/`managed-project-stopped` wire data with structured error codes; existing
  daemon workspaces, status, and presentation flows are unchanged.
- `local-app-server.ts` admits browser start, Stop, and Open POSTs only when `Origin` exactly equals the bundled
  loopback App origin (and `Sec-Fetch-Site`, when present, is `same-origin`). Cross-origin requests are rejected
  before any managed child or presentation owner is invoked.

Planning verification on 2026-07-30:

- `openspec status --change reshape-app-workspaces-and-stores` reports `4/4 artifacts complete`.
- `openspec validate reshape-app-workspaces-and-stores --strict` passes after the path-launch correction adds the
  `cli-commands` delta beside `hosted-app-distribution` and `hosted-environment-delivery`.
- Targeted Prettier write/check and `git diff --check` pass for every planning/terminology file.
- The repository Vite+ pre-commit hook cannot run because root `vite.config.ts` has no `staged` configuration. This
  is the same documented repository-local limitation used by the predecessor Change. The planning commit may use
  `--no-verify` only after the named checks pass; hook configuration is outside this Change.

Final focused verification on 2026-07-30 (prior implementation head):

- `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:browser:ci`, strict Change validation, and `git diff --check` pass.
- Core Store-content (10), Server Store-content (7), App (67 files / 377), CLI (29 files / 151), and App Chromium
  (4 files / 9) focused/full package evidence pass.
- Repository `format:check` reaches only two user-owned dirty failures: `pnpm-lock.yaml` and
  `scripts/diagnose-cli-runner.mjs`; they are excluded from this Change.
- Repository `test:ci` stops at the existing Core buffered-child force-escalation timeout. The independent Server
  full lane also reproduces the non-cooperative Store projection child timeout at clean fixed point `fdc3ac1`.
  Neither failing production owner is modified by this Change; focused Change tests remain green. These facts block
  PR creation but not a scoped local implementation commit.
- `loop/owner-walkthrough.md` binds 10 numbered final cases to implementation head
  `bb9e82e08dcbc17d80b2d6e9a28b394a14a6768c`; it contains no credentials, Authorization headers, or private
  fragments. Owner acceptance remains pending.

Correction verification on 2026-07-31 (uncommitted correction worktree):

- `pnpm --filter @openspecui/app typecheck` passes, including all checked App fixture lanes.
- `pnpm --filter @openspecui/app test --reporter=dot` passes: 68 files, 388 tests.
- `pnpm --filter @openspecui/app test:browser:ci` passes: 4 files, 9 component fixtures. This is preparation
  evidence only, not the owner browser walkthrough.
- The targeted correction suite passes: 10 files, 74 tests across Launcher pending/probe/persistence, mobile
  navigation, Store authority, Store refresh single-flight, persisted userinfo rejection, and list rendering.
- `openspec validate reshape-app-workspaces-and-stores --strict` and `git diff --check` pass.
- Full repository `format:check`, `test:ci`, and the full root lint/typecheck gates are not re-claimed here;
  the known user-owned lockfile/script formatting delta and pre-existing Core/Server teardown timeouts still block
  PR delivery until independently resolved.

This Change builds on completed owners from `integrate-app-mode-with-opentray` but does not close, rewrite, or claim
its remaining delivery/owner-acceptance checkpoints. Existing unrelated modifications in
`packages/server/src/server.ts` and `packages/server/src/server-startup.test.ts` predate this Change and are not
implementation evidence.

### Authorized Apply order

```text
P1  main spec law + typed public contract
 ↓
P2  managed local service owner / canonical directory catalog
 ↓
P3  candidate catalog / open Workspace state separation
 ↓
P4  Workspace Home / running navigation / Task Manager / Launcher
 ↓
P5  Environment selection / exact authority owner
 ↓
P6  Store content Projection Work + hosted transport
 ↓
P7  Stores index / Environment evidence / Store Detail
 ↓
P8  navigation retirement + responsive/browser fixtures
 ↓
P9  full gates + owner walkthrough handoff
```

Each phase must land its focused checked red/green evidence before the next dependent phase. Independent phases may
run concurrently only after their shared public contract is reviewed. A worker Apply includes code, tests, matching
checkpoint updates, scoped commits, and PR delivery; it must not return another plan-only handoff.

## Decisions Taken

### 1. Product ontology

```text
Workspace Home       fixed first Workspaces tab for directory launch and return
Workspace            one open project work surface with stable tab/session/frame identity
Workspace directory  canonical physical local project identity with favorite/recency facts
Managed backend      one daemon-owned project service started from Workspace Home
External backend     one foreground serve-owned project service registered by exact lease
Connection candidate one possible backend source for opening/focusing a Workspace
Environment          opaque backend-issued Store registry/data-home scope
Store                one registered standalone OpenSpec root inside an Environment
Store authority      exact current tab/session/creation/generation used for one operation
```

Connections and Environment remain internal/public protocol facts. Only Workspaces and Stores own top-level product
navigation.

### 2. Workspace state owners

The current `HostedShellState.tabs` contract must not continue owning both connection history and mounted
Workspaces. The worker introduces physically separate modules because candidate persistence, daemon runtime facts,
open tab identity, and iframe lifecycle are orthogonal intents.

Required ownership:

| Owner                  | Facts                                                                               | Persistence                              |
| ---------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------- |
| manual candidate store | normalized backend locator and optional display metadata                            | credential-free local persistence        |
| daemon candidate owner | opaque Workspace id, backend locator, runtime credential binding, snapshot revision | runtime only                             |
| open Workspace store   | stable tab/session id, locator, order, active id, daemon binding when present       | credential-free presentation persistence |
| frame runtime          | iframe source/load/error and DOM reference                                          | mounted memory only                      |
| directory catalog      | canonical path, favorite, successful recency                                        | credential-free shared local persistence |
| managed service owner  | physical path, child, readiness, generation, restore intent                         | runtime plus bounded restart intent      |

The exact persisted shape may be replaced without migration glue. Every new/changed module and test retains a
timestamped intent/original-request header.

Daemon transition law:

```text
new daemon id appears       -> candidate + auto-open/focus once
same snapshot repeats       -> no duplicate and no reopen after explicit close
user closes open Workspace  -> candidate remains; admission id becomes dismissed
user selects closed row     -> open/focus and clear dismissal
daemon id disappears        -> runtime candidate/credential binding retires
new daemon id later appears -> new admission may auto-open once
```

If the daemon id cannot objectively distinguish a new admission after disappearance, the worker must return to the
research plan rather than infer it from URL or snapshot revision.

### 3. Managed local backend lifecycle and path-first presentation

The local App daemon receives only an authenticated project-directory intent. It physically canonicalizes and
validates the directory, builds a fixed internal `serve` plan, and owns one child per physical identity. Client-
supplied commands, arguments, ports, process ids, and credentials are forbidden. Start is single-flight across
concurrent Home submissions and restart restoration.

```text
Home submit path
  -> canonicalize physical directory
  -> join existing start/running owner OR spawn fixed managed serve plan
  -> await readiness + admit lease
  -> publish invalidation
  -> App Pulls complete running snapshot
  -> focus exactly one Workspace
```

Closing a project tab changes only presentation. Explicit Task Manager Stop retires the exact managed generation,
settles the child, invalidates the running projection, and closes its Workspace/frame while retaining catalog
history/favorite. Ordinary daemon stop settles all managed children and clears their running intent. Daemon restart
captures the managed directory set, settles children, replaces the daemon, and restores each physical identity
once. Externally owned foreground services are never adopted; Stop is available only through a lease-advertised
owner shutdown protocol.

One pure presentation selector derives title and subtitle:

```text
title     verified github.com remote -> org/repo
          otherwise                  -> canonical directory basename
subtitle current Git branch when available
detail   complete canonical path
evidence backend locator / host / port / raw Git facts
```

Changing remote or branch updates display only. It never changes directory, backend, tab, frame, or mutation
identity.

### 4. Workspace Home and Launcher interaction

The first Workspaces tab is fixed Home and cannot close or reorder. Home owns Favorites, a path-input start form,
Recent, and the `/workspaces/tasks` entry. Workspaces navigation lists every current backend as secondary items;
Task Manager exposes current detail and only ownership-valid Stop/Close/favorite actions.

Home and Task Manager consume one reactive directory-catalog owner shared across same-origin App windows. They do
not take independent local-storage snapshots. Favoriting a running canonical directory that has no prior history
record creates its credential-free catalog entry; only successful daemon admission advances recency.

`HostedShell` keeps orchestration of stable mounted tabs/frames but delegates candidate composition and Dialog UI to
focused modules. The direct Dialog surface is a searchable candidate list.

Row command selection is exhaustive:

```text
open Workspace exists                    Focus
reachable current candidate              Open
checking                                 locked visual activity
authentication-required                  direct failure; no Open
offline                                  direct failure; no Open
unsupported/incompatible                 direct failure; no Open
action pending                           same-size locked control
```

`Connect another backend...` enters the secondary manual URL form inside the Dialog. A successful manual connect
adds one candidate and opens/focuses it. Cancel/back returns to the candidate list without losing search or live
updates. Familiar icon buttons use Lucide icons and tooltips; the primary row command may use icon + text.

### 5. Environment scope and authority

Store route state selects `envUri`, never a backend URL. Selection is credential-free and may persist. With exactly
one current observed Environment, the Stores index may select it automatically. With multiple Environments and no
valid selection, the direct surface asks for an explicit Environment; it never chooses the first.

The Environment authority resolver is a pure selector over complete connection observations. It retains a current
eligible source for stability. When that source retires and no action/draft is pinned, it may choose another current
compatible source inside the same `envUri` through a deterministic stable rule. It must not cross Environment
identity.

Every Store read records its source. Every mutation draft/dialog captures the full authority at creation and uses
the existing synchronous dispatch revalidation. Replacement identity or generation invalidates the authority;
retained UI data remains display-only.

Each compatible source independently settles Store list and Doctor work. If current same-Environment sources then
provide non-equivalent Store identity/root/Doctor evidence, the Environment enters `conflict`. Conflict preserves
the stable source and all source-labelled readonly evidence while disabling mutation authority. It is not rewritten
as offline, unknown, healthy, or an empty Stores surface, and the runtime does not switch read source merely because
a redundant source is checking.

### 6. Store content public contract

The worker extends browser-safe hosted protocol modules without runtime-importing the Node-bearing Core root entry.
A capability such as `stores.content.inspect` advertises the new hosted procedure; it remains a compatibility fact,
not a permission.

The content projection is demand-driven for one selected composite identity:

```text
StoreContentIdentity
├─ envUri
├─ storeId
├─ kind: specs | changes
├─ exact source/generation
└─ protocol version
```

The Server production owner invokes existing `OpenSpecCliContractExecutor.listSpecs({ store })` or
`listChanges({ store })`. It preserves typed data, raw payload/stdout, stderr, diagnostics, contract error, success,
and exit status as separate evidence. Spec and Change regions settle independently and retain previous data during
revalidation.

Store-root observation/invalidation triggers the normal data-free Push -> Pull cycle. No App component starts a
poller, reads files, reparses stdout, or copies Project Web adapters.

### 7. Stores routes and page composition

Canonical routes:

```text
/stores                              selected-Environment index
/stores/environments                 Environment evidence subpage
/stores/$encodedEnvUri/$storeId      Store Detail
```

Route validation decodes both path values through typed helpers and treats `envUri` as opaque. The canonical route
encoding is versioned `v1-<UTF-8 hex>`; route code never dereferences or reconstructs the Environment identity.
Detail loaders/selectors require the complete composite identity. Store id alone must never key a row, cache, route
transition, mutation record selection, or content request.

Store index is a divided list with one responsive container owner. It does not preserve the old Inventory table or
three-tab Store Manager shell. Store Detail uses unframed bands and disclosures; it does not nest cards.

Direct Store Detail order:

1. Store id, Environment, health/current-authority state;
2. blocking diagnostics or mutation failure;
3. currently observed `Root for` and `Referenced by` Workspace relationships;
4. readonly Specs and active Changes summaries;
5. current lifecycle actions and operation activity.

Repository location/Git/metadata facts follow as secondary evidence. Successful Doctor/raw CLI evidence is
collapsed. Failure content is promoted even if its source disclosure is normally collapsed.

The existing setup/register form becomes an index-level `New Store` flow. Unregister and remove live in Store
Detail's overflow/danger flow and remain different operations: unregister retires registry membership but preserves
checkout files, while remove also deletes the checkout. Their destructive Dialog pins exact Environment authority,
cannot close while submitting, and settles only from a Server-ledger record matching the complete
`(requestId, envUri, Store id, kind)` tuple. Git synchronization remains explicit external/manual behavior.

### 8. Navigation and lifecycle preservation

`AppLayout` makes `/workspaces` the root destination, exposes Workspaces and Stores as the only primary nav items,
and keeps Settings at the utility edge. Old product routes are removed rather than redirected.

App-lifetime owners remain mounted above routed content:

```text
launch relay
daemon candidates
connection observations
Store mutation observations
persistent HostedShell / iframe Documents
```

Navigating Workspaces -> Stores -> Workspaces must return the exact same iframe DOM nodes and Documents. Store
route loading or Environment changes cannot clear or reconstruct Workspace surfaces.

### 9. Planned file ownership

Exact filenames may refine during Apply, but ownership must remain physically separated:

| Area                            | Existing/new production owner                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| App route/navigation            | `packages/app/src/app-router.tsx`, `components/app-layout.tsx`                       |
| directory catalog/Home          | focused App state/schema and `components/workspace-home/`                            |
| managed service lifecycle       | focused CLI daemon child owner/control protocol; never `HostedShell`                 |
| running backend/Task Manager    | typed daemon snapshot/control plus focused App route/components                      |
| path-first display facts        | pure shared App selector over project path and typed Git facts                       |
| candidate/open state            | new focused modules under `packages/app/src/lib/`                                    |
| daemon candidate projection     | `components/app-daemon-workspace-owner.tsx` plus focused pure transition module      |
| launcher                        | new `components/workspace-launcher/` folder; `hosted-shell.tsx` only composes it     |
| Environment selection/authority | new focused Environment owner/selectors; retire `store-manager-backend-selector.tsx` |
| browser protocol                | safe Core subpath contracts and checked tests                                        |
| Store content work              | focused Server service/router transport and tests                                    |
| Store index/detail              | new route/component folders; retire Inspector/Inventory/Context Matrix route owners  |
| responsive evidence             | App component browser fixtures at rendered container widths                          |
| product law                     | `cli-commands`, hosted App/Environment specs, AGENTS.md, `i18n.zh.md`, README        |

If `hosted-shell.tsx` would exceed five orthogonal intents after launcher integration, the worker must extract PWA
update/display behavior or tab/frame presentation rather than add another compromise to that file.

## Divergence Notes

Apply exposed four material corrections to the earlier implementation notes:

1. A redundant same-Environment source in `checking` cannot revoke an already-current compatible source. The
   runtime now retains the exact chosen source while valid and resolves deterministically only on replacement.
2. A schema-valid Store-content response is still invalid when its embedded `storeId` differs from the requested
   composite identity. The App transport now rejects it as a hosted contract error.
3. Doctor health is evidence, not lifecycle permission. An unhealthy Store keeps unregister/remove available when
   exact Environment authority and mutation settlement allow it.
4. Official OpenSpec `unregister` preserves checkout files while `remove` deletes them. Store Detail now exposes
   separate confirmation flows and routes both through the same pinned backend mutation ledger. A null dispatch is
   immediate authority retirement; a mismatched request, Environment, Store, or kind cannot close the Dialog.
5. Browser daemon controls are process authority, not ordinary loopback APIs. Managed start/Stop and Workspace Open
   require the bundled local App's exact origin before reaching the daemon owner.
6. Home and Task Manager previously held separate directory snapshots. One reactive catalog owner now synchronizes
   canonical history/favorites within the window and across same-origin windows.

The following are approved consequences of research rather than unimplemented compatibility glue:

- The requested Connections-in-Dialog surface requires candidate/open-state separation; moving the URL form alone
  is insufficient.
- Environment leaves primary navigation but remains the Store registry/authority scope.
- Store Detail adds readonly Spec/active Change summaries because official OpenSpec defines Store as a complete
  selectable root; it does not add editing or a second Project Web.
- The old explicit backend selector is replaced by explicit Environment selection plus internally exact authority;
  this requires a deliberate main-spec update.
- The original presentation-only daemon boundary is superseded for one narrow case: the daemon owns only project
  services explicitly launched from Workspace Home. External foreground `serve` ownership remains unchanged.
- Ports and backend URLs remain transport evidence, while canonical path plus verified GitHub/branch facts become
  the Workspace presentation hierarchy.

Implementation updates this section after every accepted plan change, failed assumption, or material file-owner
change. It must never record planned work as completed evidence.

## Loopback Triggers

Return to `intake.md` and manager decision when:

1. Product evidence suggests Connections or Environment must remain a third top-level domain destination.
2. Store Detail needs editable Specs/Changes, Apply/Archive, or an embedded Project Web rather than readonly
   governance/content overview.
3. The product must merge or compare Store identities across distinct `envUri` values.
4. Directory launch must clone, download, or infer a local path from a GitHub `org/repo` slug.
5. Product requirements demand that daemon stop preserve managed children as orphaned background services.

Return to `research-plan.md` and independent review when:

1. Daemon snapshot identity cannot distinguish unchanged, disappeared/reappeared, and genuinely new Workspace
   admission without protocol expansion.
2. Environment identity does not guarantee one Store registry/data home strongly enough for internal transport
   selection.
3. Same-Environment conflict cannot be detected from objective settled evidence without machine-wide scanning or
   expensive unconditional fan-out.
4. The official CLI cannot provide Store-selected Specs/active Changes through the existing typed executor.
5. Store content invalidation cannot reuse reactive observation/Projection Work without polling.
6. Typed browser contracts require weakening schemas, assertions, suppressed test typechecking, or runtime import of
   the unsafe Core root.
7. Candidate/open-state separation would necessarily remount existing iframe Documents during ordinary route or
   launcher operations.
8. A focused red case does not fail at the named production fixed point, or mutation-resistance evidence shows the
   cleanup transition is masked by another guard.
9. Implementing this Change requires modifying unfinished OpenTray distribution/release ownership from
   `integrate-app-mode-with-opentray` rather than consuming its established boundary.
10. Existing daemon IPC cannot carry authenticated directory start/stop or owner-handled external shutdown without
    widening authority to remote App deployments.
11. Canonical physical directory identity cannot be obtained before child spawn on a supported platform.

Stop before full CI and return to the failed phase whenever its focused review is not green. Stop before final
completion with numbered owner walkthrough cases still pending; automated fixtures cannot close that boundary.
