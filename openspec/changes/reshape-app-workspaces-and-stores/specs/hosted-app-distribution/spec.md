<!--
Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
1. Specify the two-domain App navigation and candidate-backed Workspace Launcher.
2. Specify path-first Workspace Home, managed services, running navigation, Task Manager, and project labels.
3. Specify the product-shaped Store index/detail surface and readonly content boundary.
4. Preserve mounted Workspace continuity and direct lifecycle/error presentation through the redesign.

Original request (2026-07-30): "我个人觉得，左侧只留下 Workspaces + Stores 就行了，你觉得呢？"
Original request (2026-07-30): "Workspaces融合了Connections，点击`+`，那么弹出的Dialog就会包含Connnections列表，而不是一个URL-Input"
Original request (2026-07-30): "我应该如何展示Stores这个界面如果是一个列表，那么StoreDetailPage应该如何设计呢？"
Original request (2026-07-30): "Workspace需要记住曾经打开的目录，并且支持收藏。关键是，支持直接从目录直接启动 openspecui 服务。"
Original request (2026-07-30): "所有正在运行中的backend都会显示在这里。"
Original request (2026-07-30): "任务管理器，打开后，可以看到所有正在运行中backend的详情，并可以杀掉Workspace，或者收藏、取消收藏"
Original request (2026-07-30): "弱化端口这个概念，重点强调 path的概念。"
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

The Workspaces destination SHALL provide one fixed Home tab, path-first running-backend navigation, and a Task
Manager. The local App daemon SHALL manage services started from Home without adopting externally owned foreground
services. Canonical physical directory identity SHALL control duplicate suppression, history, favorites, and
managed-service restoration; backend host or port SHALL NOT be a product identity.

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

#### Scenario: Browse running backends from Workspaces navigation

- **GIVEN** one or more managed or external backends have current daemon leases
- **WHEN** Workspaces navigation expands
- **THEN** its secondary navigation SHALL list every running backend
- **AND** selecting one SHALL focus or open its exact Workspace
- **AND** the list SHALL remain source- and lifecycle-aware without presenting a port as the primary label

#### Scenario: Present a path-first Workspace label

- **GIVEN** a running project exposes objective project-path and Git facts
- **WHEN** its tab or secondary navigation item renders
- **THEN** the title SHALL use a verified GitHub `org/repo` slug when available
- **AND** otherwise SHALL use the canonical project directory basename
- **AND** the subtitle SHALL show the current Git branch when available
- **AND** the complete local path SHALL remain retrievable
- **AND** host, port, locator, and raw Git evidence SHALL remain secondary diagnostics

#### Scenario: Manage running backends

- **WHEN** the user opens `/workspaces/tasks`
- **THEN** Task Manager SHALL list every current backend with project path, display identity, ownership, health,
  start time, lifecycle state, and available commands
- **AND** favorite and unfavorite SHALL operate on canonical directory identity independently of runtime state
- **AND** a managed backend SHALL expose Stop through the daemon child owner
- **AND** an external backend SHALL expose Stop only when its exact current serve lease advertises owner-handled
  shutdown; otherwise it SHALL expose Close Workspace without claiming process termination
- **AND** destructive commands SHALL lock, confirm where data loss is plausible, and retire stale authority

#### Scenario: Close, stop, or restart a managed Workspace

- **GIVEN** a daemon-managed backend has an open Workspace
- **WHEN** the user closes only the project tab
- **THEN** the backend SHALL remain running and listed in Workspaces navigation and Task Manager
- **WHEN** the user explicitly stops the managed backend
- **THEN** the daemon SHALL terminate that owned service and retire its current candidate, Workspace, frame, and
  runtime credential authority while preserving directory history and favorite state
- **WHEN** the App daemon stops
- **THEN** it SHALL terminate only daemon-managed project services and SHALL NOT terminate external serve owners
- **WHEN** the App daemon restarts
- **THEN** it SHALL restore the managed directory set that was running immediately before restart
- **AND** each restored physical directory SHALL converge to at most one backend and Workspace

#### Scenario: Persist favorites and recent directories

- **WHEN** a project directory is successfully admitted or its favorite state changes
- **THEN** the App SHALL persist only canonical credential-free directory identity, favorite state, and recency
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

### Requirement: Daemon-Owned Workspace Projection

The user-level App daemon SHALL own the local App endpoint, Workspace presentation ledger, and only those project
backend processes explicitly started through its local directory-launch capability. Externally invoked foreground
`serve` processes SHALL retain their own process ownership and register current leases. Managed and external
backends SHALL share one typed running-Workspace projection without sharing termination authority.

#### Scenario: A foreground project registers with the daemon

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
