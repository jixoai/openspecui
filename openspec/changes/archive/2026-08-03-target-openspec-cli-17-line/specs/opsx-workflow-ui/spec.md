<!--
Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
1. Define skipped artifact and operation-instruction presentation.
2. Expand Agent delivery detection and management to the OpenSpec 1.7 protocol.

Original request (2026-08-01): adapt the complete observable OpenSpec 1.7 workflow and Agent protocol in OpenSpecUI 7.
-->

# Delta for opsx-workflow-ui

## MODIFIED Requirements

### Requirement: CLI-Driven Artifact Status

Artifact state SHALL preserve OpenSpec 1.7 `done`, `ready`, `blocked`, and `skipped` values plus exact dependency
arrays. `skipped` SHALL be dependency-satisfied but SHALL NOT imply a physical artifact or completed work.

#### Scenario: Render an intentionally skipped artifact

- **GIVEN** Status reports `status: skipped`
- **WHEN** the Change workflow is rendered
- **THEN** the artifact SHALL be identified as intentionally skipped
- **AND** SHALL NOT expose Create, Edit, or missing-file actions
- **AND** dependent ready artifacts SHALL remain actionable when all other requirements are satisfied

### Requirement: CLI-Driven Artifact Instructions

Workflow actions SHALL consume the exact selected-Root instruction contract for artifacts, Apply, and Archive.

#### Scenario: Compose Apply with runtime inputs

- **WHEN** Apply is invoked
- **THEN** the Agent/CLI composition SHALL include CLI-provided project `context` and Apply `operationGuidance`
- **AND** preserve their provenance separately from artifact rules

#### Scenario: Compose Archive with runtime inputs

- **WHEN** Archive is invoked
- **THEN** the action SHALL first consume Archive Instructions for the selected Root
- **AND** include CLI-provided `context` and Archive `operationGuidance`
- **AND** SHALL NOT substitute Status evidence

### Requirement: Skills-Based Tool Detection

Agent integration detection SHALL model OpenSpec 1.7 delivery capabilities and physical artifacts rather than
assuming every tool has the same skills and command layout.

#### Scenario: Detect Codex skills-only delivery

- **GIVEN** OpenSpec-managed Codex skills are current and no managed Codex command artifacts exist
- **WHEN** Agent state is projected
- **THEN** Codex SHALL be initialized and current for skills-only delivery
- **AND** missing command files SHALL NOT create a partial state

#### Scenario: Report migration and cleanup

- **GIVEN** OpenSpec-managed artifacts remain in a retired or renamed tool location
- **WHEN** Agent state is projected
- **THEN** the UI SHALL identify the exact migration/cleanup requirement
- **AND** SHALL NOT delete artifacts until the official CLI operation is explicitly executed

#### Scenario: Preserve complete 1.7 inventory

- **WHEN** the Agent registry is listed
- **THEN** CodeArts Agent, Hermes, ZCode, Devin alias behavior, Qwen Markdown command format, and all other official
  1.7 tools SHALL preserve their declared capability and physical metadata
