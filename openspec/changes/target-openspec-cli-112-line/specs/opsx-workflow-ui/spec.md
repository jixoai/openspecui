<!--
Orthogonal intents (created 2026-09-03 Asia/Shanghai):
1. Advance the pinned executable fixture requirement to the OpenSpecUI 12 line with split positive/boundary
   fixture roles.
2. Add the validation findings evidence surface requirement.

Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
-->

## MODIFIED Requirements

### Requirement: Pinned Workflow Fixtures Are Executable

OpenSpecUI SHALL prove each accepted workflow contract against the pinned OpenSpec 1.12.0 executable, and
SHALL prove capability-boundary rejections with the retained pinned OpenSpec 1.11.0 executable. A
hand-authored payload alone SHALL NOT establish support for the CLI line, and a fixture for a retired line
SHALL NOT be reused as positive evidence for the current line.

#### Scenario: Both supported lines preserve planning/task separation

- **GIVEN** the pinned workflow fixture matrix runs against the retained pair of pinned executables
  (OpenSpec 1.12.0 as the positive line and OpenSpec 1.11.0 as the boundary line)
- **WHEN** it evaluates Status and Apply Instructions on the positive line
- **THEN** the 1.12.0 executable SHALL satisfy the typed planning-completion and progress contracts
- **AND** the boundary executable SHALL NOT be consulted for positive contract evidence

#### Scenario: Capability boundaries are executable facts

- **GIVEN** the retained pinned 1.11.0 executable receives `validate --report findings`
- **WHEN** the fixture matrix asserts the capability boundary
- **THEN** the rejection SHALL be recorded as the findings-capability boundary evidence
- **AND** the 1.12.0 executable SHALL prove the findings payloads

## ADDED Requirements

### Requirement: Validation Findings Evidence Surface

The validation evidence surface SHALL render a findings document with its CLI provenance, showing the filtered
item findings with `INFO` presented as an informational class distinct from warnings and errors, and the
preserved full-run totals. It SHALL identify the findings view as filtered (`returnedItems` of `totalItems`)
rather than presenting it as the complete validation result.

#### Scenario: The filtered view is labeled honestly

- **GIVEN** a findings document reports `returnedItems: 1` of `totalItems: 5`
- **WHEN** the findings evidence renders
- **THEN** the surface SHALL show both counts with CLI provenance
- **AND** SHALL NOT present the filtered set as the complete validation result

#### Scenario: Informational findings render distinctly

- **GIVEN** an item carries `INFO` merge-conflict advisory findings while remaining valid
- **WHEN** the findings evidence renders
- **THEN** the findings SHALL appear as informational items, not warnings
- **AND** the item's validity SHALL remain presented as the CLI reported it
