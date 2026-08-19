<!--
Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
1. Specify the two-domain App navigation and candidate-backed Workspace Launcher.
2. Specify path-first Workspace Home, managed services, favorite navigation, observed Running, Task Manager, and project labels.
3. Specify the product-shaped Store index/detail surface and readonly content boundary.
4. Preserve mounted Workspace continuity and direct lifecycle/error presentation through the redesign.

Original request (2026-07-30): "我个人觉得，左侧只留下 Workspaces + Stores 就行了，你觉得呢？"
Original request (2026-07-30): "Workspaces融合了Connections，点击`+`，那么弹出的Dialog就会包含Connnections列表，而不是一个URL-Input"
Original request (2026-07-30): "我应该如何展示Stores这个界面如果是一个列表，那么StoreDetailPage应该如何设计呢？"
Original request (2026-07-30): "Workspace需要记住曾经打开的目录，并且支持收藏。关键是，支持直接从目录直接启动 openspecui 服务。"
Original request (2026-07-30): "所有正在运行中的backend都会显示在这里。"
Original request (2026-07-30): "任务管理器，打开后，可以看到所有正在运行中backend的详情，并可以杀掉Workspace，或者收藏、取消收藏"
Original request (2026-07-30): "弱化端口这个概念，重点强调 path的概念。"
Owner correction (2026-07-31): Favorites replace Running secondary navigation; Running requires Health API plus
WebSocket evidence; external close-only rows expose no Close/Remove/Delete lifecycle action.
Owner correction (2026-07-31): Favorites/Recent persistence belongs to the App daemon backend, never browser storage.
Owner-reported defect (2026-07-31): Tray Quit must fully release the daemon; stale daemon HTML is not JSON evidence.
Owner correction (2026-07-31): "Workspace Home 页面不要有PWA安装，我们现在已经完全废弃pwa这个方向了。请清理干净pwa相关的代码"
Owner correction (2026-07-31): "左侧导航栏顶部这里的 OpenSpecUI App，这里的icon改成我们的 logo。"
-->

# Delta for hosted-app-distribution

## ADDED Requirements

### Requirement: Workspaces And Stores App Information Architecture

The App SHALL expose exactly Workspaces and Stores as primary domain destinations. Settings SHALL remain a
secondary utility destination. Connections and Environment SHALL remain objective system facts presented inside
their owning Workspaces or Stores flows rather than competing top-level destinations.

#### Scenario: Open the App without a product route

- **WHEN** the App opens at its root route
- **THEN** it SHALL navigate to Workspaces
- **AND** primary desktop and mobile navigation SHALL contain Workspaces and Stores
- **AND** Settings SHALL remain visually and semantically secondary
- **AND** Connections and Environment SHALL NOT render as primary navigation destinations

#### Scenario: Move between the two domains

- **GIVEN** one or more Workspace iframe Documents are mounted
- **WHEN** the user navigates from Workspaces to a Stores index or Store Detail and then returns
- **THEN** the App SHALL preserve the exact Workspace tab, iframe DOM, Document, and session identities
- **AND** Stores loading, Environment selection, or Store regional failure SHALL NOT reconstruct the Workspace
  surface

#### Scenario: Address a retired App route

- **WHEN** a caller requests the retired Connections, Environment, Store Inventory, Store Inspector, or Context
  Matrix product route
- **THEN** the App SHALL NOT preserve that route through a compatibility component or redirect
- **AND** the equivalent supported behavior SHALL exist only through Workspaces, Stores, or Store Detail

### Requirement: Candidate-Backed Workspace Launcher

The Workspaces `+` action SHALL open a Workspace Launcher whose direct plane is a searchable list of connection
candidates. A connection candidate and an open Workspace SHALL have separate identity, lifecycle, and persistence
contracts. Manual backend URL entry SHALL remain a secondary escape flow.

#### Scenario: Focus an already-open candidate

- **GIVEN** a candidate already has one open Workspace
- **WHEN** the user chooses that candidate in the launcher
- **THEN** the App SHALL focus the existing Workspace
- **AND** SHALL NOT create another tab, session, frame, or credential binding

#### Scenario: Open a reachable closed candidate

- **GIVEN** a known candidate is current, reachable, compatible, and not open
- **WHEN** the user invokes Open
- **THEN** the row command SHALL lock while the transition is pending
- **AND** exactly one Workspace SHALL open from that candidate
- **AND** the new Workspace SHALL reuse the candidate's current runtime credential only from the existing
  locator-owned memory boundary

#### Scenario: Candidate is unavailable

- **WHEN** a candidate is checking, offline, authentication-required, incompatible, or failed
- **THEN** the launcher SHALL present that concrete state in the direct plane
- **AND** SHALL NOT open a Workspace, fabricate availability, or hide the state only in Tooltip content

#### Scenario: Connect a manually entered backend

- **WHEN** the user chooses `Connect another backend...`
- **THEN** the launcher SHALL enter a secondary backend-locator form
- **AND** a successful submission SHALL retain only credential-free candidate facts and open or focus one Workspace
- **AND** Cancel or Back SHALL return to the live candidate list without discarding its search state

#### Scenario: Daemon candidate arrives and is closed

- **GIVEN** the daemon publishes a genuinely new opaque Workspace binding
- **WHEN** the App admits that binding
- **THEN** it MAY auto-open or focus the corresponding Workspace exactly once
- **WHEN** the user later closes that Workspace while the daemon binding remains
- **THEN** the candidate SHALL remain available in the launcher
- **AND** an unchanged daemon snapshot SHALL NOT reopen it
- **AND** explicit Open SHALL restore one Workspace
- **AND** credentials and daemon snapshots SHALL remain runtime-only

### Requirement: Path-First Workspace Home And Runtime Management

The Workspaces destination SHALL provide one fixed Home tab, direct favorite-directory secondary navigation, and a
Task Manager Dialog. The local App daemon SHALL manage services started from Home without adopting externally owned
foreground services. Canonical physical directory identity SHALL control duplicate suppression, history, favorites,
and managed-service restoration; backend host or port SHALL NOT be a product identity.

#### Scenario: Open the fixed Workspace Home

- **WHEN** Workspaces renders
- **THEN** its first tab SHALL be a fixed, non-closeable, non-reorderable Home surface
- **AND** Home SHALL show favorite project directories at the top
- **AND** SHALL show one path-input launch form in the middle
- **AND** SHALL show successfully opened recent directories below
- **AND** SHALL provide a Task Manager entry
- **AND** project iframe tabs SHALL follow Home without replacing or remounting it

#### Scenario: Start a project from a local directory

- **GIVEN** the bundled local App has current daemon authority
- **WHEN** the user submits a valid local project directory
- **THEN** the form SHALL lock while the daemon canonicalizes and starts the project service
- **AND** exactly one managed backend and Workspace SHALL be associated with that physical directory
- **AND** successful admission SHALL update credential-free recency and focus the Workspace
- **AND** invalid, inaccessible, non-project, or failed startup SHALL remain directly actionable without adding
  history or fabricating a running Workspace
- **AND** a standalone App without local daemon capability SHALL present directory launch as unsupported

#### Scenario: Submit an already managed physical directory

- **GIVEN** another spelling, symlink, or repeated input resolves to a physical directory already managed
- **WHEN** the path form is submitted
- **THEN** the App SHALL focus or restore the existing Workspace
- **AND** SHALL NOT start another backend, allocate another port, or duplicate history identity

#### Scenario: Browse favorites from Workspaces navigation

- **GIVEN** one or more canonical directories are favorites
- **WHEN** Workspaces navigation renders
- **THEN** its secondary navigation SHALL list those favorites directly without a `Running` or `Favorites` accordion
- **AND** selecting one SHALL focus its current Workspace or start it through managed directory authority
- **AND** the list SHALL use canonical path identity without presenting a port or backend locator

#### Scenario: Present a path-first Workspace label

- **GIVEN** a running project exposes objective project-path and Git facts
- **WHEN** its tab or secondary navigation item renders
- **THEN** the title SHALL use a verified GitHub `org/repo` slug when available
- **AND** otherwise SHALL use the canonical project directory basename
- **AND** the subtitle SHALL show the current Git branch when available
- **AND** the complete local path SHALL remain retrievable
- **AND** host, port, locator, and raw Git evidence SHALL remain secondary diagnostics

#### Scenario: Manage running backends

- **WHEN** the user opens the Task Manager Dialog
- **THEN** it SHALL list every current daemon registration with project path, display identity, ownership, observed
  runtime state, start time, lifecycle state, and available commands
- **AND** a backend SHALL be called Running only after a compatible Health API result and an established WebSocket
  subscription for that exact current registration
- **AND** HTTP success without WebSocket SHALL remain non-running and WebSocket loss SHALL retire Running status
- **AND** favorite and unfavorite SHALL operate on canonical directory identity independently of runtime state
- **AND** a managed backend SHALL expose Stop through the daemon child owner
- **AND** an external close-only backend SHALL expose no Close, Remove, Delete, or Stop lifecycle action
- **AND** manual backend Forget or Remove SHALL remain a Workspace Launcher candidate action
- **AND** destructive commands SHALL lock, confirm where data loss is plausible, and retire stale authority

#### Scenario: Close, stop, or restart a managed Workspace

- **GIVEN** a daemon-managed backend has an open Workspace
- **WHEN** the user closes only the project tab
- **THEN** the backend SHALL remain registered and listed in Task Manager
- **AND** Workspaces secondary navigation SHALL continue to depend only on favorite directory state
- **WHEN** the user explicitly stops the managed backend
- **THEN** the daemon SHALL terminate that owned service and retire its current candidate, Workspace, frame, and
  runtime credential authority while preserving directory history and favorite state
- **WHEN** the App daemon stops
- **THEN** it SHALL terminate only daemon-managed project services and SHALL NOT terminate external serve owners
- **WHEN** the App daemon restarts
- **THEN** it SHALL restore the managed directory set that was running immediately before restart
- **AND** each restored physical directory SHALL converge to at most one backend and Workspace

#### Scenario: Persist favorites and recent directories in the daemon

- **WHEN** a managed project directory is successfully ready and admitted or its favorite state changes
- **THEN** the App daemon SHALL atomically persist only canonical credential-free directory identity, favorite state,
  and recency in its user-level catalog
- **AND** a failed managed start SHALL NOT advance recency
- **AND** every App window SHALL consume revisioned replacement snapshots after daemon invalidation
- **AND** browser storage, document state, and storage events SHALL NOT own or converge this catalog
- **AND** favorite ordering SHALL remain independent from running and open state
- **AND** credentials, backend URLs, host, port, private fragments, process ids, and generation authority SHALL NOT
  enter persisted Home state

### Requirement: Product-Shaped Store Index And Detail

The Stores destination SHALL replace Store Inventory, Store Inspector, and Context Matrix with an Environment-
scoped Store index and composite-identity Store Detail. The index SHALL optimize scanning and selection. Store
Detail SHALL provide governance plus readonly OpenSpec content context without duplicating Project Web.

#### Scenario: Scan Stores in an Environment

- **GIVEN** one Environment has a current Store projection
- **WHEN** its Stores index renders
- **THEN** each divided list row SHALL directly show Store identity, current health or failure, currently observed
  Root/Reference usage, and active or failed mutation state
- **AND** checkout path, metadata, Git facts, successful provenance, and raw command evidence SHALL remain secondary
- **AND** crowded, intermediate, and spacious containers SHALL not require horizontal scrolling

#### Scenario: Open Store Detail

- **WHEN** the user opens one Store identified by Environment and Store id
- **THEN** Store Detail SHALL directly answer what the Store is, whether it is currently usable, which connected
  Workspaces currently use or reference it, what Specs and active Changes it contains, and which lifecycle actions
  are currently valid
- **AND** Usage SHALL be labelled and computed as observed-only rather than a machine-wide inverse index
- **AND** same-id Stores in different Environments SHALL remain separate

#### Scenario: Store Detail loads readonly content

- **WHEN** Store Detail requests Spec and active-Change summaries
- **THEN** it SHALL consume typed official CLI list projections with an explicit Store selector
- **AND** Spec and Change regions SHALL settle, retain, fail, and recover independently
- **AND** it SHALL NOT add Spec/Change editing, task mutation, Apply, Archive, or an embedded duplicate Project Web

#### Scenario: Store evidence fails or refreshes

- **GIVEN** Store Detail has retained list, Doctor, Usage, Spec, Change, or mutation evidence
- **WHEN** a replacement region refreshes or fails
- **THEN** unaffected retained regions SHALL remain mounted and readable
- **AND** authority loss, source conflict, diagnostic failure, mutation failure, and content failure SHALL remain
  direct
- **AND** healthy raw CLI evidence MAY remain collapsed
- **AND** retained display evidence SHALL NOT authorize a Store mutation

#### Scenario: Deeper work requires a Workspace

- **WHEN** a user needs to edit or execute normal OPSX work inside a Store
- **THEN** Store Detail SHALL NOT reproduce that workflow
- **AND** an `Open as Workspace` action SHALL exist only when a real daemon or backend production owner can focus or
  establish that Workspace through a canonical managed directory or exact current external lease

## MODIFIED Requirements

### Requirement: App Workspace And Distribution

The App SHALL build one persistent Browser/OpenTray Workspaces shell. The build SHALL emit `index.html` and hashed
App assets only; installable-app metadata and service-worker files are retired. A normal Browser Web deployment SHALL
remain a regular web document without an install prompt, manifest, background cache owner, or PWA update flow.

#### Scenario: Build the App shell

- **WHEN** the App workspace is built
- **THEN** it SHALL emit a root `index.html` and hashed App assets
- **AND** it SHALL NOT emit `manifest.webmanifest`, `service-worker.js`, or PWA icon assets
- **AND** the shell SHALL continue to own Workspace restoration, backend probing, and initial-Workspace admission

#### Scenario: Browser Web host has no install surface

- **WHEN** a Browser Web document receives a browser install-prompt event
- **THEN** the App SHALL ignore that event
- **AND** Workspace Home SHALL render no install command or install state

#### Scenario: Package the authoritative local shell

- **WHEN** the publishable CLI package is built
- **THEN** it SHALL include the App output produced by that same source release
- **AND** the user-level App daemon SHALL serve those assets from a loopback endpoint
- **AND** the daemon SHALL NOT select or depend on an external App deployment

#### Scenario: Deploy the App independently

- **WHEN** an operator deploys the App output as a static browser surface
- **THEN** the package README SHALL document static-host cache and SPA-fallback requirements
- **AND** that deployment MAY accept a manually supplied backend launch parameter
- **AND** the CLI SHALL NOT expose a setting or URL-valued flag that selects that deployment

#### Scenario: Open an initial standalone Workspace

- **GIVEN** a standalone App deployment
- **WHEN** the shell loads with a valid `api` query parameter
- **THEN** it SHALL create or activate a Workspace for that backend service
- **AND** it SHALL query backend health for embedding metadata
- **AND** it SHALL render the Workspace without discarding the shell itself

### Requirement: OpenTray And Browser Presentation

The daemon SHALL present the same bundled App shell through an exclusive native OpenTray or Browser host without
changing project Server ownership. PWA roles, launch handlers, and PWA overlay titlebar geometry are retired.

#### Scenario: Native OpenTray retains one App window

- **GIVEN** native presentation is supported
- **WHEN** the daemon starts in native mode
- **THEN** it SHALL create one retained OpenTray WebView with `style.appMode: true`
- **AND** only the first `show()` SHALL supply bootstrap geometry, style, and native capability
- **AND** later activation SHALL reveal and focus the retained window

#### Scenario: Web mode isolates the native extension

- **WHEN** the daemon starts in Web mode or native presentation is unsupported
- **THEN** it SHALL preserve a Browser-capable App result
- **AND** it SHALL NOT import, initialize, or probe the native WebView extension

#### Scenario: Browser host uses browser-only launch ownership

- **WHEN** the App runs in an ordinary Browser Web document
- **THEN** cross-window launch relay SHALL use Browser ownership only
- **AND** it SHALL not detect standalone/display-mode installation or consume a Web App Launch Handler queue

#### Scenario: Exactly one titlebar owner is active

- **WHEN** the App runs in Browser Web, OpenTray overlay, or native frame mode
- **THEN** exactly one Browser/OpenTray/native-frame presentation owner SHALL write titlebar inset geometry
- **AND** PWA overlay geometry SHALL not participate in that state machine

### Requirement: Daemon-Owned Workspace Projection

The user-level App daemon SHALL own the local App endpoint, Workspace presentation ledger, and only those project
backend processes explicitly started through its local directory-launch capability. Externally invoked foreground
`serve` processes SHALL retain their own process ownership and register current leases. Managed and external
backends SHALL share one typed running-Workspace projection without sharing termination authority.

#### Scenario: A project registers with the daemon

- **GIVEN** an external foreground `serve` process owns a ready project backend
- **WHEN** it registers a Workspace lease with the daemon
- **THEN** the daemon SHALL publish an invalidation notice
- **AND** the App SHALL Pull a replacement typed Workspace snapshot
- **AND** the lease SHALL preserve external process ownership and MAY advertise owner-handled shutdown capability
- **AND** credentials SHALL remain runtime-only and SHALL NOT enter persisted Workspace state

#### Scenario: Home starts a managed project

- **WHEN** the authenticated local App control submits a canonical project directory
- **THEN** the daemon SHALL start and supervise one backend child for that physical directory
- **AND** SHALL publish its managed ownership and lifecycle through the same Workspace snapshot contract
- **AND** SHALL reject remote callers, arbitrary command vectors, non-directory targets, and duplicate physical
  directory ownership

#### Scenario: Open a Workspace in the system browser

- **WHEN** a Workspace tab invokes Open in browser
- **THEN** the App SHALL submit only its opaque Workspace id
- **AND** the daemon SHALL resolve the current backend and runtime credential
- **AND** arbitrary page-supplied URLs SHALL be rejected

#### Scenario: Daemon restarts while backends remain live

- **WHEN** the App daemon restarts
- **THEN** external `serve` leases SHALL re-register after the replacement daemon is ready
- **AND** the daemon SHALL restore only its recorded pre-restart managed directory set
- **AND** SHALL NOT adopt an external backend or combine a restored managed generation with stale authority

#### Scenario: Daemon stops without replacement

- **WHEN** the App daemon stops
- **THEN** it SHALL terminate and settle every daemon-managed backend child before releasing its endpoint
- **AND** SHALL NOT terminate externally owned foreground `serve` processes

#### Scenario: Quit from the system tray

- **WHEN** the user invokes Quit from the App tray
- **THEN** it SHALL execute the same daemon Stop ownership transition
- **AND** a pending or failed presentation RPC SHALL NOT prevent App HTTP, managed children, WebView, tray, or IPC
  authority from being released
- **AND** every third-party presentation teardown step SHALL be bounded so later resource owners still settle

#### Scenario: App shell meets an older daemon control surface

- **WHEN** a required same-origin daemon API returns HTML or a payload outside the current control contract
- **THEN** the App SHALL present one explicit daemon-restart requirement
- **AND** it SHALL NOT expose the raw parser failure or advertise unsupported managed controls
- **AND** one offline Workspace SHALL render one coherent recovery state rather than simultaneous offline and waiting
  claims

## REMOVED Requirements

### Requirement: PWA Shell Updates

The PWA lifecycle (service-worker registration, shell update detection, and apply-update flow) is fully retired
with the 6.1.0 PWA removal; the Browser document and OpenTray native host own shell refresh instead.
