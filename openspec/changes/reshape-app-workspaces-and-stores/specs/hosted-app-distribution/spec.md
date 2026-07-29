<!--
Orthogonal intents (created 2026-07-30 Asia/Shanghai):
1. Specify the two-domain App navigation and candidate-backed Workspace Launcher.
2. Specify the product-shaped Store index/detail surface and readonly content boundary.
3. Preserve mounted Workspace continuity and direct lifecycle/error presentation through the redesign.

Original request (2026-07-30): "我个人觉得，左侧只留下 Workspaces + Stores 就行了，你觉得呢？"
Original request (2026-07-30): "Workspaces融合了Connections，点击`+`，那么弹出的Dialog就会包含Connnections列表，而不是一个URL-Input"
Original request (2026-07-30): "我应该如何展示Stores这个界面如果是一个列表，那么StoreDetailPage应该如何设计呢？"
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
  establish that Workspace without making the daemon supervise project backend processes
