# hosted-app-distribution Specification

## Purpose

Define the hosted app shell as a persistent PWA tabs manager that embeds backend-owned OpenSpecUI pages.

## Requirements

### Requirement: Frontend App Workspace for Hosted Delivery

The system SHALL provide a dedicated frontend `app` workspace that builds the hosted workspace shell for a single base URL.

#### Scenario: Build root hosted workspace shell

- **WHEN** the hosted app workspace is built
- **THEN** it SHALL emit a root `index.html`
- **AND** it SHALL emit a root `service-worker.js`
- **AND** it SHALL emit a root `manifest.webmanifest`
- **AND** the root shell SHALL be responsible for hosted tabs, session restoration, backend probing, and initial-tab creation behavior

#### Scenario: Open an initial hosted tab from launch parameters

- **WHEN** the root hosted shell loads with a valid `api` query parameter
- **THEN** it SHALL create or activate a hosted tab for that backend service
- **AND** it SHALL query the backend health endpoint for embedding metadata
- **AND** it SHALL render the selected tab without discarding the shell itself

#### Scenario: Label tabs with project metadata

- **WHEN** the hosted shell receives backend metadata from `/api/health`
- **THEN** each tab SHALL use the backend project name as its primary title
- **AND** it SHALL use the backend API URL as its subtitle
- **AND** long titles or subtitles SHALL truncate rather than expanding the tab strip indefinitely

#### Scenario: Keep shell chrome focused on the tab strip

- **WHEN** the hosted workspace shell renders its own UI
- **THEN** the tab strip SHALL remain the primary chrome surface
- **AND** shell actions such as refresh or add-backend SHALL live inline at the end of the tab strip instead of in a separate page header

### Requirement: Backend-Owned Embedded UI Contract

The hosted shell SHALL depend on backend-declared embedding metadata instead of a hosted version manifest.
The backend health payload SHALL also declare runtime protocol capabilities used by cross-runtime Web shells.

#### Scenario: Backend health advertises embedded UI entrypoint

- **WHEN** the hosted shell probes `/api/health`
- **THEN** the payload SHALL include `hostedShellProtocolVersion`
- **AND** the payload SHALL include `embeddedUiUrl`
- **AND** the payload SHALL include runtime capabilities
- **AND** the shell SHALL reject payloads that do not satisfy that contract

#### Scenario: Reject backend without required runtime capabilities

- **GIVEN** a backend health endpoint returns `status: "ok"` and project metadata
- **WHEN** the payload omits a runtime capability required by the current Web shell
- **THEN** the payload SHALL be treated as incompatible
- **AND** the caller SHALL reject the backend before embedding or handoff navigation

#### Scenario: Hosted shell launches backend-owned page

- **WHEN** the backend advertises a compatible `embeddedUiUrl`
- **THEN** the shell SHALL load that URL in the iframe
- **AND** it SHALL append the active backend `api` parameter
- **AND** it SHALL append the tab-local `session` parameter

#### Scenario: Supported embedded URLs stay browser-compatible

- **WHEN** the backend advertises an embedded UI URL
- **THEN** the shell SHALL accept `https://` URLs
- **AND** it SHALL accept loopback `http://` URLs
- **AND** it SHALL reject arbitrary remote `http://` URLs

### Requirement: PWA Shell Updates

The hosted shell SHALL use normal PWA/service-worker upgrade semantics instead of warming versioned frontend caches.

#### Scenario: Detect waiting shell update

- **WHEN** the browser reports a waiting service worker for the hosted shell
- **THEN** the shell SHALL surface an apply-update action
- **AND** applying that update SHALL reload the shell
- **AND** persisted tabs and sessions SHALL survive that reload

### Requirement: Hosted Deployment Documentation

The app workspace SHALL document how to deploy the built hosted shell in official and self-hosted environments.

#### Scenario: Document container deployment

- **WHEN** the app workspace README is generated
- **THEN** it SHALL include Docker-based deployment instructions for serving the built static output

#### Scenario: Document reverse-proxy deployment

- **WHEN** the app workspace README is generated
- **THEN** it SHALL include nginx and Caddy examples
- **AND** it SHALL explain cache expectations for shell entrypoints and static shell assets

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

### Requirement: Host-Neutral App Presentation

The CLI start owner SHALL submit a semantic presentation request after the backend Server is ready. The selected
host presenter SHALL own how that request becomes a browser/PWA or native surface; Server startup SHALL NOT depend
on a browser-only opener contract.

#### Scenario: Browser presents a hosted App request

- **GIVEN** the start owner resolved a hosted App base, backend locator, and runtime-only credential
- **WHEN** the Browser presenter receives the semantic request
- **THEN** it SHALL build the private launch URL only at the presentation boundary
- **AND** an installed same-scope PWA MAY use its declared `focus-existing` launch handling
- **AND** the credential SHALL NOT enter the public hosted URL, logs, or persisted shell state

#### Scenario: An ordinary browser launch reaches an existing App leader

- **GIVEN** a newly opened App Document forwards its launch to an existing same-origin browser or PWA leader
- **WHEN** the leader acknowledges and applies the request
- **THEN** the leader SHALL request focus
- **AND** the transient source Document SHALL retire best-effort whether the leader is a browser or PWA
- **AND** a source that applies locally or becomes the fallback leader SHALL remain mounted

#### Scenario: A native host presenter is selected in the future

- **WHEN** a native host such as OpenTray implements the presentation contract
- **THEN** it SHALL consume the same semantic backend presentation intent
- **AND** it MAY show or focus its native window without requiring the start owner to construct a browser URL
