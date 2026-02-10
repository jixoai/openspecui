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

