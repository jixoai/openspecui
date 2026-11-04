# reactive-file-system Specification

## Purpose

Define the reactive file system behavior used by OpenSpecUI so file changes automatically propagate to server queries and UI subscriptions.

## Requirements

### Requirement: Reactive File Reads

OpenSpecUI SHALL read file-based data through reactive file system APIs.

#### Scenario: Read file content reactively

- **GIVEN** a spec file exists on disk
- **WHEN** the server reads the file for an API response
- **THEN** the system SHALL use `reactiveReadFile`
- **AND** the read operation SHALL register reactive dependencies for updates

#### Scenario: Read directory content reactively

- **GIVEN** a directory of specs exists
- **WHEN** the server enumerates specs
- **THEN** the system SHALL use `reactiveReadDir`
- **AND** updates to the directory SHALL trigger reactive invalidation

### Requirement: Reactive Existence and Stat Queries

OpenSpecUI SHALL use reactive existence and stat checks for file-based data.

#### Scenario: Check file existence reactively

- **GIVEN** a file may be created or deleted
- **WHEN** the server checks for its existence
- **THEN** the system SHALL use `reactiveExists`
- **AND** changes SHALL trigger reactive invalidation

#### Scenario: Read file metadata reactively

- **GIVEN** a file's metadata may change
- **WHEN** the server reads metadata for timestamps
- **THEN** the system SHALL use `reactiveStat`
- **AND** changes SHALL trigger reactive invalidation

### Requirement: Query + Subscription Pairing

Every file-based query SHALL have a corresponding reactive subscription.

#### Scenario: Provide a reactive subscription

- **GIVEN** a query returns file-based data
- **WHEN** a client subscribes for updates
- **THEN** the server SHALL use `createReactiveSubscription` to emit updates
- **AND** the subscription SHALL re-run the same reactive query function

#### Scenario: Emit updates after file changes

- **GIVEN** a subscription is active
- **WHEN** a dependent file changes
- **THEN** the subscription SHALL emit updated data automatically

### Requirement: Watcher Reliability

The reactive file system SHALL handle watcher availability without crashing, and SHALL converge to
on-disk truth even when a native change event is lost. Settlement SHALL be performed by re-reading from
disk — never by trusting a watcher library's loss-query as the record of what changed — and SHALL be
owned by the reactive file system rather than by whichever consumer notices.

The guarantee is scoped: a read is covered while it is **registered** — that is, while it holds a
`reactive-fs` cache registration (`file | directory | exists | stat`) — and its containing root is
leased. Consumers whose own state is driven by native events rather than by a registered read (a private
event-state cache, an invalidation-triggered CLI re-pull) are outside the guarantee and are listed as
such rather than implied by it.

Convergence SHALL be bounded by the settlement cadence plus jitter and pass duration, excluding the
consumer's own recompute and emit latency; there is no faster bound. A subscription memoized past the
watcher pool, the observation environment, or the owning service may see a first frame up to that same
bound stale. Reads nobody leased, and reads whose recorded normalized path went stale because the symlink
structure of its prefix changed after registration, are outside the guarantee.

#### Scenario: Watcher initialization failure

- **GIVEN** file watchers cannot initialize
- **WHEN** the system attempts reactive reads
- **THEN** reads SHALL still succeed
- **AND** the system SHALL continue without throwing fatal errors

#### Scenario: Watcher-driven updates

- **GIVEN** watchers are initialized
- **WHEN** files under `openspec/` change
- **THEN** reactive dependencies SHALL invalidate
- **AND** subscribed clients SHALL receive updates

#### Scenario: A silent loss converges without a second change

- **GIVEN** a registered read whose containing root holds a retained observation lease, and native
  events have stopped arriving for the observed directory
- **WHEN** a file is created there and nothing else in the subtree changes
- **THEN** the registered read SHALL be re-read within the settlement cadence plus its jitter and pass
  duration, and the projection that depends on it SHALL converge to the created file
- **AND** convergence SHALL NOT require the consumer to re-subscribe, refresh, or restart
- **AND** the same SHALL hold when the platform discards the notification without reporting an error

#### Scenario: Every arm and every attach settles

- **GIVEN** a cached read under a physical root holds a value that predates the current watch
- **WHEN** that root's subscription is established or re-established, or a logical root is acquired
  again where the observation environment already holds it, or a long-lived agent-delivery subscriber
  starts
- **THEN** the cached read SHALL be re-read from disk
- **AND** the re-read SHALL NOT emit when the on-disk value is unchanged
- **AND** requests arriving before a pass begins reading SHALL join it, while a request arriving later
  SHALL be served by a trailing pass rather than being discarded

#### Scenario: Settlement cost stays pooled and bounded

- **GIVEN** the process holds retained root leases
- **WHEN** settlement runs
- **THEN** it SHALL use one pooled interval for the whole process, unref'd so it cannot hold the process
  open, absent while no lease exists, and stopped when the last lease ends or the watcher pool is torn
  down
- **AND** its work SHALL be proportional to the registered reads under those leases, performing no
  filesystem access when none exist

#### Scenario: One-shot reads do not orphan a long-lived consumer

- **GIVEN** a retained projection and a one-shot read of the same root in the same process
- **WHEN** the one-shot read refreshes its inputs
- **THEN** it SHALL await a settlement of those inputs before reading, rather than discard cache
  registrations the retained projection depends on
- **AND** its read SHALL observe disk truth as of that settlement, and the retained projection SHALL
  remain observable to later settlements

### Requirement: Event Coalescing

The reactive file system SHALL coalesce rapid change events to avoid update storms.

#### Scenario: Burst file changes

- **GIVEN** multiple file changes occur in quick succession
- **WHEN** the system receives change events
- **THEN** the system SHALL debounce or batch updates
- **AND** clients SHALL receive a single consolidated update
