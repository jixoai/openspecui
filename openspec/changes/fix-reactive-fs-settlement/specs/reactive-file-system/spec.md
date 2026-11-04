<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. Spec delta: silent event loss is settled by re-reading from disk, and the promise is bounded by
   one stated cadence rather than an aspirational fast path.
2. Keep the existing missing-path fallback and the native event path intact.

Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
-->

## MODIFIED Requirements

### Requirement: Watcher Reliability

The reactive file system SHALL handle watcher availability without crashing, and SHALL converge to
on-disk truth even when a native change event is lost. Settlement SHALL be performed by re-reading
from disk — never by trusting a watcher library's loss-query as the record of what changed — and SHALL
be owned by the reactive file system rather than by whichever consumer notices. Convergence SHALL
therefore be bounded by one stated cadence for every loss class, including losses the underlying
platform discards without reporting.

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

- **GIVEN** a long-lived projection observes a directory and native events stop arriving
- **WHEN** a file is created in that directory and nothing else in the subtree changes
- **THEN** the projection SHALL converge to the created file within the settlement cadence
- **AND** convergence SHALL NOT require the consumer to re-subscribe, refresh, or restart
- **AND** the same guarantee SHALL hold when the platform discards the notification without reporting
  an error

#### Scenario: Settlement follows every (re)arm

- **GIVEN** a cached read under a physical root holds a value that predates the current watch
- **WHEN** that root's subscription is established or re-established
- **THEN** the cached read SHALL be re-read from disk
- **AND** the re-read SHALL NOT emit when the on-disk value is unchanged
- **AND** a root SHALL settle at most once per arm even when a consumer also requests settlement at
  its own start

#### Scenario: Settlement cost stays pooled and bounded

- **GIVEN** the process holds retained root leases
- **WHEN** settlement runs
- **THEN** it SHALL use one pooled interval for the whole process, unref'd so it cannot hold the
  process open
- **AND** its work SHALL be proportional to the cached reads under those leases, performing no
  filesystem access when none exist
- **AND** a projection that holds no retained lease SHALL create no interval at all
