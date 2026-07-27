<!--
Orthogonal intents (created 2026-07-23 Asia/Shanghai):
1. Preserve the completed live-projection performance contract as durable product truth.
2. Define provenance, freshness, and authority boundaries for Server-owned projection work.
3. Require independently observable progressive delivery for live projection surfaces.
4. Bound demand-driven resource use and make optional optimization evidence-led.

Original request (2026-07-23): "请你深入调查，给出一份持有客观证据的调查报告，并给出‘系统性的解决方案’，并将它整理成 openspec change。"
-->

# live-projection-work Specification

## Purpose

Define the durable contract for Server-owned live projection work so responsive surfaces preserve provenance, currentness, progressive delivery, and bounded resource use through root and binding transitions.

## Requirements

### Requirement: Provenance-Bound Projection Work Identity

The system SHALL create Server-owned live Projection Work using an identity that includes projection kind, planning-root identity and source, effective Store selector, owner generation or Git binding token where applicable, explicit selector, input fingerprint or invalidation generation, and protocol version.

#### Scenario: Same current input shares in-flight work

- **GIVEN** two subscribers request the same projection identity while the active owner generation is current
- **WHEN** the first projection calculation is running
- **THEN** the second subscriber SHALL join the same bounded in-flight work
- **AND** the system SHALL NOT duplicate its owner leaf calculation

#### Scenario: Root or binding transition changes identity

- **GIVEN** a Projection Work for root or binding A is running or cached
- **WHEN** Root, Store, owner generation, Git binding token, selector, input fingerprint, or protocol version changes to B
- **THEN** the system SHALL treat B as a different Projection Work identity
- **AND** SHALL NOT reuse, relabel, or authorize A as B

### Requirement: Snapshot Freshness Does Not Grant Authority

The system SHALL distinguish a provenance-bearing display snapshot from a current snapshot that may authorize a read-after-check operation.

#### Scenario: Retain stale display during revalidation

- **GIVEN** a previously current Projection Work snapshot exists
- **WHEN** its subscription reconnects, refreshes, or begins a replacement generation
- **THEN** the UI MAY retain the prior snapshot for display
- **AND** root-dependent mutation authority SHALL remain locked until a replacement current snapshot arrives

#### Scenario: Retire late work publication

- **GIVEN** A Projection Work is retired by a current B generation
- **WHEN** A later emits a snapshot, stage, batch, completion, error, or invalidation effect
- **THEN** A SHALL NOT modify B state, cache, progress, invalidation, or authority
- **AND** any retained diagnostic evidence SHALL remain attributed to A

### Requirement: Observable Progressive Projection Delivery

The system SHALL emit real projection lifecycle evidence for current work and allow independently owned page regions to render when their own stable facts arrive.

#### Scenario: Emit real work phases

- **GIVEN** a live Projection Work is requested
- **WHEN** it starts, joins cached state, settles an owner leaf, emits a batch, completes, fails, or is cancelled
- **THEN** the system SHALL expose the corresponding typed snapshot, stage, batch, completion, or failure evidence with a monotonic Work generation
- **AND** SHALL NOT infer a phase only from a spinner or page copy

#### Scenario: Slow optional fact does not hide stable sibling

- **GIVEN** one page region has a current stable projection and a sibling projection is pending or fails
- **WHEN** the page renders
- **THEN** the stable region SHALL remain visible with its own freshness state
- **AND** the slow or failed region SHALL present only its own loading or error state

### Requirement: Bounded Demand-Driven Projection Resources

The system SHALL schedule Projection Work with bounded resource classes and shall start optional work only when a requesting surface or explicitly bounded background policy requires it.

#### Scenario: Foreground work is not starved by warmup

- **GIVEN** optional schema, artifact, Apply, trend, or warmup work is pending
- **WHEN** a foreground projection for the same constrained CLI, filesystem, Git, or CPU resource class arrives
- **THEN** the scheduler SHALL apply its configured bound and foreground priority
- **AND** optional work SHALL yield or be cancelled when required to preserve that bound

#### Scenario: Status does not require unrelated warmup

- **GIVEN** an OPSX surface requests only change status
- **WHEN** unrelated Schema, template, Apply Instruction, or artifact-output work is slow
- **THEN** the status projection SHALL be independently deliverable
- **AND** the system SHALL preserve the typed CLI evidence associated with each requested status result

### Requirement: Measured Optional Cache And Worker Adoption

The system SHALL add content fingerprints, persistence, or Worker execution only after measurement establishes a positive benefit and the resulting cache or worker has explicit bounded validity and resource rules.

#### Scenario: Cache input no longer matches

- **GIVEN** a pure projection cache entry exists
- **WHEN** its content fingerprint, root/store provenance, selector, invalidation generation, or protocol version no longer matches
- **THEN** the system SHALL miss or retire the entry
- **AND** SHALL recompute through the current Projection Work identity

#### Scenario: Non-eligible work remains outside Workers and persistence

- **GIVEN** work invokes CLI, Git, reactive filesystem I/O, carries raw diagnostics, absolute paths, environment data, authentication information, or mutation authority
- **WHEN** the system evaluates a Worker or persistent-cache optimization
- **THEN** it SHALL reject that work unless a separately approved contract makes it revalidatable and non-sensitive
- **AND** SHALL retain its existing I/O and authority boundary
