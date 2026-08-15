<!--
Orthogonal intents (created 2026-08-15 Asia/Shanghai):
1. Preserve source-distinct CLI failure and Agent filesystem evidence in OpenSpecUI 9.
2. Prevent static or last-known-good projections from fabricating live success.

Original request (2026-08-15): "给出可靠的升级计划。"
-->

## MODIFIED Requirements

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

## ADDED Requirements

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
