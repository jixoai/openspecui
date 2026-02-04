## ADDED Requirements

### Requirement: Static Rendering Mode Detection

The web application SHALL detect whether it is running in static export mode or live server mode.

#### Scenario: Detect static mode from environment
- **GIVEN** the application is built for static export
- **WHEN** the app initializes
- **THEN** the system SHALL set a global flag indicating static mode
- **AND** this flag SHALL be accessible to all components

#### Scenario: Detect live server mode
- **GIVEN** the application is running with a live server
- **WHEN** the app initializes
- **THEN** the system SHALL detect server connectivity
- **AND** enable real-time features

### Requirement: Data Snapshot Loading

The web application SHALL load project data from a pre-generated snapshot in static mode.

#### Scenario: Load data snapshot on initialization
- **GIVEN** the application is in static export mode
- **WHEN** the app initializes
- **THEN** the system SHALL fetch `data.json`
- **AND** parse it into the expected data structures
- **AND** populate the application state

#### Scenario: Handle missing data snapshot
- **GIVEN** the application is in static export mode
- **WHEN** `data.json` cannot be loaded
- **THEN** the system SHALL display an error message
- **AND** indicate that the static export may be corrupted

#### Scenario: Data snapshot caching
- **GIVEN** data snapshot is loaded successfully
- **WHEN** navigating between routes
- **THEN** the system SHALL use cached snapshot data
- **AND** NOT make additional network requests

### Requirement: Client-Side Route Handling

The web application SHALL support client-side routing in static export mode.

#### Scenario: Handle direct URL access
- **GIVEN** a user visits a direct URL like `/specs/user-auth.html`
- **WHEN** the page loads
- **THEN** the system SHALL display the correct spec
- **AND** navigation SHALL work to other pages
- **AND** browser back/forward buttons SHALL work correctly

#### Scenario: Handle deep linking
- **GIVEN** a user shares a link to a specific change or spec
- **WHEN** another user opens that link
- **THEN** the system SHALL navigate to the correct page
- **AND** display the full content

#### Scenario: Handle 404 errors gracefully
- **GIVEN** a user navigates to a non-existent route
- **WHEN** the route is not found
- **THEN** the system SHALL display a user-friendly 404 page
- **AND** provide navigation back to the dashboard

### Requirement: WebSocket Subscription Stubbing

The web application SHALL safely stub WebSocket-dependent features in static mode.

#### Scenario: Replace subscriptions with snapshot data
- **GIVEN** a component uses tRPC subscriptions in live mode
- **WHEN** running in static mode
- **THEN** the system SHALL return snapshot data instead
- **AND** NOT attempt WebSocket connections

#### Scenario: Graceful degradation of real-time features
- **GIVEN** real-time update features exist in live mode
- **WHEN** rendered in static mode
- **THEN** the system SHALL display static data
- **AND** show indicators that data is not live

### Requirement: Visual Indicators for Static Mode

The web application SHALL clearly communicate to users when viewing a static snapshot.

#### Scenario: Display static mode banner
- **GIVEN** the application is in static mode
- **WHEN** any page is displayed
- **THEN** a banner SHALL appear at the top of the page
- **AND** the banner SHALL state "Viewing static snapshot"
- **AND** include the snapshot generation timestamp

#### Scenario: Style read-only interactive elements
- **GIVEN** interactive elements exist (checkboxes, buttons)
- **WHEN** displayed in static mode
- **THEN** they SHALL have visual styling indicating read-only state
- **AND** cursor SHALL indicate elements are not interactive

#### Scenario: Add timestamp to footer
- **GIVEN** the application is in static mode
- **WHEN** viewing any page
- **THEN** the footer SHALL display "Snapshot created: [timestamp]"

### Requirement: Base Path Configuration

The web application SHALL support deployment to subdirectories via configurable base path.

#### Scenario: Respect base path for routing
- **GIVEN** the app is configured with base path `/docs/`
- **WHEN** navigating between pages
- **THEN** all routes SHALL be prefixed with `/docs/`
- **AND** browser URL SHALL reflect the base path

#### Scenario: Respect base path for assets
- **GIVEN** the app is configured with base path `/docs/`
- **WHEN** loading assets (CSS, JS, images)
- **THEN** all asset URLs SHALL be prefixed with `/docs/`
- **AND** assets SHALL load successfully

#### Scenario: Support root path deployment
- **GIVEN** the app is configured with base path `/`
- **WHEN** deployed to the root of a domain
- **THEN** all routes and assets SHALL work without path prefix
