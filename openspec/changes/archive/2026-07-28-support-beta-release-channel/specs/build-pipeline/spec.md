<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Specify channel-correct prerelease publication.
2. Specify retry-safe registry and tag delivery.
3. Specify terminal release evidence.

Original request (2026-07-28): "我想先发布一个beta版本"
-->

## ADDED Requirements

### Requirement: Channel-correct retry-safe package release

The release pipeline SHALL derive package registry and GitHub release channels from the generated SemVer version, SHALL preserve registry and tag delivery as separate facts, and SHALL never push its checked-out branch while delivering release tags.

#### Scenario: Publish a beta without moving stable latest

- **GIVEN** Changesets generates `6.0.0-beta.0`
- **WHEN** the release pipeline publishes the changed public packages
- **THEN** each package SHALL publish under the npm `beta` dist-tag
- **AND** npm `latest` SHALL remain unchanged
- **AND** the GitHub Release SHALL be marked as a prerelease and not latest

#### Scenario: Recover tags after registry publication

- **GIVEN** every target package version already exists in the registry
- **AND** one or more corresponding package tags are absent
- **WHEN** the exact version workflow is retried
- **THEN** the pipeline SHALL recreate and push the missing tags
- **AND** SHALL synchronize the corresponding GitHub Release
- **AND** SHALL NOT republish existing package versions

#### Scenario: Ignore a fully delivered no-op

- **GIVEN** every target package version exists in the registry
- **AND** every corresponding package tag exists
- **WHEN** a package-manifest-triggered workflow runs
- **THEN** the pipeline SHALL report no release work
- **AND** SHALL NOT push refs or rewrite an existing GitHub Release

#### Scenario: Main advances during release work

- **GIVEN** release work started from commit A
- **AND** the remote `main` branch advances to commit B during the build
- **WHEN** the pipeline delivers tags created from commit A
- **THEN** it SHALL push tag refs only
- **AND** SHALL NOT submit A as an update to `main`

### Requirement: Explicit prerelease mode transition

The version automation SHALL require explicit operator intent to enter, continue, or exit Changesets prerelease mode and SHALL reject a channel that conflicts with persisted prerelease state.

#### Scenario: Enter the first beta channel

- **GIVEN** no Changesets prerelease state exists
- **WHEN** the operator runs `pnpm changeversion --pre beta`
- **THEN** the automation SHALL enter the `beta` prerelease mode before versioning
- **AND** SHALL generate the version PR through the existing protected delivery flow

#### Scenario: Reject an implicit or conflicting continuation

- **GIVEN** the persisted Changesets prerelease channel is `beta`
- **WHEN** the operator omits prerelease intent or requests `rc`
- **THEN** the automation SHALL fail before versioning
- **AND** SHALL preserve the existing `beta` state
