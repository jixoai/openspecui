# Delta for build-pipeline

## ADDED Requirements

### Requirement: Worktree Handoff Regression Gate

Feature changes that alter runtime protocols, tRPC subscriptions, config payload shape, server startup, or bundled CLI-served Web UI SHALL include worktree handoff verification.

#### Scenario: Runtime feature changes include handoff coverage

- **GIVEN** a change adds or modifies a runtime tRPC procedure, subscription, health payload field, config section, or server startup path
- **WHEN** the change is prepared for PR
- **THEN** the local verification plan SHALL include a worktree handoff scenario using the shared handoff test harness or a real browser/process handoff acceptance test

#### Scenario: Handoff harness covers stale runtime risk

- **GIVEN** a Web shell expects a runtime capability
- **WHEN** a test fixture models a sibling server that is healthy by project path but lacks that capability
- **THEN** the test SHALL fail the handoff before navigation
- **AND** SHALL assert that the failure is protocol/capability incompatibility rather than project liveness

#### Scenario: Source-mode handoff avoids stale build artifacts

- **GIVEN** the parent OpenSpecUI server is running from the monorepo source runtime
- **AND** a stale local `packages/cli/dist/cli.mjs` entry exists
- **WHEN** worktree handoff starts a sibling worktree server
- **THEN** the child server SHALL be started through the workspace dev command
- **AND** SHALL NOT prefer the stale local dist entry

#### Scenario: UI-only changes may scope handoff gate

- **GIVEN** a change only modifies isolated presentation behavior without touching runtime protocols, subscriptions, config shape, server startup, or CLI-served bundle behavior
- **WHEN** the change records local verification
- **THEN** it MAY scope out worktree handoff verification with a short rationale
