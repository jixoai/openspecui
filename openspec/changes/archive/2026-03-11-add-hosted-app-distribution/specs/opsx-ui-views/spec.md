## MODIFIED Requirements

### Requirement: Settings View Content

The UI SHALL surface runtime settings and tool status, including hosted app base URL configuration for hosted workspace launch mode.

#### Scenario: Display tool configuration state

- **GIVEN** skills directories are present
- **WHEN** the settings view loads
- **THEN** the UI SHALL display tool configuration status derived from skills detection

#### Scenario: Hide OPSX project configuration

- **GIVEN** OPSX project configuration exists
- **WHEN** the settings view loads
- **THEN** the UI SHALL NOT render config.yaml, schema, or change metadata panels
- **AND** those panels SHALL belong to the Config view

#### Scenario: Show hosted app base URL setting with official placeholder

- **GIVEN** the settings view is open
- **WHEN** hosted workspace launch settings are rendered
- **THEN** the UI SHALL show an `appBaseUrl` field
- **AND** the field placeholder SHALL be `https://app.openspecui.com`

#### Scenario: Persist empty app base URL without storing the official default

- **GIVEN** the user leaves `appBaseUrl` empty
- **WHEN** runtime settings are saved
- **THEN** the persisted value SHALL remain an empty string
- **AND** the UI SHALL continue to present the official placeholder as the implied hosted base URL

#### Scenario: Persist a custom hosted app base URL

- **GIVEN** the user enters `https://intranet.example.com/openspecui`
- **WHEN** runtime settings are saved
- **THEN** the persisted value SHALL equal that custom base URL
- **AND** subsequent hosted workspace launches without a CLI override SHALL use the saved base URL
