<!--
Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
1. Replace the temporary 6.1 compatibility bridge with the OpenSpecUI 7 / CLI 1.7 contract.
2. Specify 1.7 workflow runtime inputs and project initialization command ownership.

Original request (2026-08-01): OpenSpecUI 7 supports only OpenSpec CLI 1.7.x, with an explicit session-only bypass for other available versions.
Owner initialization decision (2026-08-01): Initialize Project executes `openspec init --tools=none` only after explicit confirmation.
-->

# Delta for openspec-cli-integration

## MODIFIED Requirements

### Requirement: CLI Discovery and Version Enforcement

OpenSpecUI 7 SHALL classify only OpenSpec CLI `>=1.7.0 <1.8.0` as supported and adapted. Every other detected
version SHALL be incompatible and blocked by default. When an incompatible executable is available, the mismatch
Dialog MAY expose `Skip version check`; that action SHALL bypass only the current Web page runtime's admission gate
and SHALL NOT change the detected version, compatibility evidence, CLI payloads, downstream errors, or product
support claim.

#### Scenario: Accept the adapted 1.7 line

- **GIVEN** OpenSpecUI 7 detects OpenSpec CLI `>=1.7.0 <1.8.0`
- **WHEN** admission is evaluated
- **THEN** normal interactions SHALL be admitted
- **AND** no version mismatch Dialog SHALL be shown

#### Scenario: Block OpenSpec CLI 1.6

- **GIVEN** OpenSpecUI 7 detects an available OpenSpec CLI 1.6.x executable
- **WHEN** admission is evaluated
- **THEN** the mismatch Dialog SHALL block normal interactions
- **AND** SHALL identify 1.7.x as the required line

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

### Requirement: OPSX Command Mapping

OpenSpecUI SHALL map workflow actions and project setup to official OpenSpec 1.7 commands with exact selected-Root
or Launch Project ownership.

#### Scenario: Request Apply Instructions with runtime inputs

- **GIVEN** an active Change and current selected Root
- **WHEN** Apply guidance is requested
- **THEN** OpenSpecUI SHALL execute `openspec instructions apply --change <id> --json` with the current Root selector
- **AND** preserve CLI-provided `context`, `operationGuidance`, `contextFiles`, and Root evidence as typed facts

#### Scenario: Request Archive Instructions

- **GIVEN** an active Change and current selected Root
- **WHEN** Archive guidance is requested
- **THEN** OpenSpecUI SHALL execute `openspec instructions archive --change <id> --json` with the current Root selector
- **AND** preserve CLI-provided `context`, `operationGuidance`, and Root evidence
- **AND** SHALL NOT derive Archive input from Status or artifact rules

#### Scenario: Initialize only the Launch Project

- **GIVEN** the Launch Project has no local OpenSpec initialization
- **WHEN** the user explicitly confirms Initialize Project
- **THEN** OpenSpecUI SHALL execute `openspec init <launch-project> --tools=none`
- **AND** SHALL NOT target an external Active Root or Store
- **AND** SHALL NOT select, install, migrate, or clean Agent artifacts
- **AND** SHALL stream command and final settlement evidence

## ADDED Requirements

### Requirement: OpenSpec 1.7 Workflow Contract

OpenSpecUI SHALL preserve the complete observable OpenSpec 1.7 Status and operation-instruction contracts without
re-parsing OpenSpec files to invent missing facts.

#### Scenario: Preserve skipped artifacts

- **GIVEN** Status reports an artifact with `status: skipped` and `requires`
- **WHEN** workflow state is projected
- **THEN** the artifact SHALL satisfy downstream dependencies
- **AND** SHALL NOT be presented as done, ready, blocked, missing, or a physical output file

#### Scenario: Keep operation guidance separate

- **GIVEN** project configuration contains artifact rules and operation guidance
- **WHEN** Apply or Archive Instructions are projected
- **THEN** `operationGuidance` SHALL remain operation input
- **AND** artifact `rules` SHALL remain artifact-creation input
- **AND** neither SHALL be synthesized from the other
