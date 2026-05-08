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

#### Scenario: Backend health advertises embedded UI entrypoint

- **WHEN** the hosted shell probes `/api/health`
- **THEN** the payload SHALL include `hostedShellProtocolVersion`
- **AND** the payload SHALL include `embeddedUiUrl`
- **AND** the shell SHALL reject payloads that do not satisfy that contract

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
