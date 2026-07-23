<!--
Orthogonal intents (created 2026-07-23 Asia/Shanghai):
1. Specify runtime validation for browser-visible hosted projection envelopes.
2. Specify static provenance that does not fabricate backend CLI execution evidence.
3. Specify physical/reactive settlement for reusable projection inputs.

Original request (2026-07-23): "走查任务直接到新的change中做。你目前的工作就是：review + interview + replan(write new openspec change)"
Original request (2026-07-15): "操作成功底层是要推送变更的，然后让多端基于订阅拉取更新。"
-->

# projection-contract-truth Delta Specification

## ADDED Requirements

### Requirement: Runtime-Validated Hosted Projection Boundary

The system SHALL decode every browser-visible hosted health, Store, Root Context, and mutation envelope
through browser-safe shared schemas before projecting it into typed state. A malformed envelope SHALL
remain contract/transport evidence and MUST NOT be asserted as available data, Root authority, Store
result, or mutation terminal truth.

#### Scenario: Malformed backend payload does not become typed projection data

- **GIVEN** a hosted HTTP or RPC response has a successful transport status but violates its published schema
- **WHEN** the App decodes the response
- **THEN** it SHALL surface a typed contract failure
- **AND** it SHALL NOT expose the payload as an available Store, Root Context, health, or mutation record

### Requirement: Static Projection Has No Live Execution Evidence

The static provider SHALL preserve published source and policy facts without synthesizing CLI success,
exit code, stdout, stderr, transport, live root, or live mutation evidence. Live and static source-aware
catalog mapping SHALL share one browser-safe representation where their real facts overlap.

#### Scenario: Included static Reference source remains static provenance

- **GIVEN** a static export includes a Reference source according to snapshot policy
- **WHEN** the static provider renders its catalog provenance
- **THEN** it SHALL expose the actual published source/policy state
- **AND** it SHALL carry no fabricated live CLI execution result
- **AND** it SHALL NOT grant live mutation authority

### Requirement: Reactive Projection Input Settlement

The system SHALL perform data-bearing writes that invalidate reusable projections through the shared
physical/reactive write path and SHALL settle reactive file/directory/existence/stat state before reporting
the write complete to a dependent projection. Native unobserved filesystem I/O MUST NOT be the sole
commit path for a reactive projection input.

#### Scenario: Git refresh input settles before projection reads it

- **GIVEN** a user requests a Dashboard Git refresh
- **WHEN** the Server writes the refresh input
- **THEN** the shared physical/reactive writer SHALL settle the observed input before a dependent Git
  projection treats the request as current
- **AND** a removed settlement transition SHALL cause the focused invalidation proof to fail
