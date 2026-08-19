## ADDED Requirements

### Requirement: Worktree child runtime lifecycle ownership

The worktree instance manager SHALL register every child runtime at creation in a
launching→ready→closing→closed registry. `close()` SHALL seal new admissions first, then await the
settlement of every launching and ready runtime, and a runtime that becomes ready after close SHALL
NOT be registered or left running. Each worktree child SHALL publish the address its server
actually bound, and the manager SHALL register that actual address as the sole endpoint.

#### Scenario: Close during launch owns the pending runtime

- **WHEN** `close()` is called while a child runtime is still launching
- **THEN** the manager SHALL stop that runtime and complete close without leaving a running child
- **AND** a late ready signal from that runtime SHALL be rejected instead of re-registered

#### Scenario: Registered endpoint is the bound address

- **WHEN** a worktree child becomes ready
- **THEN** the manager SHALL register the worker-reported bound address
- **AND** SHALL NOT register any pre-probed expected address that differs from it

### Requirement: Handoff diagnostics evidence

Worktree child startup and shutdown SHALL emit structured stage diagnostics covering runtime id,
transport, watcher flag, candidate and final port, per-stage timings, readiness probe count with
the last probe error, worker error/exit, and close outcome. Diagnostics SHALL NOT include
credentials or full request headers.

#### Scenario: Readiness timeout names the slow stage

- **WHEN** a worktree child fails to become ready within the budget
- **THEN** the thrown error context SHALL include the emitted stage timings and last probe error
- **AND** the logs SHALL show which lifecycle stage never completed

### Requirement: Windows process-topology test isolation

Root-level tests that read the Windows process table or terminate real process trees SHALL run in
a dedicated vitest project with file-level serialization and a single worker, and Win32 process
snapshot reads SHALL be serialized behind one in-flight guard so concurrent tests cannot stampede
WMI.

#### Scenario: Supervisor tests do not overlap

- **WHEN** the root vitest suite runs the process-supervisor and CLI-runner diagnostic tests
- **THEN** their process-table snapshots and tree terminations execute serially
- **AND** no vitest retry mechanism is introduced to mask failures

### Requirement: Owned smoke-root cleanup settles Windows locks

The installed-CLI smoke cleanup SHALL verify and log daemon identity, PID clearance, and
process-tree exit before deleting its owned temporary root, and the deletion SHALL use a bounded
EBUSY/EACCES/EPERM backoff. On backoff exhaustion the failure SHALL report the root path,
ownership state, lifecycle evidence, and the final error instead of rerunning smoke commands.

#### Scenario: EBUSY during owned-root removal

- **WHEN** the owned smoke root deletion hits `EBUSY` after a verified daemon stop
- **THEN** cleanup retries within the bounded Windows lock-release budget
- **AND** exhaustion fails with the ownership and lifecycle report attached

### Requirement: Teardown failures are visible

Server-package Windows CI SHALL NOT discard unhandled teardown errors; a teardown failure SHALL
fail the suite with the structured diagnostics attached rather than passing silently.

#### Scenario: Worker teardown crash surfaces

- **WHEN** a vitest fork worker exits unexpectedly during suite teardown on hosted Windows
- **THEN** the suite fails and the report includes the unhandled error
