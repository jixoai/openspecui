# Delta for opsx-terminal-panel

## ADDED Requirements

### Requirement: Terminal Notification Producer

The terminal platform SHALL publish structured web-notifications for terminal notification escape sequences.

#### Scenario: Publish notification from OSC 9

- **GIVEN** a PTY session emits an OSC 9 notification sequence
- **WHEN** the backend PTY producer processes output
- **THEN** OpenSpecUI SHALL publish a terminal-scoped web-notification using the OSC message as the body
- **AND** preserve other terminal output

#### Scenario: Publish notification from OSC 777

- **GIVEN** a PTY session emits an OSC 777 notify sequence
- **WHEN** the backend PTY producer processes output
- **THEN** OpenSpecUI SHALL publish a terminal-scoped web-notification with parsed title and body
- **AND** preserve other terminal output

#### Scenario: Exclude terminal bell from web-notifications

- **GIVEN** a PTY session emits a terminal bell
- **WHEN** the backend PTY producer processes output
- **THEN** OpenSpecUI SHALL emit a terminal-local bell event to attached clients
- **AND** SHALL NOT publish a web-notification for that bell

#### Scenario: Clear terminal notifications on focus

- **GIVEN** terminal notifications exist for a terminal session
- **WHEN** the user focuses that terminal tab
- **THEN** OpenSpecUI SHALL clear those terminal-scoped notifications immediately or after a short focused-terminal delay
- **AND** update the tab unread indicator

#### Scenario: Parse terminal control metadata without web-notification leakage

- **GIVEN** a PTY session emits terminal metadata control sequences such as OSC 9;4 progress, OSC 0/1/2 title, OSC 7/9;9/633/1337 current directory, or OSC 133/633 prompt state
- **WHEN** the backend PTY producer processes output
- **THEN** OpenSpecUI SHALL emit typed terminal-local metadata messages for attached clients
- **AND** SHALL NOT publish those terminal metadata controls as web-notifications

#### Scenario: Resolve terminal display title in backend

- **GIVEN** a PTY session exposes a foreground process title and also emits OSC title controls
- **WHEN** the backend PTY producer processes those controls
- **THEN** OpenSpecUI SHALL resolve the terminal display title in the backend using OSC title, then foreground process title, then command fallback
- **AND** the frontend SHALL consume that resolved display title as the single parsed title source for TerminalTab rendering
- **AND** terminal notification source titles SHALL use the same backend-resolved display title snapshot from publish time

#### Scenario: Render terminal notification badge out of flow

- **GIVEN** a terminal tab has unread terminal-scoped notifications
- **WHEN** the TerminalTab renders
- **THEN** OpenSpecUI SHALL render the unread indicator as an out-of-flow badge
- **AND** a single unread notification SHALL render as a dot without a number
- **AND** multiple unread notifications SHALL render the count without changing title layout width

### Requirement: Terminal Bell Feedback

The terminal platform SHALL treat terminal bell as a local terminal feedback cue, not as a web-notification.

#### Scenario: Play configured bell sound

- **GIVEN** a PTY session emits a terminal bell
- **WHEN** the frontend receives the terminal bell event
- **THEN** OpenSpecUI SHALL play the configured terminal `Bell Sound`
- **AND** the terminal `Bell Sound` setting SHALL be separate from `Notification Sound`
- **AND** the default terminal bell sound SHALL be `builtin:Tink`

#### Scenario: Render tab status ripple

- **GIVEN** a PTY session emits a terminal bell
- **WHEN** the frontend receives the terminal bell event
- **THEN** the corresponding TerminalTab status indicator SHALL render a primary-color ripple animation
- **AND** the NotificationsPanel unread count SHALL remain unchanged by that bell

### Requirement: Terminal Keyboard Input Compatibility

The terminal platform SHALL normalize browser key events into shell-compatible PTY input.

#### Scenario: macOS arrow keys

- **GIVEN** the terminal is focused on macOS
- **WHEN** the user presses an arrow key, including browser events that report no keyCode or xterm application-cursor mode
- **THEN** OpenSpecUI SHALL send the corresponding ANSI cursor sequence to the PTY
- **AND** SHALL NOT rely on a terminal bell as feedback for cursor movement

#### Scenario: macOS Option arrow word movement

- **GIVEN** the terminal is focused on macOS
- **WHEN** the user presses Option with an arrow key
- **THEN** OpenSpecUI SHALL send shell-compatible word or modified cursor movement input to the PTY

#### Scenario: macOS Command arrow line movement

- **GIVEN** the terminal is focused on macOS
- **WHEN** the user presses Command with an arrow key
- **THEN** OpenSpecUI SHALL send shell-compatible line-boundary input to the PTY
- **AND** SHALL NOT let the renderer silently ignore the key event
