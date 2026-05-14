# opsx-terminal-panel Specification

## Purpose

Define the terminal output panel that displays streaming CLI command output for OPSX actions.

## Requirements

### Requirement: Streamed Output Rendering

The terminal panel SHALL render streaming CLI output events.

#### Scenario: Display command and output

- **GIVEN** a CLI command is executed
- **WHEN** stream events arrive
- **THEN** the terminal panel SHALL display the command line
- **AND** render stdout and stderr in order
- **AND** display the exit status when the command completes

#### Scenario: Distinguish output channels

- **GIVEN** stdout and stderr events occur
- **WHEN** the terminal renders output
- **THEN** stdout and stderr SHALL be visually distinguishable

### Requirement: Command History Controls

The terminal panel SHALL support basic history actions.

#### Scenario: Re-run last command

- **GIVEN** a command has completed
- **WHEN** the user clicks rerun
- **THEN** the UI SHALL execute the same CLI command again

#### Scenario: Clear output

- **GIVEN** the terminal panel has output
- **WHEN** the user clears the panel
- **THEN** the UI SHALL remove previous output from view

### Requirement: Multi-Command Context

The terminal panel SHALL associate output with the active change context.

#### Scenario: Change context tagging

- **GIVEN** a change is active
- **WHEN** commands are executed from that change view
- **THEN** the terminal output SHALL indicate the change identifier

### Requirement: Configurable Shell Profiles

The terminal panel SHALL support platform-aware shell profiles that users can manage and select as the default terminal shell.

#### Scenario: Resolve platform shell defaults

- **GIVEN** no user shell profile has been selected as default
- **WHEN** OpenSpecUI resolves terminal shell options
- **THEN** macOS and Linux SHALL offer `/bin/sh` and the current environment `SHELL` when available
- **AND** Windows SHALL offer `cmd`, PowerShell, and WSL bash when available
- **AND** OpenSpecUI SHALL expose the effective platform default as UI placeholder text without persisting that value as a duplicate override

#### Scenario: Manage shell profiles

- **GIVEN** the user opens terminal shell settings
- **WHEN** the user adds, edits, removes, or selects a shell profile
- **THEN** OpenSpecUI SHALL persist the user-managed shell profile list
- **AND** SHALL persist the selected default shell profile
- **AND** built-in shell profiles SHALL remain distinguishable from custom shell profiles

#### Scenario: Create default shell terminal

- **GIVEN** terminal shell profiles are configured
- **WHEN** the user activates the Terminal Panel `+` button
- **THEN** OpenSpecUI SHALL create a terminal instance using the selected default shell profile
- **AND** SHALL fall back to the effective platform default when no user default is configured

### Requirement: Configurable Spawn Commands

The terminal panel SHALL support named spawn command presets that render typed forms and create terminal instances through the terminal platform.

#### Scenario: Configure command preset shell

- **GIVEN** a spawn command preset exists
- **WHEN** OpenSpecUI creates a terminal from that preset
- **THEN** the preset SHALL run using its selected shell profile
- **AND** SHALL use the configured default shell profile when the preset does not select a shell profile

#### Scenario: Render command form from schema-backed parameters

- **GIVEN** a spawn command preset declares JSON-schema-compatible parameters
- **WHEN** the user chooses that command
- **THEN** OpenSpecUI SHALL open `TerminalSpawnCommandDialog`
- **AND** the dialog SHALL render controls for the declared parameter schema
- **AND** boolean command flags SHALL render as toggles
- **AND** the dialog SHALL render `Create` as the terminal creation action

#### Scenario: Compose command output from a builder

- **GIVEN** a spawn command preset declares parameters and a builder
- **WHEN** OpenSpecUI renders the command for terminal creation
- **THEN** the builder SHALL compose either a shell command line or an argv-style string array
- **AND** OpenSpecUI SHALL NOT execute user-provided JavaScript to compose the command
- **AND** OpenSpecUI SHALL quote argv-style parts according to the selected shell profile

#### Scenario: Built-in agent command presets

- **GIVEN** built-in command presets are available
- **WHEN** the user opens command creation options
- **THEN** OpenSpecUI SHALL offer presets for common agents such as Claude, Codex, and Gemini as data-driven command presets
- **AND** SHALL NOT hard-code those agent names into terminal platform branching logic
- **AND** dangerous flags such as Claude `--dangerously-skip-permissions` SHALL be disabled unless explicitly enabled by the user through a toggle

### Requirement: Terminal Creation Menu

The terminal panel SHALL expose terminal creation choices without coupling shell creation and command creation.

#### Scenario: Terminal creation options menu

- **GIVEN** shell profiles and spawn commands are configured
- **WHEN** the user activates the `↓` icon-button beside the Terminal Panel `+` button
- **THEN** OpenSpecUI SHALL show one menu group for shell profiles
- **AND** SHALL show a separate menu group for spawn commands

#### Scenario: Create from shell menu item

- **GIVEN** the creation menu is open
- **WHEN** the user selects a shell profile
- **THEN** OpenSpecUI SHALL create a terminal instance for that shell profile immediately

#### Scenario: Create from command menu item

- **GIVEN** the creation menu is open
- **WHEN** the user selects a spawn command
- **THEN** OpenSpecUI SHALL open `TerminalSpawnCommandDialog` for that command
- **AND** SHALL create the terminal only after the user confirms `Create`

### Requirement: Reusable Terminal Spawn Dialog

OpenSpecUI SHALL reuse `TerminalSpawnCommandDialog` for command-based terminal creation from both terminal menus and send-to-terminal flows.

#### Scenario: Launch dialog with preset payload values

- **GIVEN** a workflow has prepared content to send to a terminal
- **WHEN** the user chooses to create a new terminal target
- **THEN** OpenSpecUI SHALL launch `TerminalSpawnCommandDialog`
- **AND** SHALL pass the prepared content as preset field values where the selected command supports it
- **AND** SHALL create the terminal only after the user confirms `Create`

#### Scenario: Simple terminal sender actions

- **GIVEN** a terminal sender is displayed
- **WHEN** the selected target is an existing live terminal
- **THEN** the sender SHALL show a `Send` action that writes the prepared content to that terminal
- **WHEN** the selected target is command-based creation
- **THEN** the sender SHALL show a `Create` action that opens `TerminalSpawnCommandDialog`

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
