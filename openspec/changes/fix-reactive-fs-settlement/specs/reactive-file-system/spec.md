<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. Spec delta: silent event loss is settled by re-reading from disk, scoped honestly and bounded by one
   stated cadence.
2. Keep the existing missing-path fallback and the native event path intact.

Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
-->

## MODIFIED Requirements

### Requirement: Watcher Reliability

The reactive file system SHALL handle watcher availability without crashing, and SHALL converge to
on-disk truth even when a native change event is lost. Settlement SHALL be performed by re-reading from
disk — never by trusting a watcher library's loss-query as the record of what changed — and SHALL be
owned by the reactive file system rather than by whichever consumer notices.

The guarantee is scoped: a read is covered while it is registered and its containing root is leased.
Convergence SHALL be bounded by the settlement cadence plus jitter and pass duration, excluding the
consumer's own recompute and emit latency; there is no faster bound. A subscription that is memoized past
both the watcher pool and the observation environment may see a first frame up to one cadence stale.
Reads nobody leased, and reads whose recorded normalized path went stale because the symlink structure of
its prefix changed after registration, are outside the guarantee.

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
- **THEN** the projection SHALL converge to the created file within the settlement cadence plus its
  jitter and pass duration
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
