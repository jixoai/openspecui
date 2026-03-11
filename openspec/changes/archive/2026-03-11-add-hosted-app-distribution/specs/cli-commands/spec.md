## ADDED Requirements

### Requirement: Hosted App Launch Mode

The CLI SHALL support `openspecui --app[=<baseUrl>]` to start the local backend service and open the hosted OpenSpecUI workspace shell instead of the locally served web UI.

#### Scenario: Use configured app base URL when no CLI override is provided

- **WHEN** the user runs `openspecui --app`
- **AND** OpenSpecUI runtime config contains a non-empty `appBaseUrl`
- **THEN** the CLI SHALL use that configured base URL as the hosted shell URL base

#### Scenario: Use official default when configured app base URL is empty

- **WHEN** the user runs `openspecui --app`
- **AND** OpenSpecUI runtime config contains an empty `appBaseUrl`
- **THEN** the CLI SHALL use `https://app.openspecui.com` as the default base URL

#### Scenario: CLI override wins over configured base URL

- **WHEN** the user runs `openspecui --app=https://app.example.com/openspecui`
- **THEN** the CLI SHALL use the provided base URL instead of persisted config

#### Scenario: Bare app flag uses local hosted app dev server in workspace development mode

- **WHEN** the user runs `pnpm openspecui --app`
- **AND** the command is executed from an OpenSpecUI workspace checkout that contains the local `packages/app` project
- **THEN** the CLI SHALL start the local backend service
- **AND** it SHALL start the local hosted app frontend dev server
- **AND** it SHALL open a local URL such as `http://localhost:<app-port>/?api=<encoded-local-service-url>`

#### Scenario: Open the hosted shell with an initial backend tab request

- **WHEN** the user runs `openspecui --app`
- **THEN** the CLI SHALL start the local backend service
- **AND** it SHALL open `<baseUrl>/?api=<encoded-local-service-url>`
- **AND** the hosted shell SHALL resolve the compatible frontend bundle after querying that backend
