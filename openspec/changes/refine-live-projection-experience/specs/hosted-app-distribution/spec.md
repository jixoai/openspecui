<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Admit App Store and Root projections without waiting for the first lifecycle notice.
2. Distinguish unresolved App observations from authoritative empty conclusions.
3. Preserve stateful project iframe Documents across ordinary App route transitions.
4. Make embedded authentication and capability delegation explicit before Project Web starts.
5. Preserve session and Inspector continuity within narrow App viewports.

Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）"
Original request (2026-07-27): "iframe 需要明确声明支持一些 permission，否则会有一些功能上被限制。"
Original request (2026-07-27): "移动端模式下 Inspector 横向溢出了；sessions 纵向溢出了。"
-->

# Delta for Hosted App Distribution

## ADDED Requirements

### Requirement: Hosted Projection And Session Continuity

The hosted App SHALL perform one typed Pull for each selected Store and Root projection when its owner is
admitted, without waiting for a WebSocket lifecycle notice. It SHALL retain stateful hosted project iframe
Documents across ordinary App route transitions.

#### Scenario: An App projection mounts before its first notice

- **GIVEN** Store list, Store Doctor, or Root Context has a typed Server projection state
- **AND** the App lifecycle subscription has not emitted its first notice
- **WHEN** the corresponding App owner is mounted or rebound to a current backend locator
- **THEN** the App SHALL immediately perform a typed Pull for that locator
- **AND** SHALL preserve locator, identity, generation, freshness, and current versus display-only authority

#### Scenario: App observation remains unresolved

- **GIVEN** one or more configured backend observations are still checking or loading
- **WHEN** Environment, Store Inventory, Store Inspector, or Context Matrix has no settled data
- **THEN** the App SHALL render an unresolved lifecycle surface rather than an authoritative empty conclusion
- **AND** SHALL retain already-settled sibling rows while only the affected region updates

#### Scenario: A user leaves and returns to Sessions

- **GIVEN** a hosted project iframe Document is mounted in Sessions
- **WHEN** the user navigates to another App route and later returns to Sessions
- **THEN** the App SHALL preserve the same iframe DOM identity, Document, and tab session
- **AND** SHALL NOT reload the project merely because the product route changed

### Requirement: Project Web Authentication Admission

A live Project Web document SHALL settle backend authentication before it starts ordinary application transports.
Authentication rejection SHALL be a terminal presentation state rather than an unresolved loading state.

#### Scenario: A live credential is accepted

- **GIVEN** a live Project Web document has consumed its transient launch credential
- **WHEN** its protected admission request succeeds
- **THEN** the document SHALL start the normal application transports
- **AND** all those transports SHALL use the same in-memory credential owner

#### Scenario: A credential is missing or rejected

- **GIVEN** a live Project Web document has no accepted credential
- **WHEN** protected admission returns an authentication rejection
- **THEN** the document SHALL render an explicit authentication-required state
- **AND** SHALL NOT start ordinary RPC, WebSocket, Terminal, or navigation data transports
- **AND** SHALL NOT retry those rejected transports in the background

#### Scenario: Admission cannot reach the backend

- **WHEN** authentication admission fails without an authentication response
- **THEN** the document SHALL preserve the concrete recoverable connection failure
- **AND** SHALL NOT rewrite it as authentication success, current data, or an endless content load

### Requirement: Minimal Embedded Capability Delegation

The hosted App SHALL delegate only the browser capabilities required by the embedded Project Web workflow.

#### Scenario: Terminal Clipboard runs inside the hosted iframe

- **GIVEN** the backend-owned Project Web is embedded by the App
- **WHEN** Terminal copy or paste uses the browser Clipboard API
- **THEN** the iframe SHALL receive Clipboard read and write capability
- **AND** SHALL NOT receive unrelated camera, microphone, display-capture, filesystem, or wildcard capability

### Requirement: Hosted Session And Inspector Continuity

The App SHALL project one accepted connection generation consistently across SessionTabs and its hosted iframe. The
persistent Sessions and Store Inspector surfaces SHALL remain contained within their parent viewport at narrow sizes.

#### Scenario: A hosted backend disconnects and reconnects

- **GIVEN** one tab and iframe consume the same current backend observation
- **WHEN** an established transport fails and an event-driven health probe confirms offline, or reconnect admission later accepts online
- **THEN** the tab status and iframe treatment SHALL converge from that same locator and generation
- **AND** a superseded checking or terminal result SHALL NOT update either surface
- **AND** an HTTP-success result during WebSocket reconnection SHALL NOT fabricate online transport state

#### Scenario: Sessions renders below the mobile App header

- **GIVEN** the App renders its mobile header and a persistent Sessions document
- **WHEN** the viewport is narrow
- **THEN** SessionTabs and the iframe SHALL consume the remaining block size
- **AND** SHALL NOT add another full viewport height or remount the iframe to fit

#### Scenario: Inspector refreshes after document focus

- **GIVEN** Inspector has settled content and a selected Store
- **WHEN** focus or visibility triggers replacement observation work
- **THEN** settled content and selection SHALL remain mounted and readable while the replacement is pending
- **AND** the stable selected locator SHALL grant no mutation authority while its current generation is retired
- **AND** accepted/running/terminal activity SHALL be visible without inventing optimistic Store inventory
- **AND** long Store facts and controls SHALL wrap, truncate, or reflow within the available inline size
