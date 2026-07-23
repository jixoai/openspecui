<!--
Orthogonal intents (created 2026-07-23 Asia/Shanghai):
1. Keep static exports truthful when they reuse realtime presentation atoms.
2. Require shared live/static display mapping without synthetic real-time activity.
3. Preserve reduced-motion and accessible lifecycle behavior across rendering modes.

Original request (2026-07-23): "使用原生的能力去做就好，比如 `overflow-anchor: auto;`。"
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

#### Scenario: Reduced motion is requested

- **GIVEN** the user requests reduced motion
- **WHEN** a static or live lifecycle atom would otherwise animate
- **THEN** the UI SHALL provide a non-motion equivalent preserving contrast and semantic state
- **AND** SHALL not hide required error, empty, or recovery information

