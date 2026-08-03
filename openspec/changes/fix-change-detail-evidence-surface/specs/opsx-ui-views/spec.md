<!--
Orthogonal intents (created 2026-08-03 Asia/Shanghai):
1. Define the active Change default decision plane and full-width action/status ownership.
2. Define the routed Evidence tab, evidence authority states, and scroll ownership.
3. Preserve direct failures and explicit static unavailability.

Original request (2026-08-03): move unbounded Change Detail evidence out of the Header while preserving necessary and complete information.
Owner correction (2026-08-03): Actions use title inline-end space before responsive wrapping; Apply inputs use an Action-owned Dialog; subtitle facts use badges; action-specific unavailable reasons use button Tooltips.
-->

# Delta for opsx-ui-views

## ADDED Requirements

### Requirement: Change Detail Evidence Surface

Active Change Detail SHALL keep workflow decisions in a stable default plane and expose persistent source evidence
through a dedicated routed tab without changing source or mutation authority.

#### Scenario: Keep the Header independent from evidence volume

- **GIVEN** a Change has workflow actions, Apply inputs, Root/Reference facts, and arbitrarily long CLI evidence
- **WHEN** Change Detail renders
- **THEN** the Header SHALL contain Change identity, subtitle scan badges, and compact Header actions
- **AND** Actions SHALL occupy the title inline-end while the container has sufficient space
- **AND** the complete Action row SHALL wrap to the title block-end only when the Header container becomes narrow
- **AND** direct status SHALL render in a full-width region below the Header
- **AND** verbose evidence SHALL NOT affect Header height or right-side width allocation

#### Scenario: Keep the default decision plane actionable

- **WHEN** the default Artifact or Content tab is active
- **THEN** Change identity, Schema, artifact progress, Root/Store, References, and workflow actions SHALL remain directly visible
- **AND** Schema, artifact progress, Root/Store, and References SHALL use Tooltip-backed badges in the subtitle
- **AND** each action-specific unavailable reason SHALL be available from the corresponding disabled button Tooltip
- **AND** Change Detail SHALL NOT render a duplicate `Unavailable:` action summary
- **AND** transport errors, Root blockers, Reference failures, stale authority, and progress divergence SHALL remain visible without opening a tab, Tooltip, Dialog, or disclosure
- **AND** non-empty Apply context or operation guidance SHALL expose one `Apply inputs` Action that opens a bounded Dialog
- **AND** empty Apply inputs SHALL expose neither the Action nor the Dialog

#### Scenario: Inspect complete Change evidence

- **WHEN** the user selects the `Evidence` tab
- **THEN** readable Root/Store facts, artifact outputs, References, CLI result, and raw CLI payload SHALL remain retrievable in source-attributed layers
- **AND** the tab SHALL follow `Folder`, participate in the existing routed tab query, and SHALL NOT become the default tab
- **AND** a Dialog SHALL NOT own persistent Change evidence

#### Scenario: Preserve Reference evidence authority

- **GIVEN** Root Context is current, retained during refresh/failure, or unavailable
- **WHEN** Change Detail projects Reference evidence
- **THEN** it SHALL distinguish `current`, `retained`, and `unavailable`
- **AND** unavailable evidence SHALL NOT be presented as zero observed References
- **AND** a static snapshot SHALL explicitly report that live CLI and Reference provenance are unavailable

#### Scenario: Bound Evidence scrolling

- **GIVEN** Evidence contains long paths, diagnostics, and raw JSON
- **WHEN** its content exceeds the available tab space at narrow or wide container widths
- **THEN** the Evidence panel SHALL own the tab's primary vertical scrolling
- **AND** paths SHALL wrap, raw payload SHALL remain bounded, and no ancestor SHALL create page-level horizontal overflow

#### Scenario: Keep Change evidence presentation pure

- **WHEN** compact and complete Change evidence components render
- **THEN** they SHALL consume already-resolved Change Status and Root Context presentation facts
- **AND** SHALL NOT create subscriptions, authorize mutations, reconstruct CLI facts, or change static snapshot contracts
