<!--
Orthogonal intents (created 2026-08-15 Asia/Shanghai):
1. Preserve source-distinct CLI failure and Agent filesystem evidence in OpenSpecUI 9.
2. Prevent static or last-known-good projections from fabricating live success.

Original request (2026-08-15): "给出可靠的升级计划。"
-->

## ADDED Requirements

### Requirement: CLI Resolution Failure Retains Its Source

When a supported OpenSpec CLI returns a typed Schema-resolution or archived-validation failure, OpenSpecUI SHALL
preserve its CLI source, diagnostics, root availability, and refresh state distinctly from last-known-good data. It
SHALL NOT convert the failure into an empty successful projection.

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
