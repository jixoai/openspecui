<!--
Orthogonal intents (created 2026-07-23 Asia/Shanghai):
1. Preserve Config ownership and dirty drafts across realtime revalidation.
2. Require current-authority mutation locks without replacing readable stale configuration.
3. Apply composable lifecycle presentation to Config sections without changing their layout or owner scopes.

Original request (2026-07-23): "也就是说你只考虑了有、无两种大方向的状态，没有考虑到‘实时变更’相关衍生的状态。"
-->

# Delta for OPSX Config Center

## ADDED Requirements

### Requirement: Config Revalidation Draft Boundary

The Config view SHALL retain local drafts and editable overlay state across remote projection revalidation. It SHALL distinguish readable display-only configuration from a current configuration that may authorize a write.

#### Scenario: Active Root or Project Binding is revalidating

- **GIVEN** a current Config projection becomes revalidating or refresh-error
- **WHEN** the user views its existing content
- **THEN** the content SHALL remain readable and copyable as display-only
- **AND** a mutation requiring current Root/Config authority SHALL remain locked

#### Scenario: A remote Config update arrives during a dirty edit

- **GIVEN** a user is editing a dirty Project Binding, Active Root, Environment Global, schema, template, or settings draft
- **WHEN** a newer remote projection arrives
- **THEN** the UI SHALL preserve the local draft and open editing interaction
- **AND** SHALL expose local update availability rather than replacing the draft or silently saving stale data
