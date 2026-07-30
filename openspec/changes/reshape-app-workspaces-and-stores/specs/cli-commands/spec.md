<!--
Orthogonal intents (created 2026-07-30 Asia/Shanghai):
1. Preserve foreground serve ownership while authorizing daemon-managed directory launch.
2. Define managed stop/restart restoration without adopting external project processes.

Original request (2026-07-30): "关键是，支持直接从目录直接启动 openspecui 服务。"
Owner lifecycle decision (2026-07-30): closing a Workspace does not stop its backend; daemon stop affects only managed services; daemon restart restores the managed running set.
-->

# Delta for cli-commands

## MODIFIED Requirements

### Requirement: Project Serve Ownership

The CLI SHALL keep every externally invoked project Server in its foreground `serve` process. The local App daemon
MAY start and supervise project Servers only through its authenticated directory-launch capability. Managed and
external owners SHALL remain physically distinct; no lifecycle command or App action may infer ownership from path,
port, locator, or process discovery.

#### Scenario: Bare command is foreground serve

- **WHEN** the user runs `openspecui [project-dir]`
- **THEN** the CLI SHALL execute the same plan as `openspecui serve [project-dir]`
- **AND** that foreground process SHALL own the project Server until it exits or handles an exact current lease
  shutdown request
- **AND** the App daemon SHALL NOT adopt that process

#### Scenario: Local App launches a managed project

- **GIVEN** the request originates from the authenticated bundled local App
- **WHEN** the user submits a valid local project directory
- **THEN** the daemon SHALL canonicalize the physical directory and start at most one managed Server for it
- **AND** SHALL use a fixed internal command plan rather than caller-supplied executable or arguments
- **AND** SHALL publish managed ownership only after backend readiness and Workspace lease admission settle

#### Scenario: Stop a managed project from Task Manager

- **GIVEN** Task Manager targets an exact current daemon-managed Workspace generation
- **WHEN** the user confirms Stop
- **THEN** the daemon SHALL terminate and settle only its owned child
- **AND** SHALL retire its lease, runtime credential, and mutation authority
- **AND** SHALL preserve credential-free directory history and favorite state

#### Scenario: Stop an external foreground project

- **GIVEN** an external foreground `serve` lease advertises owner-handled shutdown
- **WHEN** Task Manager submits Stop for that exact current lease
- **THEN** the daemon SHALL request shutdown through the lease
- **AND** the foreground owner SHALL perform and settle its normal Server teardown
- **AND** the daemon SHALL NOT signal, adopt, or kill an inferred process
- **WHEN** the lease omits shutdown capability
- **THEN** Task Manager SHALL offer only presentation Close and SHALL NOT claim the backend was stopped

#### Scenario: Daemon lifecycle commands remain project-argument-free

- **WHEN** the user runs `openspecui start`, `openspecui stop`, or `openspecui restart`
- **THEN** the command SHALL NOT accept a project argument
- **AND** `stop` SHALL terminate only daemon-managed project children before daemon teardown
- **AND** `restart` SHALL capture the current managed directory set, settle managed children, replace the daemon,
  and restore that set exactly once
- **AND** external foreground project Servers SHALL remain owned by their serve processes and re-register normally
