<!--
Orthogonal intents (created 2026-10-25 Asia/Shanghai):
1. Spec delta: v15 admission window, standalone install scope, fixture role rotation.

Original request (2026-10-25): "开工"
-->

## ADDED Requirements

### Requirement: OpenSpecUI 15 Admission Window

OpenSpecUI 15 SHALL admit exactly the stable OpenSpec CLI `>=1.15.0 <1.16.0` single-series window
and reject `<1.15.0` (including the whole 1.14 line), prereleases, `>=1.16.0`, and unparseable
versions, per the compat law's version classification. The pinned positive fixture SHALL be
`openspec-cli-115` (1.15.0) and the below-admitted boundary SHALL be `openspec-cli-114`
(1.14.3 — the last 1.14 patch, version unchanged from the v14 line). `openspec-cli-113` SHALL be
removed with its retired boundary suite; `openspec-cli-112`/`111` SHALL stay for their historical
generator-evidence consumers.

#### Scenario: Boundary proves the just-retired line rejected with 1.15-only surfaces absent

- **GIVEN** the pinned `openspec-cli-114` boundary executable (1.14.3)
- **WHEN** the boundary suite runs
- **THEN** `--version` SHALL report exactly `1.14.3` and the v15 classification SHALL be
  unsupported
- **AND** `update --dry-run` SHALL fail with `error: unknown option '--dry-run'` and `install`
  SHALL fail with `error: unknown command 'install'` (the 1.15-only surfaces absent on 1.14.3)
- **AND** the suite SHALL NOT assert that 1.15-era members are absent from 1.14 outputs beyond
  these two surfaces

### Requirement: Standalone Install Scope

The `version --json` install contract SHALL accept `scope: 'standalone'` as a legal value
alongside `global|project|temporary|source` (OpenSpec CLI 1.15 standalone distribution). Absence
of the value on older CLIs is unchanged behavior; no UI integration is in scope for this line.

#### Scenario: A standalone install's version payload decodes

- **GIVEN** a `version --json` payload whose `install.scope` is `'standalone'`
- **WHEN** the payload is decoded through `CliVersionSchema`
- **THEN** the decode SHALL succeed with the scope preserved verbatim
