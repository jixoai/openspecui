# hosted-app-distribution Specification

## Purpose

TBD - created by archiving change add-hosted-app-distribution. Update Purpose after archive.

## Requirements

### Requirement: Frontend App Workspace for Hosted Delivery

The system SHALL provide a dedicated frontend `app` workspace that builds the hosted workspace shell for a single base URL.

#### Scenario: Build root hosted workspace shell

- **WHEN** the hosted app workspace is built
- **THEN** it SHALL emit a root `index.html`
- **AND** the root shell SHALL be responsible for hosted tabs, session restoration, backend metadata resolution, and initial-tab creation behavior

#### Scenario: Open an initial hosted tab from launch parameters

- **WHEN** the root hosted shell loads with a valid `api` query parameter
- **THEN** it SHALL create or activate a hosted tab for that backend service
- **AND** it SHALL resolve the compatible hosted frontend bundle after querying backend metadata
- **AND** it SHALL render the selected tab without discarding the shell itself

#### Scenario: Label tabs with project metadata

- **WHEN** the hosted shell receives backend metadata from `/api/health`
- **THEN** each tab SHALL use the backend project name as its primary title
- **AND** it SHALL use the backend API URL as its subtitle
- **AND** long titles or subtitles SHALL truncate rather than expanding the tab strip indefinitely

#### Scenario: Keep shell chrome focused on the tab strip

- **WHEN** the hosted workspace shell renders its own UI
- **THEN** the tab strip SHALL remain the primary chrome surface
- **AND** shell actions such as refresh or add-backend SHALL live inline at the end of the tab strip instead of in a separate page header

#### Scenario: Gray out an offline hosted tab

- **WHEN** a hosted tab's backend service becomes unreachable
- **THEN** the root shell SHALL keep the tab visible
- **AND** it SHALL render that tab in a visually muted or grayed-out offline state

#### Scenario: Reuse the existing web visual system

- **WHEN** the hosted workspace shell renders its own UI
- **THEN** it SHALL reuse the established `packages/web` visual language and component patterns where practical
- **AND** it SHALL avoid introducing a parallel design system for shell-only UI

### Requirement: Versioned Hosted Bundles

The hosted app build SHALL emit direct version entry pages under `versions/<channel>/`.

#### Scenario: Emit versioned hosted bundles under `versions/`

- **WHEN** the hosted app build completes
- **THEN** the output SHALL contain versioned hosted bundles under `versions/<channel>/`
- **AND** the output SHALL be suitable for direct CDN, static host, or nginx deployment

#### Scenario: Expose embeddable direct entry pages

- **WHEN** a hosted channel such as `v2.0` is built
- **THEN** the output SHALL contain `versions/v2.0/index.html`
- **AND** that entry page SHALL be loadable directly by the root hosted shell without requiring a root-page navigation rewrite

### Requirement: Build-Time Channel Extraction

The hosted app build SHALL resolve published `openspecui` packages and extract them into versioned hosted bundles.

#### Scenario: Resolve and extract a pinned channel

- **WHEN** the hosted app build assembles the `v2.0` channel
- **THEN** it SHALL resolve the latest published `openspecui` version matching `~2.0`
- **AND** it SHALL download that published package from npm
- **AND** it SHALL extract the packaged `web/` distribution into `versions/v2.0/`

#### Scenario: Generate all configured channels in one build

- **WHEN** the hosted app build runs
- **THEN** it SHALL process every configured channel definition
- **AND** it SHALL emit each configured channel into its own `versions/<channel>/` directory

### Requirement: Root Version Manifest

The hosted app build SHALL publish a single root `version.json` manifest that maps OpenSpecUI versions to hosted channels and channel metadata.

#### Scenario: Root manifest advertises compatibility mappings

- **WHEN** the build emits `version.json`
- **THEN** the manifest SHALL include compatibility mappings from OpenSpecUI semver ranges to channel IDs
- **AND** it SHALL include each channel's root path and shell path
- **AND** it SHALL include enough metadata for the hosted shell to select the correct channel after querying backend metadata

#### Scenario: Channel metadata advertises patch updates

- **WHEN** the build emits metadata for a channel such as `v2.0`
- **THEN** the manifest SHALL declare the latest patch version available in that channel
- **AND** it SHALL keep update information scoped to that channel

### Requirement: Hosted Deployment Documentation

The app workspace SHALL document how to deploy the built hosted output in official and self-hosted environments.

#### Scenario: Document container deployment

- **WHEN** the app workspace README is generated
- **THEN** it SHALL include Docker-based deployment instructions for serving the built static output

#### Scenario: Document reverse-proxy deployment

- **WHEN** the app workspace README is generated
- **THEN** it SHALL include nginx and Caddy examples
- **AND** it SHALL explain cache expectations for `version.json` and hosted shell assets
