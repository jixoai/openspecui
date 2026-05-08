# Delta for opsx-ui-views

## ADDED Requirements

### Requirement: OPSX Invocation Mode Settings

The UI SHALL surface OPSX agent invocation preference controls in runtime settings.

#### Scenario: Show OPSX invocation mode setting

- **GIVEN** the settings view is open in dynamic mode
- **WHEN** runtime settings are rendered
- **THEN** the UI SHALL show an OPSX invocation mode control with compose and command options
- **AND** selecting an option SHALL save the project-level `opsx.agentInvocationMode` preference
