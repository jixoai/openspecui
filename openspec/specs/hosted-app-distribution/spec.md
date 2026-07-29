<!--
Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
1. Specify the bundled local App shell and optional standalone PWA distribution.
2. Specify backend-owned embedding, authentication, and capability boundaries.
3. Specify reactive Workspace and Inspector continuity.
4. Specify daemon-owned Workspaces, retained OpenTray presentation, and titlebar geometry.

Owner direction (2026-07-29): the daemon's same-version local App shell is authoritative; standalone App deployment is manual and is not a CLI shell-location setting.
-->

# hosted-app-distribution Specification

## Purpose

Define the App as a persistent multi-project shell distributed with the CLI, presented by the local App daemon, and optionally deployed as a standalone browser/PWA surface.

## Requirements

### Requirement: App Workspace And Distribution

The system SHALL provide a dedicated frontend `app` workspace that builds one persistent Workspaces shell for bundled local and optional standalone delivery.

#### Scenario: Build the App shell

- **WHEN** the App workspace is built
- **THEN** it SHALL emit a root `index.html`
- **AND** it SHALL emit a root `service-worker.js`
- **AND** it SHALL emit a root `manifest.webmanifest`
- **AND** the shell SHALL own Workspace restoration, backend probing, and initial-Workspace admission

#### Scenario: Package the authoritative local shell

- **WHEN** the publishable CLI package is built
- **THEN** it SHALL include the App output produced by that same source release
- **AND** the user-level App daemon SHALL serve those assets from a loopback endpoint
- **AND** the daemon SHALL NOT select or depend on an external App deployment

#### Scenario: Deploy the App independently

- **WHEN** an operator deploys the App output as a static browser or PWA surface
- **THEN** the package README SHALL document static-host cache and SPA-fallback requirements
- **AND** that deployment MAY accept a manually supplied backend launch parameter
- **AND** the CLI SHALL NOT expose a setting or URL-valued flag that selects that deployment

#### Scenario: Open an initial standalone Workspace

- **GIVEN** a standalone App deployment
- **WHEN** the shell loads with a valid `api` query parameter
- **THEN** it SHALL create or activate a Workspace for that backend service
- **AND** it SHALL query backend health for embedding metadata
- **AND** it SHALL render the Workspace without discarding the shell itself

### Requirement: Backend-Owned Embedded UI Contract

The App SHALL depend on backend-declared embedding metadata instead of a frontend version manifest. The backend health payload SHALL declare runtime protocol capabilities used by cross-runtime App shells.

#### Scenario: Backend health advertises embedded UI entrypoint

- **WHEN** the App probes `/api/health`
- **THEN** the payload SHALL include `hostedShellProtocolVersion`
- **AND** the payload SHALL include `embeddedUiUrl`
- **AND** the payload SHALL include runtime capabilities
- **AND** the App SHALL reject payloads that do not satisfy that contract

#### Scenario: Reject backend without required runtime capabilities

- **GIVEN** a backend health endpoint returns `status: "ok"` and project metadata
- **WHEN** the payload omits a runtime capability required by the current App shell
- **THEN** the payload SHALL be treated as incompatible
- **AND** the caller SHALL reject the backend before embedding or handoff navigation

#### Scenario: App loads a backend-owned page

- **WHEN** the backend advertises a compatible `embeddedUiUrl`
- **THEN** the App SHALL load that URL in the iframe
- **AND** it SHALL append the active backend `api` parameter
- **AND** it SHALL append the tab-local `session` parameter

#### Scenario: Supported embedded URLs stay browser-compatible

- **WHEN** the backend advertises an embedded UI URL
- **THEN** the App SHALL accept `https://` URLs
- **AND** it SHALL accept loopback `http://` URLs
- **AND** it SHALL reject arbitrary remote `http://` URLs

### Requirement: PWA Shell Updates

The App SHALL use normal PWA and service-worker upgrade semantics when it runs in a browser deployment.

#### Scenario: Detect waiting shell update

- **WHEN** the browser reports a waiting service worker for the App
- **THEN** the App SHALL surface an apply-update action
- **AND** applying that update SHALL reload the shell
- **AND** persisted Workspaces and tab sessions SHALL survive that reload

### Requirement: Workspace Projection And Document Continuity

The App SHALL perform one typed Pull for each selected Store and Root projection when its owner is admitted, without waiting for a WebSocket lifecycle notice. It SHALL retain stateful project iframe Documents across ordinary App route transitions.

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

#### Scenario: A user leaves and returns to Workspaces

- **GIVEN** a project iframe Document is mounted in Workspaces
- **WHEN** the user navigates to another App route and later returns to Workspaces
- **THEN** the App SHALL preserve the same iframe DOM identity, Document, and tab session
- **AND** SHALL NOT reload the project merely because the product route changed

### Requirement: Project Web Authentication Admission

A live Project Web document SHALL settle backend authentication before it starts ordinary application transports. Authentication rejection SHALL be a terminal presentation state rather than an unresolved loading state.

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

The App SHALL delegate only the browser capabilities required by the embedded Project Web workflow.

#### Scenario: Terminal Clipboard runs inside the App iframe

- **GIVEN** the backend-owned Project Web is embedded by the App
- **WHEN** Terminal copy or paste uses the browser Clipboard API
- **THEN** the iframe SHALL receive Clipboard read and write capability
- **AND** SHALL NOT receive unrelated camera, microphone, display-capture, filesystem, or wildcard capability

### Requirement: Workspace And Inspector Continuity

The App SHALL project one accepted connection generation consistently across Workspace tabs and their iframe. Persistent Workspaces and Store Inspector surfaces SHALL remain contained within their parent viewport at narrow sizes.

#### Scenario: A Workspace backend disconnects and reconnects

- **GIVEN** one tab and iframe consume the same current backend observation
- **WHEN** an established transport fails and an event-driven health probe confirms offline, or reconnect admission later accepts online
- **THEN** the tab status and iframe treatment SHALL converge from that same locator and generation
- **AND** a superseded checking or terminal result SHALL NOT update either surface
- **AND** an HTTP-success result during WebSocket reconnection SHALL NOT fabricate online transport state

#### Scenario: Workspaces renders below the mobile App header

- **GIVEN** the App renders its mobile header and a persistent Workspaces document
- **WHEN** the viewport is narrow
- **THEN** the Workspace tabs and iframe SHALL consume the remaining block size
- **AND** SHALL NOT add another full viewport height or remount the iframe to fit

#### Scenario: Inspector refreshes after document focus

- **GIVEN** Inspector has settled content and a selected Store
- **WHEN** focus or visibility triggers replacement observation work
- **THEN** settled content and selection SHALL remain mounted and readable while the replacement is pending
- **AND** the stable selected locator SHALL grant no mutation authority while its current generation is retired
- **AND** accepted, running, or terminal activity SHALL be visible without inventing optimistic Store inventory
- **AND** long Store facts and controls SHALL wrap, truncate, or reflow within the available inline size

### Requirement: Daemon-Owned Workspace Projection

The user-level App daemon SHALL own the local App endpoint and transient Workspace presentation ledger without owning project backend processes.

#### Scenario: A project registers with the daemon

- **GIVEN** a foreground `serve` process owns a ready project backend
- **WHEN** it registers a Workspace lease with the daemon
- **THEN** the daemon SHALL publish an invalidation notice
- **AND** the App SHALL Pull a replacement typed Workspace snapshot
- **AND** credentials SHALL remain runtime-only and SHALL NOT enter persisted Workspace state

#### Scenario: Open a Workspace in the system browser

- **WHEN** a Workspace tab invokes Open in browser
- **THEN** the App SHALL submit only its opaque Workspace id
- **AND** the daemon SHALL resolve the current backend and runtime credential
- **AND** arbitrary page-supplied URLs SHALL be rejected

#### Scenario: Daemon restarts while backends remain live

- **WHEN** the App daemon stops or restarts
- **THEN** it SHALL NOT terminate or adopt any project backend
- **AND** active `serve` leases SHALL re-register after the replacement daemon is ready

### Requirement: OpenTray And Browser Presentation

The daemon SHALL present the same bundled App shell through an exclusive native OpenTray or Browser/PWA host without changing project Server ownership.

#### Scenario: Native OpenTray retains one App window

- **GIVEN** native presentation is supported
- **WHEN** the daemon starts in native mode
- **THEN** it SHALL create one retained OpenTray WebView with `style.appMode: true`
- **AND** only the first `show()` SHALL supply bootstrap geometry, style, and native capability
- **AND** later activation SHALL reveal and focus the retained window

#### Scenario: Web mode isolates the native extension

- **WHEN** the daemon starts in Web mode or native presentation is unsupported
- **THEN** it SHALL preserve a Browser/PWA-capable App result
- **AND** it SHALL NOT import, initialize, or probe the native WebView extension

#### Scenario: Exactly one titlebar owner is active

- **WHEN** the App runs in an ordinary browser, PWA overlay, OpenTray overlay, or native frame
- **THEN** exactly one presentation owner SHALL write titlebar inset geometry
- **AND** retired geometry listeners and late async results SHALL NOT update the current owner
- **AND** interactive controls SHALL remain outside native drag regions
