# Delta for opsx-ui-views

## MODIFIED Requirements

### Requirement: Git Worktree Responsive Actions

The UI SHALL render Git worktree handoff actions without causing horizontal overflow in narrow layouts.
The handoff action SHALL rely on platform runtime compatibility checks before navigating to a sibling worktree server.

#### Scenario: Render compact worktree switch action

- **GIVEN** the Git page lists other available worktrees
- **WHEN** the worktree switch action is rendered
- **THEN** the action SHALL be an icon-only button with an accessible name
- **AND** the worktree summary and action SHALL wrap or reflow to fit narrow containers without omitting branch or path content
- **AND** the action SHALL continue to use the existing worktree handoff behavior

#### Scenario: Switch to compatible sibling worktree

- **GIVEN** a sibling worktree server reports the requested project directory
- **AND** the server reports a compatible runtime protocol and required capabilities
- **WHEN** the user switches to that worktree
- **THEN** OpenSpecUI SHALL navigate to the sibling server
- **AND** SHALL preserve the current route path, search, and hash

#### Scenario: Reject incompatible sibling worktree

- **GIVEN** a sibling worktree server reports the requested project directory
- **AND** the server omits the required runtime protocol or capabilities
- **WHEN** the user switches to that worktree
- **THEN** OpenSpecUI SHALL reject the handoff before navigation
- **AND** SHALL surface an actionable handoff failure instead of rendering a broken shell

#### Scenario: Notification atom survives missing optional config

- **GIVEN** the runtime config payload omits the optional `notifications` section
- **WHEN** the notification provider renders
- **THEN** it SHALL use notification defaults
- **AND** it SHALL NOT crash the application root
