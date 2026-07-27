<!--
Orthogonal intents (created 2026-07-23 Asia/Shanghai):
1. Extend Server-owned Projection Work from snapshot push to identity-only invalidation plus typed current pull.
2. Preserve exact identity/generation acceptance and display-only authority during client revalidation.
3. Bound same-identity invalidation fan-out without delaying direct user or terminal transitions.

Original request (2026-07-23): "在已有content的时候，服务端推送变更，然后客户端收到推送通知，于是开始加载更新数据。"
-->

# Delta for Live Projection Work

## ADDED Requirements

### Requirement: Invalidation-Driven Current Projection Pull

The system SHALL deliver server push as an identity-only invalidation and SHALL obtain replacement business content through a typed client pull. The pull result SHALL carry the exact Projection Work identity and generation needed for client commit eligibility.

#### Scenario: A server push wakes a current subscriber

- **GIVEN** a subscriber has an active projection identity
- **WHEN** the Server observes a change affecting that identity
- **THEN** the Server SHALL publish an invalidation with identity, generation, and cause
- **AND** SHALL NOT use that invalidation payload as replacement business content

#### Scenario: A pull completes after the active owner changes

- **GIVEN** client pull A started for identity/generation A
- **WHEN** the active owner transitions to B before A resolves
- **THEN** the client SHALL reject A's content, progress, completion, and failure effects for B
- **AND** SHALL accept only a current pull whose identity and generation match B

### Requirement: Bounded Same-Identity Revalidation

The system SHALL coalesce bursty invalidations for one active identity into bounded revalidation work while allowing explicit user actions, terminal transitions, retries, and root rebinds to bypass that delay.

#### Scenario: Bursty filesystem changes affect one active projection

- **GIVEN** multiple invalidations arrive for the same visible projection within its bounded coalescing window
- **WHEN** the client schedules replacement work
- **THEN** it SHALL issue at most one joined pull for that window
- **AND** SHALL preserve the most recent cause and current identity evidence

#### Scenario: A user explicitly retries while coalescing is pending

- **GIVEN** a same-identity revalidation window is open
- **WHEN** the user invokes retry or an explicit command reaches a terminal transition
- **THEN** the system SHALL start the required current pull without waiting for that window
- **AND** SHALL still apply the identity/generation acceptance gate

