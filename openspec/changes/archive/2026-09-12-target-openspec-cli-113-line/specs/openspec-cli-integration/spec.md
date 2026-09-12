<!--
Orthogonal intents (created 2026-09-12 Asia/Shanghai):
1. Advance the CLI admission window to the OpenSpecUI 13 line.
2. Add the Apply Readiness Guidance typed contract (missingPrerequisites + warnings).

Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
-->

## MODIFIED Requirements

### Requirement: CLI Discovery and Version Enforcement

OpenSpecUI 13 SHALL classify stable OpenSpec CLI `>=1.13.0 <1.14.0` as supported, current, and recommended.
OpenSpec CLI `<1.13.0` (including the whole 1.12.x window that OpenSpecUI 12 admitted, and every older line),
every prerelease, `>=1.14.0`, and an unparseable version SHALL be incompatible and blocked by default.
When an incompatible executable is available, the mismatch Dialog MAY expose `Skip version check`; that action
SHALL bypass only the current Web page runtime's admission gate and SHALL NOT change the detected version,
compatibility evidence, CLI payloads, downstream errors, or product support claim.

#### Scenario: Accept the current 1.13 line

- **GIVEN** OpenSpecUI 13 detects a stable OpenSpec CLI 1.13.x executable
- **WHEN** admission is evaluated
- **THEN** normal interactions SHALL be admitted
- **AND** compatibility evidence SHALL identify the CLI as current and recommended

#### Scenario: Block unsupported version forms

- **GIVEN** OpenSpecUI 13 detects CLI 1.13.0-rc.1, 1.14.0, or an unparseable version
- **WHEN** admission is evaluated
- **THEN** the mismatch Dialog SHALL block normal interactions
- **AND** the mismatch evidence SHALL name the accepted and recommended ranges

#### Scenario: Retire the v12 admission window

- **GIVEN** OpenSpecUI 13 detects a stable OpenSpec CLI 1.12.x executable that OpenSpecUI 12 admitted
- **WHEN** admission is evaluated
- **THEN** the retired line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v13 accepted range `>=1.13.0 <1.14.0` and recommended range
  `>=1.13.0 <1.14.0`

#### Scenario: Accept the current 1.12 line

- **GIVEN** OpenSpecUI 13 detects a stable OpenSpec CLI 1.12.x executable that OpenSpecUI 12 admitted as its
  current and recommended line
- **WHEN** admission is evaluated
- **THEN** the retired 1.12 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v13 accepted and recommended ranges

#### Scenario: Retire the v11 admission window

- **GIVEN** OpenSpecUI 13 detects a stable OpenSpec CLI 1.10.x or 1.11.x executable that OpenSpecUI 11
  admitted
- **WHEN** admission is evaluated
- **THEN** the retired line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v13 accepted and recommended ranges

#### Scenario: Accept the supported non-current 1.10 line

- **GIVEN** OpenSpecUI 13 detects a stable OpenSpec CLI 1.10.x executable that OpenSpecUI 11 admitted as its
  supported non-current line
- **WHEN** admission is evaluated
- **THEN** the retired 1.10 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v13 accepted and recommended ranges

#### Scenario: Accept the current 1.11 line

- **GIVEN** OpenSpecUI 13 detects a stable OpenSpec CLI 1.11.x executable that OpenSpecUI 11 admitted as its
  current and recommended line
- **WHEN** admission is evaluated
- **THEN** the retired 1.11 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v13 accepted and recommended ranges

#### Scenario: Accept the supported non-current 1.8 line

- **GIVEN** OpenSpecUI 13 detects a stable OpenSpec CLI 1.8.x executable that OpenSpecUI 9 admitted as its
  supported non-current line
- **WHEN** admission is evaluated
- **THEN** the retired 1.8 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v13 accepted and recommended ranges

#### Scenario: Accept the current 1.9 line

- **GIVEN** OpenSpecUI 13 detects a stable OpenSpec CLI 1.9.x executable that OpenSpecUI 9 admitted as its
  current and recommended line
- **WHEN** admission is evaluated
- **THEN** the retired 1.9 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v13 accepted and recommended ranges

#### Scenario: Accept the adapted 1.7 line

- **GIVEN** OpenSpecUI 13 detects a stable OpenSpec CLI 1.7.x executable that OpenSpecUI 7 admitted as its adapted
  line
- **WHEN** admission is evaluated
- **THEN** the retired 1.7 line SHALL remain blocked by default
- **AND** the mismatch evidence SHALL name the v13 accepted and recommended ranges

#### Scenario: Block OpenSpec CLI 1.6

- **GIVEN** OpenSpecUI 13 detects an available OpenSpec CLI 1.6.x executable
- **WHEN** admission is evaluated
- **THEN** the mismatch Dialog SHALL block normal interactions
- **AND** SHALL identify the v13 accepted and recommended ranges

#### Scenario: Bypass only the current page runtime

- **GIVEN** an available incompatible executable is blocked
- **WHEN** the user explicitly selects `Skip version check`
- **THEN** the current Web page runtime MAY admit interactions at the user's risk
- **AND** compatibility evidence SHALL remain incompatible
- **AND** downstream protocol or execution failures SHALL remain visible
- **WHEN** the page runtime is reconstructed, refreshed, or reopened
- **THEN** the bypass SHALL be absent and the mismatch Dialog SHALL block again

#### Scenario: Never persist the bypass

- **WHEN** a version bypass is active
- **THEN** browser storage, Workspace state, project configuration, Server state, and exported snapshots SHALL NOT
  contain it

#### Scenario: Bypass does not admit a version-specific capability or inventory

- **GIVEN** an unsupported, prerelease, or unparseable CLI has a page-local version bypass
- **WHEN** OpenSpecUI derives CLI capabilities or an Agent delivery inventory
- **THEN** it SHALL retain the incompatible classification
- **AND** it SHALL NOT select line-specific capability facts or a fallback inventory
- **AND** downstream execution SHALL fail through its typed availability boundary rather than a simulated
  supported CLI

## ADDED Requirements

### Requirement: Apply Readiness Guidance Contract

OpenSpecUI 13 SHALL decode the OpenSpec 1.13 Apply Instructions optional `missingPrerequisites` and `warnings`
members as typed contract facts. `missingPrerequisites` SHALL be preserved as the CLI-owned build-order
closure of incomplete artifacts and MAY be non-empty while `state` is `ready` (conditional artifacts apply
does not gate on); it SHALL NOT redefine the apply state, the actionable `tasks` list, or CLI progress
denominators. `warnings` SHALL be preserved verbatim as CLI-owned advisory evidence and SHALL only be
projected from a parsed payload; OpenSpecUI SHALL NOT synthesize, deduplicate, or reword a warning.

#### Scenario: Blocked change preserves the prerequisite chain

- **GIVEN** Apply Instructions on an admitted 1.13 CLI report `state: blocked` with
  `missingArtifacts: [tasks]` and `missingPrerequisites: [proposal, specs, design, tasks]`
- **WHEN** the payload crosses the typed contract
- **THEN** both arrays SHALL be preserved with CLI provenance
- **AND** the blocked state and first-hop `missingArtifacts` SHALL remain the gating facts

#### Scenario: Ready change may carry unread prerequisites

- **GIVEN** Apply Instructions report `state: ready` with `missingPrerequisites: [specs, design]`
- **WHEN** the payload is projected
- **THEN** the ready state SHALL remain unchanged
- **AND** the unread chain SHALL remain available as evidence
- **AND** it SHALL NOT relabel the change as blocked or planning-incomplete

#### Scenario: No-delta-specs warning is preserved verbatim

- **GIVEN** Apply Instructions report `warnings` containing the upstream no-delta-specs advisory
- **WHEN** the payload is projected
- **THEN** the warning text SHALL be preserved exactly as the CLI provided it
- **AND** OpenSpecUI SHALL NOT fabricate a warning when the field is absent

#### Scenario: Absent fields on older-shape payloads

- **GIVEN** an Apply Instructions payload omits `missingPrerequisites` or `warnings` (empty upstream values)
- **WHEN** the payload crosses the typed contract
- **THEN** parsing SHALL succeed with both facts absent
- **AND** no default empty-array presentation SHALL be invented as CLI evidence

#### Scenario: Remedies text is not pattern-matched

- **GIVEN** an admitted 1.13 CLI apply instruction prose names `openspec instructions <artifact>` remedies
  instead of the `openspec-continue-change` skill
- **WHEN** OpenSpecUI captures instruction prose in an evidence surface
- **THEN** it SHALL treat the text as opaque CLI evidence
- **AND** SHALL NOT pattern-match the retired 1.12 skill reference
