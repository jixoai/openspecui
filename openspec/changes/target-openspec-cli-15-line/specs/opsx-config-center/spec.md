<!--
Orthogonal intents (updated 2026-10-25 Asia/Shanghai):
1. Spec delta: Agent delivery inventory series rotation (1.14 -> 1.15; no new upstream tools).

Original request (2026-10-25): "开工"
-->

## RENAMED Requirements

- FROM: `OpenSpecUI 14 Agent Delivery Inventory`
- TO: `OpenSpecUI 15 Agent Delivery Inventory`

## MODIFIED Requirements

### Requirement: OpenSpecUI 15 Agent Delivery Inventory

`/config/agents` SHALL select the official Agent inventory and command capabilities from the admitted running
OpenSpec CLI version, not from one fixed registry. For the v15 line it SHALL project the supported 1.15 physical
delivery metadata — the complete 1.14 inventory carried forward unchanged (upstream `AI_TOOLS` is
byte-identical in 1.15.0; no tool was added or removed): current/legacy project roots, user-global skill roots,
detection paths, command paths, delivery capability, generated version, migration/cleanup evidence, and IDE
restart requirements where that CLI declares them. A tool absent from the admitted CLI line SHALL be unavailable
for that line, not falsely stale or present. A session running a retired CLI line SHALL project no inventory
for the v15 registry rather than the retired line's snapshot.

#### Scenario: Series rotation carries the physical inventory forward

- **GIVEN** the admitted OpenSpec CLI is stable 1.15.x
- **WHEN** the Agent inventory is listed
- **THEN** the projected inventory SHALL equal the 1.14 physical inventory (no tool added or removed
  upstream in 1.15.0)
- **AND** generator-version evidence SHALL reflect the 1.15.0 pinned baseline

#### Scenario: A retired-line session projects no v15 inventory

- **GIVEN** the running OpenSpec CLI is stable 1.14.x after the v15 admission gate
- **WHEN** the Agent inventory is evaluated
- **THEN** the v15 registry selection SHALL be empty for that session
- **AND** the UI SHALL NOT present the retired line's snapshot as the current inventory
