<!--
Orthogonal intents (created 2026-07-23 Asia/Shanghai):
1. Specify runtime validation for browser-visible hosted projection envelopes.
2. Specify static provenance that does not fabricate backend CLI execution evidence.
3. Specify physical/reactive settlement for reusable projection inputs.

Original request (2026-07-23): "走查任务直接到新的change中做。你目前的工作就是：review + interview + replan(write new openspec change)"
Original request (2026-07-15): "操作成功底层是要推送变更的，然后让多端基于订阅拉取更新。"
-->

# projection-contract-truth Specification

## Purpose

Define runtime-validated browser projection envelopes, truthful static provenance, and physical/reactive settlement
for reusable projection inputs.

## Requirements

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

The static provider SHALL preserve published source and policy facts without synthesizing CLI success, exit code,
stdout, stderr, transport, live root, or live mutation evidence. When an export captured a Schema-resolution
failure, it SHALL preserve that historical CLI fact as a typed failed observation containing the CLI source, selected
Root selector and resolved root availability, diagnostics, stdout, stderr, exit code, payload, and contract error
where supplied. Live and static source-aware catalog mapping SHALL share one browser-safe representation where their
real facts overlap.

#### Scenario: Included static Reference source remains static provenance

- **GIVEN** a static export includes a Reference source according to snapshot policy
- **WHEN** the static provider renders its catalog provenance
- **THEN** it SHALL expose the actual published source/policy state
- **AND** it SHALL carry no fabricated live CLI execution result
- **AND** it SHALL NOT grant live mutation authority

#### Scenario: Omitted or unavailable static catalog preserves only its published policy fact

- **GIVEN** a static snapshot records `omit`, `none`, or has no Reference-policy inventory
- **WHEN** the static provider renders the Referenced Spec List
- **THEN** it SHALL render the exact published omission, absence, or unavailable-inventory condition
- **AND** it SHALL NOT rewrite that condition as a live empty/current Reference observation
- **AND** it SHALL NOT invent per-Store source identity, diagnostics, or execution evidence

#### Scenario: Unrecorded Store route identity does not become published provenance

- **GIVEN** a static Referenced Spec route names a Store but the applicable snapshot fact retains no Store identity
- **WHEN** the static Spec detail renders its unavailable condition
- **THEN** it SHALL describe only the snapshot condition
- **AND** it SHALL NOT label the route Store as a published/observed Reference Store
- **AND** it SHALL carry no fabricated live execution result

#### Scenario: Captured static Schema failure retains the complete CLI observation

- **GIVEN** static export captured a Schema-resolution failure
- **WHEN** any static Config or Schema access path consumes that capture
- **THEN** it SHALL preserve CLI source, Root/selector availability, diagnostics, stdout, stderr, exit code, payload,
  and contract error where supplied
- **AND** it SHALL identify the result as a captured failure rather than a current live observation

#### Scenario: A failed static Schema capture cannot become an empty catalog

- **GIVEN** a static snapshot contains a failed Schema capture
- **WHEN** a list-only or detail Config path reads schemas
- **THEN** that path SHALL propagate the typed captured failure
- **AND** SHALL NOT return a successful empty Schema array, synthesize fallback details, or grant mutation authority

#### Scenario: Every static Schema accessor propagates one captured failure

- **GIVEN** a static snapshot contains a failed Schema capture
- **WHEN** list, bundle, detail, resolution, template, file, YAML, or template-content access is requested
- **THEN** every accessor SHALL propagate the same typed captured failure boundary
- **AND** SHALL NOT return `null`, empty text, `[]`, or partial Schema data as a successful result

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

### Requirement: CLI Resolution Failure Retains Its Source

When a supported OpenSpec CLI returns a typed Schema-resolution or archived-validation failure, OpenSpecUI SHALL
preserve its CLI source, selector, diagnostics, root availability, stdout, stderr, exit code, payload, contract
error, and refresh state distinctly from last-known-good data. It SHALL NOT convert the failure into an empty
successful projection.

#### Scenario: Cached schemas survive a new root failure

- **GIVEN** Config has a prior successful schema projection
- **AND** a later `schemas --json` result is a selected-Root failure envelope
- **WHEN** the projection refreshes
- **THEN** the prior schema list MAY remain readable as stale display data
- **AND** the new Root failure SHALL be visible as current CLI evidence
- **AND** stale display data SHALL not authorize Config mutation

### Requirement: Static Projection Does Not Invent v9 Runtime Evidence

Static exports MAY include captured v9 compatibility or policy facts but SHALL NOT synthesize live Schema
resolution, archived validation, archive retirement, or global Agent filesystem observations.

#### Scenario: Static archive evidence is absent

- **GIVEN** a static export contains no captured archived-validation result
- **WHEN** Change Evidence renders
- **THEN** it SHALL identify the evidence as unavailable in the static snapshot
- **AND** SHALL NOT display a fabricated pass, failure, root, or Agent repair state
