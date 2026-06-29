# opsx-ui-views Specification Delta

## MODIFIED Requirements

### Requirement: Stores Discovery Panel (Beta)

OpenSpecUI SHALL provide a read-only Stores panel, gated behind a visible Beta badge, that lists machine-registered OpenSpec stores and their health. The panel SHALL follow the beta feature fault-tolerance model: it never crashes, it shows objective errors with version source on data-incompatible failures, and it hides its entry on command-change failures. It SHALL NOT mutate store registrations or switch the active project root.

#### Scenario: Show registered stores

- **GIVEN** at least one store is registered and the CLI returns compatible data
- **WHEN** the user opens the Stores panel
- **THEN** the UI SHALL list each store's id and root path
- **AND** SHALL display health facts derived from `openspec store doctor --json`

#### Scenario: Display Beta badge

- **GIVEN** the Stores panel is rendered
- **WHEN** the user views the panel title or navigation entry
- **THEN** the UI SHALL show a visible Beta badge

#### Scenario: Show data-incompatible error with version source

- **GIVEN** the CLI returns a structurally incompatible stores payload (data-incompatible)
- **WHEN** the Stores panel renders
- **THEN** the UI SHALL objectively display the error
- **AND** SHALL show the originating OpenSpec CLI version
- **AND** SHALL NOT crash or hide the entry

#### Scenario: Hide entry on command-change failure

- **GIVEN** the `store list`/`doctor` command is missing or its usage has changed (command-unavailable)
- **WHEN** the navigation is composed
- **THEN** the UI SHALL hide the Stores entry

#### Scenario: Refresh store list reactively

- **GIVEN** the Stores panel is open
- **WHEN** the local store registry changes
- **THEN** the UI SHALL update via a polling subscription (the registry lives outside the project directory) that the server polls and pushes to the frontend
- **AND** SHALL NOT expose polling cadence or registry-location details to the user
- **AND** SHALL NOT offer a manual refresh control

#### Scenario: Restrict to live mode

- **GIVEN** OpenSpecUI runs in static/SSG mode
- **WHEN** the navigation is composed
- **THEN** the UI SHALL NOT render the Stores panel or include stores data in the static snapshot

#### Scenario: Read-only guarantee

- **GIVEN** the Stores panel is displayed
- **WHEN** the user interacts with any store entry
- **THEN** the UI SHALL only show details (no setup/register/unregister/remove actions in this phase)
- **AND** SHALL NOT change the active project directory
