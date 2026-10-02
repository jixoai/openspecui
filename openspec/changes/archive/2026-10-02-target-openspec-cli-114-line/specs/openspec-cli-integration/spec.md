<!--
Orthogonal intents (created 2026-10-02 Asia/Shanghai):
1. Advance the CLI admission window to the OpenSpecUI 14 line.
2. Add typed contracts for the 1.14 protocol surfaces: version report, change-list inventory members,
   status advisory warnings, and apply task source locations.

Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
-->

## MODIFIED Requirements

### Requirement: CLI Discovery and Version Enforcement

OpenSpecUI 14 SHALL classify stable OpenSpec CLI `>=1.14.0 <1.15.0` as supported, current, and recommended.
OpenSpec CLI `<1.14.0` (including the whole 1.13.x window that OpenSpecUI 13 admitted, and every older line),
every prerelease, `>=1.15.0`, and an unparseable version SHALL be incompatible and blocked by default.

Scenario titles below are inherited scenario identity: an "Accept ..." title names that line's historical
admission era, while every scenario body states the OpenSpecUI 14 classification (retired and blocked).
Bodies are the normative text; a separate spec-hygiene change may verify a title-rename mechanism later.
When an incompatible executable is available, the mismatch Dialog MAY expose `Skip version check`; that action
SHALL bypass only the current Web page runtime's admission gate and SHALL NOT change the detected version,
compatibility evidence, CLI payloads, downstream errors, or product support claim.

#### Scenario: Accept the current 1.13 line

- **GIVEN** OpenSpecUI 14 detects a stable OpenSpec CLI 1.13.x executable that OpenSpecUI 13 admitted
- **WHEN** admission is evaluated
- **THEN** the retired 1.13 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v14 accepted and recommended ranges `>=1.14.0 <1.15.0`

#### Scenario: Block unsupported version forms

- **GIVEN** OpenSpecUI 14 detects CLI 1.14.0-rc.1, 1.15.0, or an unparseable version
- **WHEN** admission is evaluated
- **THEN** the mismatch Dialog SHALL block normal interactions
- **AND** the mismatch evidence SHALL name the accepted and recommended ranges

#### Scenario: Retire the v12 admission window

- **GIVEN** OpenSpecUI 14 detects a stable OpenSpec CLI 1.12.x executable that OpenSpecUI 12 admitted
- **WHEN** admission is evaluated
- **THEN** the retired line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v14 accepted and recommended ranges

#### Scenario: Accept the current 1.12 line

- **GIVEN** OpenSpecUI 14 detects a stable OpenSpec CLI 1.12.x executable that OpenSpecUI 12 admitted as its
  current and recommended line
- **WHEN** admission is evaluated
- **THEN** the retired 1.12 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v14 accepted and recommended ranges

#### Scenario: Retire the v11 admission window

- **GIVEN** OpenSpecUI 14 detects a stable OpenSpec CLI 1.10.x or 1.11.x executable that OpenSpecUI 11
  admitted
- **WHEN** admission is evaluated
- **THEN** the retired line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v14 accepted and recommended ranges

#### Scenario: Accept the supported non-current 1.10 line

- **GIVEN** OpenSpecUI 14 detects a stable OpenSpec CLI 1.10.x executable that OpenSpecUI 11 admitted as its
  supported non-current line
- **WHEN** admission is evaluated
- **THEN** the retired 1.10 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v14 accepted and recommended ranges

#### Scenario: Accept the current 1.11 line

- **GIVEN** OpenSpecUI 14 detects a stable OpenSpec CLI 1.11.x executable that OpenSpecUI 11 admitted as its
  current and recommended line
- **WHEN** admission is evaluated
- **THEN** the retired 1.11 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v14 accepted and recommended ranges

#### Scenario: Accept the supported non-current 1.8 line

- **GIVEN** OpenSpecUI 14 detects a stable OpenSpec CLI 1.8.x executable that OpenSpecUI 9 admitted as its
  supported non-current line
- **WHEN** admission is evaluated
- **THEN** the retired 1.8 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v14 accepted and recommended ranges

#### Scenario: Accept the current 1.9 line

- **GIVEN** OpenSpecUI 14 detects a stable OpenSpec CLI 1.9.x executable that OpenSpecUI 9 admitted as its
  current and recommended line
- **WHEN** admission is evaluated
- **THEN** the retired 1.9 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v14 accepted and recommended ranges

#### Scenario: Accept the adapted 1.7 line

- **GIVEN** OpenSpecUI 14 detects a stable OpenSpec CLI 1.7.x executable that OpenSpecUI 7 admitted as its
  adapted line
- **WHEN** admission is evaluated
- **THEN** the retired 1.7 line SHALL remain blocked by default
- **AND** the mismatch evidence SHALL name the v14 accepted and recommended ranges

#### Scenario: Block OpenSpec CLI 1.6

- **GIVEN** OpenSpecUI 14 detects an available OpenSpec CLI 1.6.x executable
- **WHEN** admission is evaluated
- **THEN** the mismatch Dialog SHALL block normal interactions
- **AND** SHALL identify the v14 accepted and recommended ranges

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

### Requirement: Version Report Command Contract

OpenSpecUI 14 SHALL decode `openspec version --json` as a typed CLI contract: a `schemaVersion: 1` envelope
carrying the installed `version` and `install` facts (location, packageManager, scope), with the `update`
member conditionally present only under `--check`. The executor SHALL NOT run the registry probe unless an
explicit consumer requests it, and no UI surface is obligated by this contract.

#### Scenario: Decode the no-check envelope

- **GIVEN** `openspec version --json` runs without `--check` on an admitted 1.14 CLI
- **WHEN** the output crosses the typed contract
- **THEN** `schemaVersion`, `version`, and `install` SHALL be preserved as typed facts
- **AND** no `update` member SHALL be synthesized

#### Scenario: Update metadata stays optional and probe-gated

- **GIVEN** a consumer has not requested an update check
- **WHEN** the version contract is invoked
- **THEN** no network probe SHALL be issued by OpenSpecUI
- **AND** a payload carrying `update` SHALL parse with the member preserved verbatim

### Requirement: Change List Inventory Contract

The CLI change-list contract SHALL carry the OpenSpec 1.14 per-entry optional `archived` member (present
only under `--archived`/`--all`). The 1.13.1 `nested` and top-level `warnings` members stay covered by the
existing Change List Nested Directory contract; this line only migrates their fixtures. OpenSpecUI's Archive
list SHALL keep its reactive-filesystem projection owner; the CLI members are typed evidence, not a mandated
data-source switch.

#### Scenario: Archived entries decode with the archived flag

- **GIVEN** `openspec list --archived --json` returns an archived entry
- **WHEN** the output crosses the typed contract
- **THEN** the entry SHALL preserve `archived: true` and the shared per-entry shape

#### Scenario: Nested findings are objective evidence

- **GIVEN** a plain `list --json` reports a namespace folder
- **WHEN** the output crosses the typed contract
- **THEN** the entry's `nested` member and the top-level `warnings` finding SHALL be preserved verbatim
- **AND** absent members SHALL stay absent (no synthesized empty states)

#### Scenario: Default list output remains compatible

- **GIVEN** `openspec list --json` without the new flags on a change set with no namespace folders
- **WHEN** the output crosses the typed contract
- **THEN** parsing SHALL succeed with neither `archived` nor `warnings` fabricated

### Requirement: Status Advisory Warnings Contract

OpenSpecUI 14 SHALL decode the OpenSpec 1.14 `status --json` top-level `warnings` member (unrecognized
`.openspec.yaml` key advisories) as optional typed evidence preserved verbatim with CLI ownership. Warnings
SHALL NOT gate Root readiness, action availability, or Apply state.

#### Scenario: Unrecognized metadata keys are preserved verbatim

- **GIVEN** a change's `.openspec.yaml` carries an unrecognized key and `status --json` reports it
- **WHEN** the payload crosses the typed contract
- **THEN** the warning string SHALL be preserved exactly as the CLI provided it
- **AND** OpenSpecUI SHALL NOT synthesize or reword a warning when the member is absent

#### Scenario: Warnings never gate actions

- **GIVEN** a status payload carries advisory warnings
- **WHEN** action availability is evaluated
- **THEN** gating SHALL remain unchanged by the warnings

### Requirement: Apply Task Source Locations Contract

The Apply Instructions task contract SHALL carry the OpenSpec 1.14 `sourcePath` (absolute) and `line`
(1-based) members as optional typed facts on each task. OpenSpecUI SHALL NOT re-derive or second-guess the
locations; they are CLI-owned evidence for which file and line each checkbox lives at.

#### Scenario: Located tasks decode with both members

- **GIVEN** `instructions apply --json` on an admitted 1.14 CLI returns located tasks
- **WHEN** the payload crosses the typed contract and its projection chain
- **THEN** each task SHALL preserve `sourcePath` and `line` with CLI provenance

#### Scenario: Older-shape tasks still parse

- **GIVEN** an Apply Instructions payload whose tasks lack the location members
- **WHEN** the payload crosses the typed contract
- **THEN** parsing SHALL succeed with both members absent
- **AND** no default location SHALL be fabricated

### Requirement: Spec Requirement Names Contract

The `show <spec> --type spec --json` contract SHALL carry the OpenSpec 1.14 optional `name` member on each
requirement and each scenario, preserved by CLI value through the spec-document contract and the Spec
Catalog projection chain. This surface is distinct from `show <change> --json --diff`.

#### Scenario: Names decode on a 1.14 spec document

- **GIVEN** an admitted 1.14 CLI returns a spec document whose requirements and scenarios carry names
- **WHEN** the payload crosses the typed contract and its projection chain
- **THEN** requirement names and scenario names SHALL be preserved by CLI value with provenance

#### Scenario: Older documents still parse without names

- **GIVEN** a spec document whose members lack `name`
- **WHEN** the payload crosses the typed contract
- **THEN** parsing SHALL succeed with the members absent
- **AND** a non-string `name` SHALL be rejected rather than silently accepted as typed evidence

### Requirement: Status Action Context Edit Roots Contract

Store-backed `status --json` `actionContext.allowedEditRoots` SHALL be preserved exactly as the CLI reports
it in both branches: with a declaring project on the current path, the array lists the implementation root
and the project root with the declaring-repo constraint; without one, the array lists the project root with
the constraint telling the agent to ask which repository to edit. OpenSpecUI SHALL NOT branch production
logic on the root count.

#### Scenario: Declaring project joins the edit roots

- **GIVEN** a store-backed change whose store is declared by a project on the current path
- **WHEN** status is projected
- **THEN** `allowedEditRoots` SHALL preserve the CLI-reported roots and constraint verbatim

#### Scenario: No declaring project asks the user

- **GIVEN** a store-backed change with no declaring project on the current path
- **WHEN** status is projected
- **THEN** `allowedEditRoots` SHALL preserve the CLI-reported single root and the ask-the-user constraint
- **AND** OpenSpecUI SHALL NOT synthesize an implementation root
