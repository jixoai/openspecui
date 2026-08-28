<!--
Orthogonal intents (created 2026-08-28 Asia/Shanghai):
1. Define the Change Detail Evidence list-detail workspace topology.

Original request (2026-08-28): "使用移动端的 list-detail 思维……分成两栏，左侧 list，右侧详情。这种结构替代手风琴会更好"
-->

## ADDED Requirements

### Requirement: Change Evidence List-Detail Workspace

The Change Detail Evidence tab SHALL present its evidence sections through a
container-responsive list-detail workspace instead of stacked full-width accordions. The evidence
list SHALL preserve the established layering order (summary/paths, requirement diffs, archived
validation, CLI/raw payload), every list row SHALL be keyboard reachable, and row status chips
SHALL derive only from available evidence facts. The detail pane SHALL render the selected
section's content and remain the tab's primary reading surface. Sub-selection SHALL be
presentational runtime state of the Evidence tab and SHALL NOT persist in routes or browser
storage.

#### Scenario: Spacious container shows list and detail together

- **GIVEN** the Evidence tab renders in a container wide enough for two panes
- **WHEN** an evidence row is selected
- **THEN** the list and the selected section's detail SHALL be visible side by side
- **AND** each pane SHALL scroll independently without page-level horizontal overflow

#### Scenario: Crowded container drills from list to detail

- **GIVEN** the Evidence tab renders in a crowded container
- **WHEN** an evidence row is activated
- **THEN** the detail SHALL replace the list as the visible surface with a back affordance
- **AND** returning to the list SHALL NOT lose already-settled evidence state

#### Scenario: Evidence semantics are unchanged by the structure

- **GIVEN** any admitted session and any evidence section
- **WHEN** the workspace renders that section
- **THEN** its content, CLI-owned provenance, failure presentation, and typed-unavailable
  degradation SHALL match the pre-workspace behavior
- **AND** no evidence count or status SHALL be fabricated for list chips
