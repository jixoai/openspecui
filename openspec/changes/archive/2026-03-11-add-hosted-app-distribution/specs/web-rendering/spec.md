## ADDED Requirements

### Requirement: Hosted API Endpoint Override

The hosted web application SHALL support hosted startup with an explicit backend endpoint supplied by the hosted shell.

#### Scenario: Use `api` query parameter for HTTP and WebSocket traffic

- **WHEN** the hosted web application loads with `?api=http://localhost:13000`
- **THEN** the runtime SHALL normalize that endpoint before React initialization
- **AND** HTTP requests SHALL target the supplied endpoint
- **AND** WebSocket subscriptions SHALL target the supplied endpoint instead of the hosted static origin

#### Scenario: Show connection guidance when no hosted backend endpoint is provided

- **WHEN** the hosted web application loads without a valid `api` query parameter
- **THEN** the application SHALL render a clear connection setup state
- **AND** it SHALL NOT attempt same-origin API or WebSocket connections to the hosted static domain

### Requirement: Session-Scoped Hosted Persistence

The hosted web application SHALL support a shell-supplied session identifier so multiple hosted tabs on one origin do not overwrite each other's tab-local browser state.

#### Scenario: Namespace tab-local state by hosted session

- **WHEN** the hosted web application loads with a session identifier supplied by the hosted shell
- **THEN** tab-local browser persistence SHALL use a session-scoped namespace
- **AND** another hosted session on the same origin SHALL NOT overwrite that tab-local state

#### Scenario: Preserve explicit global settings separately from tab-local state

- **WHEN** the hosted web application persists settings that are intentionally global
- **THEN** those global settings SHALL remain shared by design
- **AND** they SHALL NOT force tab-local drafts or panel state to become shared

### Requirement: Embeddable Version Entry Pages

The hosted web bundles SHALL load correctly from direct version entry pages under `versions/<channel>/` inside the hosted workspace shell.

#### Scenario: Load a version entry page directly inside the hosted shell

- **WHEN** the hosted shell renders `/versions/v2.0/index.html` for an active tab
- **THEN** the embedded application SHALL boot successfully inside that isolated browsing context
- **AND** it SHALL use the supplied hosted backend endpoint and session identifier for that tab

#### Scenario: Embedded hosted navigation stays inside the version entry context

- **WHEN** the embedded hosted application performs client-side navigation
- **THEN** that navigation SHALL remain inside the embedded version entry context
- **AND** it SHALL NOT replace or discard the root hosted shell
