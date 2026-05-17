## ADDED Requirements

### Requirement: Translation Settings Persistence Boundary

The web application SHALL treat translation preferences as global runtime settings while keeping document translation sessions ephemeral to the current view.

#### Scenario: Share translation preferences as intentional global settings

- **WHEN** OpenSpecUI persists translation enablement, target language, or translation display mode
- **THEN** those values SHALL be stored as intentional runtime settings shared across document-reading pages
- **AND** they SHALL remain separate from per-document translation session state

#### Scenario: Keep document translation session state out of global settings

- **GIVEN** a document is currently translating or already rendered in translated form
- **WHEN** the user navigates away or opens another document
- **THEN** the runtime SHALL NOT persist that document session state as a second global document truth
- **AND** another document view SHALL start from its own source-state session unless the user translates it explicitly

### Requirement: Hosted Translation Session Boundary

The hosted web application SHALL keep translation settings and document translation sessions scoped according to existing hosted persistence law.

#### Scenario: Hosted sessions share intentional global translation preferences only

- **GIVEN** the hosted web application persists translation settings that are intentionally global
- **WHEN** another hosted tab on the same origin opens a document-reading view
- **THEN** those translation preferences MAY remain shared by design
- **AND** the hosted shell SHALL NOT reinterpret them as tab-local draft state

#### Scenario: Hosted sessions do not share in-flight document translation state

- **GIVEN** one hosted session has an in-flight or completed document translation session
- **WHEN** another hosted session on the same origin opens the same or another document
- **THEN** the second session SHALL NOT inherit the first session's in-flight progress or rendered translation session state automatically

### Requirement: Static Translation Capability Degradation

The web application SHALL degrade translation settings safely in static export mode when runtime translation capability is unavailable.

#### Scenario: Static mode without browser translation capability

- **GIVEN** the application runs in static export mode
- **AND** the browser context does not expose usable translation capability
- **WHEN** the user opens translation settings or a translated document surface
- **THEN** the UI SHALL show translation as unavailable or limited
- **AND** it SHALL NOT imply live runtime initialization or download behavior that cannot occur

#### Scenario: Static mode with browser translation capability

- **GIVEN** the application runs in static export mode
- **AND** the browser context does expose usable translation capability
- **WHEN** the user enables translation
- **THEN** the UI MAY allow browser-side translation projection for the current static document
- **AND** it SHALL still respect the same global-settings versus document-session boundary
