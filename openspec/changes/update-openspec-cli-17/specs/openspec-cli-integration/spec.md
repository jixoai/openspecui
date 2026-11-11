<!--
Orthogonal intents (created 2026-11-11 Asia/Shanghai):
1. The admitted window rotates to OpenSpecUI 17: stable >=1.17.0 <1.18.0 current/recommended.
2. The 1.16.x window that OpenSpecUI 16 admitted joins the retired lines; >=1.18.0 is blocked.
3. Scenario titles stay inherited identity; every body states the v17 classification.

Original request (2026-11-11): "检查 OpenSpec CLI 上游是否有新版本，并按仓库标准工作流跟进上线。"
-->

## MODIFIED Requirements

### Requirement: CLI Discovery and Version Enforcement

OpenSpecUI 17 SHALL classify stable OpenSpec CLI `>=1.17.0 <1.18.0` as supported, current, and recommended.
OpenSpec CLI `<1.17.0` (including the whole 1.16.x window that OpenSpecUI 16 admitted, and every older line),
every prerelease, `>=1.17.0`, and an unparseable version SHALL be incompatible and blocked by default.
When an incompatible executable is available, the mismatch Dialog MAY expose `Skip version check`; that
action SHALL bypass only the current Web page runtime's admission gate and SHALL NOT change the detected
version, compatibility evidence, CLI payloads, downstream errors, or product support claim.

Scenario titles below are inherited scenario identity: an "Accept ..." title names that line's historical
admission era, while every scenario body states the OpenSpecUI 17 classification (retired and blocked).

#### Scenario: Accept the current 1.14 line

- **GIVEN** OpenSpecUI 17 detects a stable OpenSpec CLI 1.14.x executable that OpenSpecUI 14 admitted
- **WHEN** admission is evaluated
- **THEN** the retired 1.14 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v17 accepted and recommended ranges `>=1.17.0 <1.18.0`

#### Scenario: Retire the v15 admission window

- **GIVEN** OpenSpecUI 17 detects a stable OpenSpec CLI 1.15.x executable that OpenSpecUI 15 admitted
- **WHEN** admission is evaluated
- **THEN** the retired 1.15 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v17 accepted and recommended ranges

#### Scenario: Retire the v16 admission window

- **GIVEN** OpenSpecUI 17 detects a stable OpenSpec CLI 1.16.x executable that OpenSpecUI 16 admitted
- **WHEN** admission is evaluated
- **THEN** the retired 1.16 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v17 accepted and recommended ranges `>=1.17.0 <1.18.0`

#### Scenario: Block unsupported version forms

- **GIVEN** OpenSpecUI 17 detects CLI 1.17.0-beta.1, the stable upper bound 1.18.0, or an unparseable version
- **WHEN** admission is evaluated
- **THEN** the mismatch Dialog SHALL block normal interactions
- **AND** the mismatch evidence SHALL name the accepted and recommended ranges

#### Scenario: Retire the v13 admission window

- **GIVEN** OpenSpecUI 17 detects a stable OpenSpec CLI 1.13.x executable that OpenSpecUI 13 admitted
- **WHEN** admission is evaluated
- **THEN** the retired line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v17 accepted and recommended ranges

#### Scenario: Accept the current 1.13 line

- **GIVEN** OpenSpecUI 17 detects a stable OpenSpec CLI 1.13.x executable that OpenSpecUI 13 admitted
- **WHEN** admission is evaluated
- **THEN** the retired 1.13 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v17 accepted and recommended ranges `>=1.17.0 <1.18.0`

#### Scenario: Retire the v12 admission window

- **GIVEN** OpenSpecUI 17 detects a stable OpenSpec CLI 1.12.x executable that OpenSpecUI 12 admitted
- **WHEN** admission is evaluated
- **THEN** the retired line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v17 accepted and recommended ranges

#### Scenario: Accept the current 1.12 line

- **GIVEN** OpenSpecUI 17 detects a stable OpenSpec CLI 1.12.x executable that OpenSpecUI 12 admitted as its
  current and recommended line
- **WHEN** admission is evaluated
- **THEN** the retired 1.12 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v17 accepted and recommended ranges

#### Scenario: Retire the v11 admission window

- **GIVEN** OpenSpecUI 17 detects a stable OpenSpec CLI 1.10.x or 1.11.x executable that OpenSpecUI 11
  admitted
- **WHEN** admission is evaluated
- **THEN** the retired line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v17 accepted and recommended ranges

#### Scenario: Accept the supported non-current 1.10 line

- **GIVEN** OpenSpecUI 17 detects a stable OpenSpec CLI 1.10.x executable that OpenSpecUI 11 admitted as its
  supported non-current line
- **WHEN** admission is evaluated
- **THEN** the retired 1.10 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v17 accepted and recommended ranges

#### Scenario: Accept the current 1.11 line

- **GIVEN** OpenSpecUI 17 detects a stable OpenSpec CLI 1.11.x executable that OpenSpecUI 11 admitted as its
  current and recommended line
- **WHEN** admission is evaluated
- **THEN** the retired 1.11 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v17 accepted and recommended ranges

#### Scenario: Accept the supported non-current 1.8 line

- **GIVEN** OpenSpecUI 17 detects a stable OpenSpec CLI 1.8.x executable that OpenSpecUI 9 admitted as its
  supported non-current line
- **WHEN** admission is evaluated
- **THEN** the retired 1.8 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v17 accepted and recommended ranges

#### Scenario: Accept the current 1.9 line

- **GIVEN** OpenSpecUI 17 detects a stable OpenSpec CLI 1.9.x executable that OpenSpecUI 9 admitted as its
  current and recommended line
- **WHEN** admission is evaluated
- **THEN** the retired 1.9 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v17 accepted and recommended ranges

#### Scenario: Accept the adapted 1.7 line

- **GIVEN** OpenSpecUI 17 detects a stable OpenSpec CLI 1.7.x executable that OpenSpecUI 7 admitted as its
  adapted line
- **WHEN** admission is evaluated
- **THEN** the retired 1.7 line SHALL remain blocked by default
- **AND** the mismatch evidence SHALL name the v17 accepted and recommended ranges

#### Scenario: Block OpenSpec CLI 1.6

- **GIVEN** OpenSpecUI 17 detects an available OpenSpec CLI 1.6.x executable
- **WHEN** admission is evaluated
- **THEN** the mismatch Dialog SHALL block normal interactions
- **AND** SHALL identify the v17 accepted and recommended ranges

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
