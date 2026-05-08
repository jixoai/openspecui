# Delta for opsx-workflow-ui

## ADDED Requirements

### Requirement: OPSX Agent Invocation Modes

OpenSpecUI SHALL support both compose-mode and command-mode agent handoff for OPSX workflows, with compose mode as the default.

#### Scenario: Persist invocation preference

- **GIVEN** the user changes OPSX agent invocation mode
- **WHEN** OpenSpecUI saves runtime settings
- **THEN** the preference SHALL be persisted as `opsx.agentInvocationMode`
- **AND** default `compose` values SHALL NOT require a persisted config file

#### Scenario: Quick Propose uses compose by default

- **GIVEN** the invocation mode is unset or `compose`
- **WHEN** the user sends Quick Propose to a terminal
- **THEN** OpenSpecUI SHALL send a self-contained compose prompt for the OpenSpec propose workflow
- **AND** SHALL NOT require `/opsx:propose` to be installed

#### Scenario: Command-equivalent actions honor command mode

- **GIVEN** `opsx.agentInvocationMode` is `command`
- **WHEN** the user dispatches Quick Propose, apply, or archive to an agent terminal
- **THEN** OpenSpecUI SHALL send the corresponding `/opsx:*` command payload

#### Scenario: Artifact-specific actions fall back to compose

- **GIVEN** `opsx.agentInvocationMode` is `command`
- **WHEN** the user dispatches a selected-artifact continue or fast-forward action
- **THEN** OpenSpecUI SHALL keep compose mode
- **AND** SHALL explain that selected artifact context requires compose mode
