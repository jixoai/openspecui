# Delta for opsx-terminal-panel

## ADDED Requirements

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
