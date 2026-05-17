## MODIFIED Requirements

### Requirement: Settings View Content

The UI SHALL surface runtime settings and tool status, including app shell base URL configuration for hosted workspace launch mode and document translation settings.

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

#### Scenario: Show translation settings

- **GIVEN** the settings view is open in dynamic mode
- **WHEN** runtime settings are rendered
- **THEN** the UI SHALL include a dedicated Translation section
- **AND** that section SHALL expose translation enablement, target language, translation display mode, and browser translation capability state

## ADDED Requirements

### Requirement: Document Translation Entry in Reading Views

The UI SHALL provide a shared translation entry point for supported document reading views.

#### Scenario: Render translation button in ToC header

- **GIVEN** a supported document view renders with the shared ToC surface
- **WHEN** the ToC header renders in wide or narrow layouts
- **THEN** the UI SHALL render a translation icon button at the header inline-end position
- **AND** that button SHALL remain available in both wide and narrow layouts

#### Scenario: ToC consumes projected labels without translation-specific logic

- **GIVEN** a supported document view projects heading labels into the DOM
- **WHEN** the shared ToC builds its navigation labels
- **THEN** the UI SHALL read `data-toc-label` before falling back to heading text content
- **AND** the ToC implementation SHALL remain generic rather than branching on translation mode

#### Scenario: Show untranslated state

- **GIVEN** the current document is not translated
- **WHEN** the translation button renders
- **THEN** it SHALL use the primary-border visual state

#### Scenario: Show translated state

- **GIVEN** the current document is rendered in translated mode
- **WHEN** the translation button renders
- **THEN** it SHALL use the primary-filled visual state

#### Scenario: Show translating and allow cancel

- **GIVEN** a document translation request is currently in progress
- **WHEN** the translation button renders
- **THEN** it SHALL show a translating state
- **AND** activating it again SHALL cancel the in-flight translation

#### Scenario: Jump to translation settings when feature is disabled

- **GIVEN** translation is not enabled in runtime settings
- **WHEN** the user activates the translation button on a supported document view
- **THEN** the UI SHALL navigate to the Settings page
- **AND** SHALL focus or anchor the Translation settings section

#### Scenario: Respect document translation display mode

- **GIVEN** a supported document view renders translated content
- **WHEN** the user has configured direct or bilingual display mode in Settings
- **THEN** the document view SHALL render according to that configured mode

#### Scenario: Bilingual ToC shows source labels while direct mode shows translated labels

- **GIVEN** a supported document view renders translated content
- **WHEN** the user switches between direct and bilingual display mode
- **THEN** the document view SHALL update the projected ToC label source accordingly
- **AND** the ToC SHALL continue reading labels through the same generic contract
