<!--
Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
1. Record official OpenSpec Store facts and current App ownership constraints that bound the redesign.
2. Tell the Workspaces/Stores product story before deriving routes, protocols, state owners, and implementation slices.
3. Define path-first Workspace launch/runtime management and Environment-scoped Store interaction.
4. Define the Store readonly content boundary, risks, verification, and final owner acceptance.

Original request (2026-07-30): "左侧只留下 Workspaces + Stores。"
Original request (2026-07-30): "Workspaces融合了Connections，点击`+`，那么弹出的Dialog就会包含Connnections列表，而不是一个URL-Input"
Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西，就跟 Config 和 Context 的关系一样。"
Original request (2026-07-30): "Workspace需要记住曾经打开的目录，并且支持收藏。关键是，支持直接从目录直接启动 openspecui 服务。"
Original request (2026-07-30): "所有正在运行中的backend都会显示在这里。"
Original request (2026-07-30): "任务管理器，打开后，可以看到所有正在运行中backend的详情，并可以杀掉Workspace，或者收藏、取消收藏"
Original request (2026-07-30): "弱化端口这个概念，重点强调 path的概念。"
Original request (2026-07-30): "Tab这里默认写仓库路径 org/repo，如果没有就使用path的foldername；subtitle写git分支名"
Owner correction (2026-07-31): Favorites replace Running secondary navigation; daemon registration is not Running
without compatible Health API and established WebSocket evidence; external close-only rows expose no fake action.
Owner correction (2026-07-31): Favorites/Recent persistence belongs to the App daemon backend, never browser storage.
Owner correction (2026-07-31): PWA is fully retired and the sidebar `OpenSpecUI App` brand uses the product logo.
-->

## Research Findings

### 1. Official OpenSpec facts

The official `references/openspec` checkout at `v1.6.0` defines a Store as a standalone OpenSpec repository
registered in the current machine/user Store registry. It is not a remote service, Workspace tab, or UI-only
collection.

```text
effective OpenSpec data home
└─ Store registry
   ├─ team-context  -> /checkouts/team-context
   └─ design-system -> /checkouts/design-system

normal OPSX command + --store <id>
                     │
                     ▼
             selected OpenSpec root
```

Objective command facts:

- `store list --json` returns registered Store identity and checkout location.
- `store doctor [id] --json` returns identity, OpenSpec-root structure/health, metadata, Git facts, and typed
  diagnostics.
- `store setup`, `register`, `unregister`, and `remove` own Store lifecycle mutation semantics.
- Normal `list --specs|--changes --store <id> --json` commands enumerate a Store's Specs or active Changes.
- Store selection applies to the normal OPSX workflow. There is no separate Store workflow or Store-specific
  content parser to reproduce in the App.
- The registry belongs to the effective data home. Consequently, Store id is unique inside one runtime
  Environment, not globally across every Environment observed by the App.

### 2. Current App navigation is projection-shaped

`packages/app/src/components/app-layout.tsx` currently exposes three primary destinations:

```text
Connections    persisted backend-locator projection
Environment    envUri grouping projection
Workspaces     mounted project iframe projection
```

Store administration is then nested under Environment as three more projection-oriented destinations:

```text
Store Manager
├─ Inspector
├─ Context Matrix
└─ Inventory
```

These names describe data acquisition or inspection mechanics rather than the user's two durable tasks: enter a
project Workspace or understand/manage a Store.

### 3. Connections and open Workspaces currently share one physical state

`HostedShellState.tabs` is persisted as a credential-free locator list and rendered directly as the open Workspace
tab set. `ConnectionsRoute` reads the same collection, while `HostedShell` mutates and renders it. The existing
Add dialog accepts only a backend URL.

The App daemon adds another constraint: `AppDaemonWorkspaceOwner` currently consumes every daemon Workspace
snapshot and immediately calls `applyHostedLaunchRequest`, which opens/focuses every daemon binding as a tab.
Therefore a useful launcher cannot be produced by merely moving the existing URL field into a larger Dialog.

The model must distinguish:

```text
Connection candidate                         Open Workspace
────────────────────                         ──────────────
Can be daemon-live or manually retained  ->  Has tab/session/frame identity
May be closed                                Is mounted in HostedShell
Credential-free if persisted                 Credential remains locator-bound memory
Can explain unavailable state                Owns active/focus/close presentation
```

New daemon launch admission still needs to open/focus its Workspace automatically. Closing that tab retains an
eligible candidate while suppressing reopening from an unchanged daemon snapshot. A genuinely new daemon binding
may open again.

### 4. Environment identity is already authoritative, but selection leaks backend transport

The Server publishes opaque `envUri` from stable host identity plus effective OpenSpec data home. The App already
groups online project observations by that value and never reconstructs it from a URL or path.

Store views currently use `activeTabId` and expose a backend URL selector. This is safe for exact generation-bound
mutation authority, but it leaks a transport detail into the normal Store product flow. A selected Environment can
own a deterministic internal access authority because all current compatible backends carrying the same `envUri`
address the same Store registry/data home. The exact tab/session/generation must still be captured and revalidated
at dispatch.

This intentionally modifies the current rule that the user must select one backend tab. The new rule is:

```text
User selects Environment
        │
        ▼
Environment authority owner
├─ retains one exact current source while valid
├─ resolves another eligible current source when no action draft is pinned
├─ pins exact authority when an action/dialog begins
├─ retires the draft if that authority changes
└─ exposes disagreement instead of silently merging conflicting observations
```

Multiple current sources are transport redundancy, not multiple Environment choices. Missing compatible sources,
authentication rejection, pending replacement, and source disagreement remain distinct direct-plane states.

### 5. Existing typed contracts can support Store content, but no hosted content projection exists

Core already has strong CLI schemas and executor calls for Store list/Doctor plus normal Spec/Change listing with
an explicit Store selector. Store Projection Work already preserves raw payload/stdout, stderr, diagnostics,
contract drift, success, exit status, retained data, and Push -> Pull invalidation.

The hosted browser contract currently publishes Store list and Doctor only. Store Detail content therefore needs
an additive browser-safe compatibility fact and typed hosted projection for:

```text
(envUri, Store id, content kind: specs | changes)
```

The Server must execute the official CLI contract with the Store selector; the App must never call Project Web
adapters, parse files, or reparse stdout. Content work should start only for the selected Store Detail, avoiding a
fan-out across every Store row.

### 6. Existing realtime and security laws remain applicable

- Credentials and daemon Workspace snapshots remain runtime-only.
- A capability is a compatibility fact, not authorization.
- Retained data may remain visible during refresh but cannot authorize a Store action.
- Store mutation lifecycle remains Server-owned (`accepted -> running -> terminal`).
- Environment/Root/Reference evidence is observed-only, source-labelled, and never a machine-wide inverse index.
- Errors and blockers remain in the direct visual plane; healthy raw evidence may be collapsed.
- The App shell must preserve mounted Workspace iframe Documents across navigation.
- Final end-to-end browser walkthrough and acceptance remain owner-only.

### 7. Active Change relationship

`integrate-app-mode-with-opentray` is still active. Its completed daemon ledger, retained Workspaces shell,
Open-in-browser action, and titlebar host geometry are prerequisites, not redesign targets. This Change may replace
App navigation and Workspace presentation state after those owners, but must not absorb remaining release,
OpenTray distribution, or owner-walkthrough checkpoints from that Change.

### 8. Directory launch deliberately changes daemon ownership

Current main law says the App daemon owns only presentation and never owns a project backend. Current `start`,
`stop`, and `restart` commands are also explicitly project-free. The approved directory-launch interaction cannot
be implemented as a frontend-only shortcut: some production owner must create, observe, stop, and restore the
backend process.

The corrected ownership model is asymmetric rather than globally supervisory:

```text
external `openspecui serve /project`       App Home submits `/project`
───────────────────────────────────       ───────────────────────────
foreground CLI owns Server                App daemon owns one managed child
registers current serve lease             keys it by canonical physical directory
may advertise owner-handled Stop          stops it explicitly or during daemon teardown
re-registers after daemon replacement     restores it only during daemon restart
```

The daemon never discovers, adopts, or signals a process by path, port, URL, or PID inference. A foreground `serve`
lease records external ownership but does not prove runtime reachability. Task Manager independently verifies the
Health API and establishes a WebSocket subscription before presenting Running. Until an exact callable owner-
shutdown channel exists, an external row exposes no lifecycle action: presentation Close is unrelated to backend
lifecycle, while Remove/Delete would hide a backend that objectively remains registered.

Workspace identity and presentation also need a path-first hierarchy. Server health already carries project path,
while Git repository facts can objectively derive a GitHub `org/repo` slug and current branch. The slug is display
metadata, not a clone target or filesystem identity. Canonical physical directory remains the durable local identity;
host and port remain internal locator/diagnostic facts.

### 9. PWA is a cross-layer product capability, not a Home button

The retired install button was backed by four independent owners: `beforeinstallprompt` state in `HostedShell`,
service-worker registration/update UI, manifest/cache build outputs, and PWA-specific launch/titlebar roles. Hiding
only the button would leave browser cache authority, obsolete build artifacts, and a second presentation state
machine active. The correction therefore removes all four while preserving two current hosts:

```text
Browser Web host         retained: normal document + browser-only cross-window launch relay
OpenTray native host     retained: native overlay geometry + drag + branded titlebar
PWA installation         retired: manifest + prompt + service worker + cache/update
PWA presentation role    retired: standalone priority + Launch Handler + pwa-overlay
```

The existing `/icon.svg` is already the canonical App/native brand source, so the sidebar reuses it rather than
introducing another glyph or asset owner.

## Decision & Plan (For Approval)

The manager approved this direction during intake. Implementation follows the product story below and then derives
the minimum architecture required to make that story true.

### Product story A: enter or return to project work

```text
Open App
  │
  └─ Workspaces
      ├─ fixed Home tab
      │   ├─ Favorites
      │   ├─ path input -> start/focus one managed backend
      │   ├─ Recent directories
      │   └─ Task Manager -> all running backend detail/actions
      ├─ secondary navigation -> favorite canonical directories
      ├─ project tabs -> org/repo | folder name + branch subtitle
      └─ press + -> connection candidate launcher
          ├─ Open now
          ├─ Focus
          ├─ Unavailable
          └─ Connect another backend... -> secondary URL form
```

Home is the repeat-use entry, while `+` remains the heterogeneous connection escape hatch. Favorites and Recent are
canonical directory records, not backend locators or open tabs. A successful path launch updates recency; favorite
state survives Stop and tab closure. Closing a project tab does not stop a managed service. Task Manager owns exact
managed Stop and independent Health+WebSocket observation; external close-only registrations expose evidence and
favorite state but no fake lifecycle command.

The launcher direct plane remains a searchable candidate list, not a URL form. Each candidate row contains
path-first project identity, Environment when known, objective connection state, and one deterministic command.
Removal/forget actions live in the row menu. Opening and connecting buttons lock while pending.

### Product story B: understand and govern Stores

```text
Stores
  │
  ├─ choose Environment (required when ambiguous)
  │    └─ Environments action -> connected projects / CLI / capability evidence
  │
  ├─ scan/search Store rows
  │    └─ identity + health + observed usage + active/failed operation
  │
  └─ open Store Detail
       ├─ direct failure / current usability
       ├─ Usage: Root for / Referenced by connected Workspaces
       ├─ Contents: Specs / active Changes readonly summary
       ├─ Repository: root / metadata / Git facts
       ├─ lifecycle actions
       └─ collapsed healthy diagnostics and raw CLI evidence
```

The Store index replaces Inventory. Store Detail replaces Inspector. Usage replaces Context Matrix. These retired
names do not survive as sibling navigation or compatibility routes.

### Route and navigation topology

```text
/
└─ redirect -> /workspaces

/workspaces
├─ fixed Home + persistent project frames
├─ /tasks
└─ Workspace Launcher

/stores
├─ Environment-scoped Store index
├─ /environments
└─ /$encodedEnvUri/$storeId

/settings
└─ secondary utility route
```

The canonical Store Detail identity contains both opaque Environment identity and Store id. Route handling treats
`envUri` as an opaque encoded value and never parses it as a dereferenceable URL. Static Store child segments take
precedence over dynamic detail matching.

### Store index information hierarchy

Direct plane, in order:

1. selected Environment and whether a current compatible source exists;
2. Store id and CLI-derived health/failure;
3. currently observed `Root for` / `Referenced by` summary;
4. active, failed, or indeterminate Store mutation;
5. search, health filter, and Store setup/register action.

Secondary plane:

- checkout path, metadata path, Git remote/state;
- CLI version, observation source/time, successful Doctor evidence;
- raw typed command envelope.

Rows use dividers and stable list geometry rather than nested cards. Mobile renders one readable column. Wider
containers add aligned facts without changing the route or introducing horizontal overflow.

### Store Detail information hierarchy

```text
Store id + health + Environment                          direct
blocking diagnostics / unavailable authority             direct when present
currently observed Workspace usage                       direct
Specs and active Changes readonly summaries               direct
valid lifecycle action / pending mutation                 direct
checkout / metadata / Git                                secondary
successful Doctor and raw CLI envelope                    collapsed evidence
```

Content is deliberately bounded:

- list Specs with requirement counts;
- list active Changes with task progress/status and last modification;
- do not expose editing, Apply, Archive, task mutation, or an embedded duplicate Project Web;
- expose `Open as Workspace` only through a real daemon/backend owner capable of focusing or establishing the
  corresponding Workspace. Until that capability exists, omit the action rather than render a disabled promise.

### Architecture slices

1. **Law and public contract**
   - Update `cli-commands`, `hosted-app-distribution`, and `hosted-environment-delivery` before product code.
   - Replace the absolute no-supervision rule with explicit managed-child versus external-lease ownership.
   - Replace backend-tab selection language with Environment selection plus internally exact authority.
   - Add browser-safe Store-content compatibility and typed projection contracts without weakening existing CLI
     schemas.

2. **Managed local service owner and directory catalog**
   - Add authenticated daemon control for canonical directory start/stop and exact managed ownership.
   - Persist canonical credential-free favorites and successful recency in the daemon user's
     `$OPENSPECUI_HOME/workspace-directory-catalog.json`; App windows receive replacement snapshots through
     invalidation Push -> Pull and never use browser storage for this catalog.
   - Keep daemon stop and restart distinct: stop clears managed services; restart snapshots and restores its managed
     running set. External foreground serve processes remain untouched.
   - Extend exact serve leases with optional owner-handled shutdown rather than signaling inferred processes.

3. **Workspace candidate/open-state separation**
   - Introduce a pure candidate/open-Workspace state model with different identities and persistence laws.
   - Project daemon snapshot bindings as runtime candidates while preserving first admission auto-open/focus.
   - Retain manual credential-free connection candidates separately from mounted Workspace tab/session/frame state.
   - Make closing, reopening, duplicate suppression, daemon disappearance/reappearance, and cross-window
     convergence explicit transitions.

4. **Workspace Home, favorite navigation, Task Manager, and Launcher**
   - Make Home a fixed first tab with Favorites, path form, Recent, and Task Manager entry.
   - Project Favorites directly into Workspaces secondary navigation without a section accordion.
   - Project every current lease into Task Manager, but call it Running only after compatible Health API and an
     established WebSocket subscription.
   - Derive tab/nav title from verified GitHub `org/repo` or folder basename and subtitle from branch; keep full path
     available and port diagnostic-only.
   - Extract the current Add-API form from `HostedShell` into a feature-complete launcher Dialog.
   - Compose daemon, retained manual, observation, and open-Workspace facts through a pure selector.
   - Keep the URL form as a secondary nested flow and preserve loading/error focus behavior.

5. **Environment scope and authority**
   - Replace `activeTabId` as the Store product selector with a persisted credential-free `envUri` selection.
   - Add a pure Environment authority resolver over current connection observations.
   - Pin full tab/session/creation/generation identity for every draft/destructive Dialog and revalidate it at
     dispatch. Never persist that authority.
   - Compare already-observed same-Environment facts and surface source conflict without inventing merged truth.

6. **Store content projection**
   - Add demand-driven Server Projection Work for typed Spec/Change lists under an explicit Store selector.
   - Publish data-free invalidation notices and typed Pull state through the hosted REST/tRPC boundary.
   - Key retained work by source Environment, Store id, content kind, authority generation, and protocol version;
     keep Spec and Change regional failures independent.

7. **Stores product routes**
   - Replace current Store Manager shell and three route views with index, Environment evidence, and detail routes.
   - Reuse existing Doctor, mutation ledger, Root/Reference evidence, realtime primitives, and destructive Dialog
     owners instead of cloning their behavior into page components.
   - Use a route-level Store selector only for display identity; every current read/action resolves through the
     Environment owner.

8. **Navigation and retirement**
   - Reduce persistent App navigation to Workspaces and Stores; keep Settings secondary.
   - Retire Connections/Environment/Inspector/Inventory/Context Matrix routes and tests in the same slice.
   - Retire PWA install/update/build/launch/titlebar owners and keep Browser/OpenTray hosts explicit.
   - Preserve App-lifetime launch, daemon, connection observation, mutation observation, and iframe owners above
     routed content.

9. **Documentation and handoff**
   - Update README/product terminology, AGENTS.md, `i18n.zh.md`, specs, and affected public API comments.
   - Produce numbered production-boundary owner walkthrough cases with setup, trigger, observation, and restore
     steps. Do not record credentials or private fragments.

## Capability Impact

### New or Expanded Behavior

- Workspace Launcher with connection candidate, focus/open, unavailable, and secondary manual-connect flows.
- Fixed Workspace Home with Favorites, path launch, Recent, and Task Manager.
- Canonical directory catalog and daemon-managed local project service lifecycle.
- Direct favorite secondary navigation plus path-first Task Manager/tab GitHub/folder and branch labels.
- Exact owner-handled external Stop capability without daemon process adoption.
- Separate candidate and open-Workspace state/projection ownership.
- Environment-selected Store index and composite Environment/Store detail identity.
- Automatic internal Store access-authority selection with exact dispatch-time pinning.
- Readonly Store Specs/active Changes summaries from official typed CLI selection.
- Direct observed Workspace usage inside Store Detail.
- Explicit same-Environment source-conflict presentation.

### Modified Behavior

- App home changes from Connections to Workspaces.
- Connections becomes an indirect Workspace-launcher concern rather than a route.
- Environment becomes Store scope/evidence rather than a route-level peer.
- Store Inventory, Inspector, and Context Matrix become index/detail sections rather than sibling tabs.
- Store selection changes from a backend URL/tab UI to an Environment UI while preserving exact internal
  authority.
- Existing daemon bindings become launcher candidates in addition to first-admission Workspace launch intents.
- The App daemon changes from presentation-only to the exclusive owner of project services launched through Home;
  external foreground `serve` ownership remains unchanged.
- Workspace primary identity changes from backend locator/port presentation to canonical directory identity with
  objective Git display metadata.
- Store content compatibility becomes an explicit hosted protocol fact.

## Risks and Mitigations

| Risk                                                                  | Mitigation                                                                                                                                |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Splitting current `tabs` state reloads or duplicates iframe Documents | Define reducer-level red tests first; keep frame identity owned by stable open-Workspace ids and mount owner.                             |
| Unchanged daemon snapshots reopen a user-closed Workspace             | Track runtime candidate admission/dismissal by opaque daemon Workspace id; reopen only for explicit selection or genuinely new admission. |
| Manual connection persistence accidentally captures credentials       | Persist only normalized locator and display metadata; credential binding stays in the existing memory owner.                              |
| Removing backend selection weakens mutation targeting                 | Environment owner pins one exact full authority for the action lifecycle and synchronously revalidates before dispatch.                   |
| Same `envUri` sources disagree                                        | Keep source-labelled snapshots separate, promote conflict, disable affected mutations, and never choose conflicting evidence silently.    |
| Same Store id exists in multiple Environments                         | Use composite route/state keys everywhere; never key a Store row, cache, mutation, or content request by Store id alone.                  |
| Store detail creates N x Store content fan-out                        | Fetch Specs/Changes only for the selected detail; list rows use list/Doctor/Context projections already available.                        |
| Content projection forks OPSX semantics                               | Call existing typed `listSpecs/listChanges({ store })`; never parse files or stdout.                                                      |
| Readonly detail grows into a second Project Web                       | Exclude mutation/edit/Apply/Archive; require a real Workspace transition capability for deeper work.                                      |
| Route removal strands stale bookmarks/local state                     | This is an intentional breaking App IA update; retire old routes and state rather than add compatibility glue.                            |
| New work overlaps unfinished OpenTray Change                          | Treat daemon ledger/titlebar as upstream prerequisites and leave its remaining delivery/acceptance checkpoints untouched.                 |
| Responsive Store evidence becomes a desktop table                     | Verify container widths directly; use stacked/aligned list topology with no horizontal scroll.                                            |
| Canonical-path aliases start duplicate managed Servers                | Resolve physical identity before spawn; key in-flight/running/restoration state by that identity and mutation-test the gate.              |
| Daemon restart or crash leaks managed children                        | One child owner records exact state, settles teardown, and distinguishes restart restoration from ordinary stop/crash recovery.           |
| Task Manager fabricates external lifecycle authority                  | Keep external ownership as evidence; expose no Close/Remove/Delete/Stop until an exact callable shutdown channel exists.                  |
| Favorites/history leak credentials or transient runtime facts         | Persist only canonical path, favorite, and recency through a runtime-validated versioned schema.                                          |
| Git remote/branch changes destabilize Workspace identity              | Use Git facts only for display; canonical physical directory and opaque Workspace generation remain authoritative.                        |
| Favorite navigation and tabs become redundant port lists              | Use canonical path for favorites and path-first tab labels; keep host/port diagnostic-only.                                               |

## Verification Strategy

### Focused red/green evidence

Each implementation slice names one production owner, one precise pre-fix red case, and one green case. Focused
review must pass before full gates.

1. **Managed service and directory catalog owner**
   - Red: repeated/symlink path submissions start duplicate children, daemon stop kills external serve, or restart
     loses/duplicates the managed running set.
   - Green: one physical path has one managed owner, Stop affects only owned children, restart restores exactly
     once, and favorites/history contain no runtime authority.
2. **Workspace state owner**
   - Red: closing a daemon-opened Workspace and receiving the unchanged snapshot reopens it, or candidates and
     mounted tabs remain the same collection.
   - Green: candidate remains selectable, iframe stays closed, explicit Open restores one tab, and a genuinely new
     daemon id auto-opens once.
3. **Workspace Home and Task Manager owner**
   - Red: first tab is closeable, path launch has no current daemon authority, ports dominate labels, or Task
     Manager offers process Stop without lifecycle ownership.
   - Green: fixed Home topology, running nav, capability-exact actions, GitHub/folder title, branch subtitle, and
     path evidence remain coherent across narrow and wide containers.
4. **Workspace Launcher owner**
   - Red: `+` renders URL input as the direct surface or creates a duplicate for an already-open candidate.
   - Green: launcher renders Focus/Open/unavailable outcomes and secondary manual connect with loading locks.
5. **Environment authority owner**
   - Red: Store read/mutation follows global active tab, first online locator, stale generation, or same-id
     replacement.
   - Green: selected Environment resolves/pins exact current authority; conflict/missing authority disables action
     with direct evidence.
6. **Store content projection owner**
   - Red: selected Store detail cannot obtain typed content, or a different Store/environment result enters its
     retained state.
   - Green: explicit Store selector produces independent retained Spec/Change regions with raw typed evidence.
7. **Stores route presentation owner**
   - Red: same-id Stores collapse, errors hide in Tooltip/Accordion, or narrow containers overflow.
   - Green: composite identity, direct failure, observed-only Usage, readonly Contents, and narrow/intermediate/
     spacious container topology remain correct.
8. **Router/App shell owner**
   - Red: retired routes remain primary, Workspace iframe remounts on Stores navigation, or Settings becomes a
     third domain destination.
   - Green: only Workspaces/Stores are primary and route round-trips preserve the exact iframe DOM identity.

Tests proving public hosted schemas, Router types, Manager/Service owners, or CLI boundaries must compile in a
checked test lane without `any`, `as any`, `as never`, fabricated non-null assertions, or suppression comments.
Lifecycle cleanup tests must include mutation-resistance evidence for the exact dismissed/retired transition.

### Local gates

Run focused package tests after each slice, then the repository CI-equivalent gates:

```text
pnpm format:check
pnpm lint:ci
pnpm typecheck
pnpm test:ci
pnpm test:browser:ci
git diff --check
openspec validate reshape-app-workspaces-and-stores --strict
```

Package-local component browser fixtures verify launcher and container topology only. They are preparation evidence,
not final browser acceptance.

### Owner walkthrough boundary

The final handoff supplies numbered cases covering:

1. fixed Home topology, favorite/recent persistence, and canonical-path duplicate suppression;
2. managed directory start, tab close without Stop, explicit Stop, daemon stop isolation, and restart restoration;
3. favorite navigation, Health+WebSocket Running evidence, Task Manager ownership/action states, and path-first labels;
4. initial external daemon Workspace auto-open and close/reopen through the launcher;
5. manual connection secondary flow without credential persistence;
6. multiple Environments and same Store id isolation;
7. Store Detail Usage/Contents/diagnostics under retained refresh and regional failure;
8. authority retirement during a destructive action;
9. narrow/mobile, intermediate, and spacious Workspace/Store containers;
10. Workspaces -> Stores -> Workspaces iframe continuity.

Each case records exact setup, trigger, PASS/FAIL observations, restore commands, and the tested commit head. The
owner performs and accepts this final walkthrough.
