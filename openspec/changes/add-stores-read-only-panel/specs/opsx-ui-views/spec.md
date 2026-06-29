# opsx-ui-views Specification Delta

## ADDED Requirements

### Requirement: Stores Discovery Panel (Beta)

OpenSpecUI SHALL provide a read-only Stores panel that lists machine-registered OpenSpec stores and their health, gated behind a visible Beta badge. The panel SHALL NOT mutate store registrations or switch the active project root.

#### Scenario: Show registered stores

- **GIVEN** at least one store is registered on the machine and the CLI is 1.5.0+
- **WHEN** the user opens the Stores panel
- **THEN** the UI SHALL list each store's id and root path
- **AND** SHALL display health facts derived from `openspec store doctor --json`

#### Scenario: Display Beta badge

- **GIVEN** the Stores panel is rendered
- **WHEN** the user views the panel title or navigation entry
- **THEN** the UI SHALL show a visible Beta badge
- **AND** SHALL keep it for the entire early-beta lifecycle of stores

#### Scenario: Refresh store list reactively

- **GIVEN** the Stores panel is open
- **WHEN** the local store registry changes
- **THEN** the UI SHALL update via a polling subscription (since the registry lives outside the project directory)
- **AND** SHALL offer a manual refresh control

#### Scenario: Restrict to live mode

- **GIVEN** OpenSpecUI runs in static/SSG mode
- **WHEN** the navigation is composed
- **THEN** the UI SHALL NOT render the Stores panel or include stores data in the static snapshot

#### Scenario: Read-only guarantee

- **GIVEN** the Stores panel is displayed
- **WHEN** the user interacts with any store entry
- **THEN** the UI SHALL only show details (no setup/register/unregister/remove actions in this phase)
- **AND** SHALL NOT change the active project directory

#### Scenario: Degrade gracefully without store-capable CLI

- **GIVEN** the OpenSpec CLI is unavailable or older than 1.5.0
- **WHEN** the Stores panel loads
- **THEN** the UI SHALL show a beta-gated degradation message with upgrade guidance
- **AND** SHALL NOT block the rest of the interface
