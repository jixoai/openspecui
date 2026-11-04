<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. Spec delta: silent event loss is settled, not merely documented.
2. Keep the existing missing-path fallback and its bounds intact.

Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
-->

## MODIFIED Requirements

### Requirement: Watcher Reliability

The reactive file system SHALL handle watcher availability without crashing, and SHALL converge to
on-disk truth even when a native change event is lost. A lost event SHALL NOT leave a projection
stale indefinitely: settlement is owned by the reactive file system, not by whichever consumer
happens to notice.

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

#### Scenario: Silent event loss converges without a second change

- **GIVEN** a retained projection observes a directory and the native watchers stop delivering events
- **WHEN** a file is created in that directory and no other change occurs
- **THEN** the projection SHALL converge to the created file within the reconciliation cadence
- **AND** convergence SHALL NOT require the consumer to re-subscribe, refresh, or restart

#### Scenario: Settlement follows every (re)arm

- **GIVEN** a cached read under a physical root holds a value that predates the current watch
- **WHEN** that root's subscription is established or re-established
- **THEN** the cached read SHALL be re-read from disk
- **AND** the re-read SHALL NOT emit when the on-disk value is unchanged

#### Scenario: The query API is a detector, never ground truth

- **GIVEN** the reconciliation pass queries the watcher library for changes since its snapshot
- **WHEN** the query fails or returns a batch beyond the configured ceiling
- **THEN** its result SHALL NOT be applied as data
- **AND** the pass SHALL escalate to re-arming the subscription and re-reading from disk

#### Scenario: Reconciliation cost stays pooled and bounded

- **GIVEN** the process holds retained observation leases
- **WHEN** reconciliation runs
- **THEN** it SHALL use one pooled interval for the whole process, unref'd so it cannot hold the
  process open
- **AND** a pass over a root with no cached reads SHALL perform no filesystem reads
- **AND** the existing one-shot projection path SHALL start no interval at all
