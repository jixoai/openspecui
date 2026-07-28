<!--
Orthogonal intents (created 2026-07-23 Asia/Shanghai):
1. Keep static exports truthful when they reuse realtime presentation atoms.
2. Require shared live/static display mapping without synthetic real-time activity.
3. Preserve reduced-motion and accessible lifecycle behavior across rendering modes.
4. Bind static export execution to the actual clean SSG build output contract.

Original request (2026-07-23): "使用原生的能力去做就好，比如 `overflow-anchor: auto;`。"
Original request (2026-07-27): "Static 执行 export-static 报错：Cannot find module dist-ssg/server/entry-server.js。"
Owner acceptance feedback (2026-07-28): "Static 导出后的 /context 页面没数据；如果保留 Context，就应该支持导出。"
-->

# Delta for Web Rendering

## ADDED Requirements

### Requirement: Truthful Static Lifecycle Projection

The web application SHALL reuse the realtime presentation model for static snapshots only where its facts are available. Static rendering SHALL not imply a live subscription, server invalidation, reconnect, or current mutable authority.

#### Scenario: A static snapshot has displayable content

- **GIVEN** static export provides a projection snapshot
- **WHEN** the corresponding route renders through the shared presentation atoms
- **THEN** it SHALL display that snapshot through the same content mapping as live mode
- **AND** SHALL not render a synthetic revalidation cue or Live connection claim

#### Scenario: Static Context projects published provenance

- **GIVEN** a static snapshot records display-safe Planning-root provenance and a Reference export policy
- **WHEN** the exported `/context` route renders
- **THEN** it SHALL display the published project, root, Store, Reference-policy, version, and observation facts
- **AND** SHALL NOT synthesize live CLI evidence, registry/data-scope paths, diagnostics, or mutation authority
- **AND** an omitted Reference policy SHALL expose only its published aggregate count, never hidden Store identities

#### Scenario: Reduced motion is requested

- **GIVEN** the user requests reduced motion
- **WHEN** a static or live lifecycle atom would otherwise animate
- **THEN** the UI SHALL provide a non-motion equivalent preserving contrast and semantic state
- **AND** SHALL not hide required error, empty, or recovery information

### Requirement: Static Server Entry Contract

The static exporter SHALL load the server renderer identified by the current clean SSG build. A successful build and
the export command SHALL share one deterministic, machine-readable entry contract.

#### Scenario: A clean build emits a content-addressed server entry

- **GIVEN** the SSG build has no prior output
- **WHEN** the build emits a content-addressed server renderer
- **THEN** it SHALL publish the renderer location through the build output contract
- **AND** the exporter SHALL consume that location instead of assuming an unverified filename

#### Scenario: A Reference-bearing project is exported

- **GIVEN** a clean SSG build and a project whose static policy includes References
- **WHEN** the real CLI export command runs
- **THEN** it SHALL load the current server renderer and complete the output
- **AND** the result SHALL preserve the existing static provenance and publication policy

#### Scenario: The build entry is missing or ambiguous

- **WHEN** the exporter cannot resolve exactly one declared server renderer
- **THEN** it SHALL fail with concrete build-contract evidence
- **AND** SHALL NOT select an arbitrary JavaScript file or fall back to stale output
