<!--
Orthogonal intents (created 2026-07-23 Asia/Shanghai):
1. Define the reusable eight-state visual lifecycle for all live Web projection surfaces.
2. Require composable visual atoms rather than page-owned loading layouts.
3. Preserve display-only authority and local interaction ownership during live revalidation.
4. Bound normal visual language, accessibility equivalents, native motion, and static behavior.

Original request (2026-07-23): "这个只能说初步可用吧，但不够完善。记得全局系统提示词中跟你说到的ui相关的最佳实践吗？你这套设计没有考虑到在已有content的时候，服务端推送变更，然后客户端收到推送通知，于是开始加载更新数据。"
Original request (2026-07-23): "不用显示文字，可以用光影来替代，将它做成一种视觉语言，其实包括加载中等状态也是，尽量不要使用文字，而是使用视觉语言（动画、光影）等技术。"
Owner acceptance feedback (2026-07-28): "列表骨架之间需要 gap，要么得有分割线。"
-->

# Delta for Realtime Projection Experience

## ADDED Requirements

### Requirement: Eight-State Realtime Projection Presentation

The Web application SHALL render each asynchronous projection through exactly one normalized topology: no-content `idle`, `initial-loading`, `empty`, or `initial-error`; or displayable-content `partial`, `current`, `revalidating`, or `refresh-error`. Every topology SHALL carry separate `current | display-only` authority and `initial | server-push | user-action | reconnect | root-rebind` cause facts.

#### Scenario: First visible projection has no prior content

- **GIVEN** a visible surface has not committed a readable projection
- **WHEN** its first request is admitted, resolves empty, or fails
- **THEN** the surface SHALL render `initial-loading`, `empty`, or `initial-error` respectively
- **AND** SHALL NOT label an unresolved request as an empty result

#### Scenario: Current content is invalidated remotely

- **GIVEN** a current projection is visible
- **WHEN** the server invalidates its active identity
- **THEN** the existing content SHALL remain visible as `revalidating` with `display-only` authority
- **AND** the surface SHALL settle to `current` only after a matching current pull commits

#### Scenario: Progressive rows arrive before completion

- **GIVEN** a projection emits real batches before its final current snapshot
- **WHEN** one or more batches arrive
- **THEN** the surface SHALL render `partial` without hiding received rows
- **AND** SHALL use determinate progress only when the source supplied a known total

### Requirement: Composable Visual Lifecycle Atoms

The Web application SHALL expose headless realtime state and independently composable visual atoms. Their root SHALL publish `data-state`, `data-authority`, and `data-cause`, but SHALL NOT impose a Card, page layout, navigation structure, or fixed information architecture.

#### Scenario: A route composes local lifecycle feedback

- **GIVEN** a route or overlay owns an asynchronous region
- **WHEN** it renders normalized projection state
- **THEN** it SHALL compose only the skeleton, revalidation cue, progress, changed-item, recovery, and content atoms it needs
- **AND** SHALL retain its existing layout ownership

#### Scenario: Normal lifecycle is visual and accessible

- **GIVEN** a projection is loading, revalidating, receiving batches, or settling normally
- **WHEN** no error, conflict, empty conclusion, or user decision is present
- **THEN** the UI SHALL communicate the lifecycle through stable geometry, luminance, and short native motion rather than persistent status copy
- **AND** SHALL expose an equivalent hidden accessibility status without replacing raw evidence content

#### Scenario: Repeating list skeleton rows remain physically distinct

- **GIVEN** a list surface renders repeated skeleton rows
- **WHEN** adjacent rows use the shared list inventory mode
- **THEN** the inventory SHALL expose a stable gap or visible separator owned by the shared primitive
- **AND** SHALL NOT depend on route-local margins to prevent the rows from appearing as one block

### Requirement: Retained Interaction And Draft Protection

The Web application SHALL keep display-only content readable, selectable, and copyable while locking mutations that require a current projection. A remote update SHALL NOT overwrite a dirty draft, pending save, or open editable overlay.

#### Scenario: Revalidation revokes mutation authority without hiding content

- **GIVEN** a current projection becomes revalidating or refresh-error
- **WHEN** a control requires that projection to be current
- **THEN** the control SHALL remain locked until a matching current replacement arrives
- **AND** the user SHALL still be able to read, select, and copy retained content

#### Scenario: A remote update reaches an active editor or dialog

- **GIVEN** a user has a dirty draft or an open editable dialog, popover, drawer, or editor
- **WHEN** a newer remote projection is observed
- **THEN** the local interaction SHALL remain intact
- **AND** the UI SHALL expose a local update-available convergence path instead of replacing the draft or closing the overlay

### Requirement: Truthful Native Lifecycle Behavior

The Web application SHALL use existing theme tokens, native CSS, stable DOM identity, View Transitions where already owned, `overflow-anchor: auto` for changing lists, and a reduced-motion equivalent. It SHALL not invent progress, ETA, live activity, or persistent global loading presentation.

#### Scenario: An unknown-total projection remains truthful

- **GIVEN** a projection reports an unknown total
- **WHEN** the UI presents its arrival state
- **THEN** it SHALL use an indeterminate visual cue only
- **AND** SHALL NOT display a percentage or ETA

#### Scenario: Static mode renders a static fact

- **GIVEN** a route is rendered from a static export snapshot
- **WHEN** the shared lifecycle atoms render
- **THEN** they SHALL present only the actual snapshot state
- **AND** SHALL NOT synthesize server-push, reconnect, or revalidation activity
