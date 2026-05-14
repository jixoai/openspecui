# Delta for web-notifications

## ADDED Requirements

### Requirement: Backend Notification Authority

OpenSpecUI SHALL store live web-notifications in backend memory as the only notification authority.
Terminal BEL/bell events SHALL NOT be web-notification producers.

#### Scenario: Publish notification

- **WHEN** a producer publishes a valid structured notification
- **THEN** the server SHALL assign a unique notification id and timestamp
- **AND** emit the updated notification list to all subscribers

#### Scenario: Read notification burns it everywhere

- **GIVEN** multiple clients are subscribed
- **WHEN** one client marks a notification as read
- **THEN** the server SHALL remove that notification from memory
- **AND** all clients SHALL receive the updated list

#### Scenario: Clear notification group

- **GIVEN** several notifications share a group key
- **WHEN** a client clears the group
- **THEN** the server SHALL remove every notification in that group
- **AND** preserve notifications in other groups

#### Scenario: Preserve duplicate events for client aggregation

- **GIVEN** a producer emits multiple notifications with the same group, title, body, source, actions, and level
- **WHEN** those notifications are published
- **THEN** the server SHALL keep each notification as a separate burnable record
- **AND** emit the updated notification list to subscribers

### Requirement: Structured Notification Actions

Web-notifications SHALL carry typed action intents that the frontend resolves before execution.

#### Scenario: Resolve available terminal action

- **GIVEN** a notification contains a terminal focus action for a live terminal session
- **WHEN** the notification panel renders the action
- **THEN** the action SHALL be enabled
- **AND** clicking it SHALL focus the target terminal tab and burn the notification

#### Scenario: Disable missing target action

- **GIVEN** a notification action targets a terminal session that no longer exists
- **WHEN** the notification panel renders the action
- **THEN** the action SHALL be disabled
- **AND** display a reason that the target is unavailable

### Requirement: Notifications Panel

OpenSpecUI SHALL render web-notifications in a PopArea NotificationsPanel.

#### Scenario: Open from status bell

- **WHEN** the user clicks the status-bar notification bell
- **THEN** OpenSpecUI SHALL open the notifications PopArea panel
- **AND** show grouped notifications with unread count

#### Scenario: Single panel header

- **WHEN** the NotificationsPanel opens in PopArea
- **THEN** the unread count and clear-all action SHALL render in the PopArea header
- **AND** the panel body SHALL NOT render a second notifications header

#### Scenario: Group and expand notifications

- **GIVEN** multiple notifications share typed source metadata
- **WHEN** the panel renders them
- **THEN** notifications SHALL be grouped by that metadata
- **AND** users SHALL be able to expand a group with grid-row animation to inspect every aggregate

#### Scenario: Aggregate identical notifications within a group

- **GIVEN** notifications in a group have the same title, body, source, actions, and level
- **WHEN** the panel renders the group
- **THEN** the panel SHALL render one aggregate row using the latest timestamp
- **AND** show the duplicate count as primary-colored text next to the title
- **AND** aggregate read and action buttons SHALL burn every notification in that aggregate

#### Scenario: Remove with grid list animation

- **WHEN** a notification or group is removed
- **THEN** the row SHALL collapse with a grid-row animation
- **AND** remaining rows SHALL move smoothly without layout jumps

#### Scenario: Use pop route view transition

- **WHEN** the NotificationsPanel opens or closes
- **THEN** it SHALL use the same PopArea view-transition semantics as SearchPanel

### Requirement: Browser Notification Bridge

OpenSpecUI SHALL maintain browser-notifications as a single rolling native notification.

#### Scenario: Update rolling native notification

- **GIVEN** browser notifications are enabled and permitted
- **WHEN** a new web-notification arrives
- **THEN** OpenSpecUI SHALL close the previous rolling browser notification when possible
- **AND** create one replacement notification summarizing unread count and latest notification

#### Scenario: Suppress while panel is open

- **GIVEN** the NotificationsPanel is open
- **WHEN** new web-notifications arrive
- **THEN** OpenSpecUI SHALL suppress the rolling browser notification
- **AND** keep the web-notifications panel as the active surface

#### Scenario: Click native notification

- **WHEN** the user clicks the browser notification
- **THEN** OpenSpecUI SHALL call `window.focus()`
- **AND** open the NotificationsPanel
- **AND** highlight the latest notification when available

### Requirement: Notification Settings

OpenSpecUI SHALL expose notification settings in the Settings page.

#### Scenario: Enable browser notifications

- **WHEN** the user activates `Enable System Notifications`
- **THEN** OpenSpecUI SHALL request browser notification permission from that user gesture
- **AND** render the current browser notification support and permission state

#### Scenario: Select and preview sound

- **WHEN** the user changes `Notification Sound`
- **THEN** OpenSpecUI SHALL persist the selection in UI configuration
- **AND** allow previewing bundled notification sound assets
- **AND** allow selecting silent mode

### Requirement: Local Notification Publish API

OpenSpecUI SHALL provide a local API endpoint for scripts and hooks to publish structured notifications.

#### Scenario: Publish from local HTTP API

- **WHEN** a local client posts a valid notification payload to the notification API
- **THEN** the server SHALL validate it with the shared notification schema
- **AND** publish it through the same backend memory service as internal producers

#### Scenario: Reject invalid publish payload

- **WHEN** a local client posts an invalid notification payload
- **THEN** the server SHALL return a validation error
- **AND** SHALL NOT emit a notification
