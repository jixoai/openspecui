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
The reactive file system SHALL handle watcher availability without crashing.

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

### Requirement: Event Coalescing
The reactive file system SHALL coalesce rapid change events to avoid update storms.

#### Scenario: Burst file changes
- **GIVEN** multiple file changes occur in quick succession
- **WHEN** the system receives change events
- **THEN** the system SHALL debounce or batch updates
- **AND** clients SHALL receive a single consolidated update

