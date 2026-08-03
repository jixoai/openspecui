<!--
Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
1. Replace mixed Config tabs with route-backed owner pages.
2. Define Environment, Agent Delivery, Active Root, Init Alert, and adaptive Guide ownership.
3. Preserve custom YAML through structured and raw editing.

Original request (2026-08-01): investigate and redesign incomplete Config surfaces for OpenSpecUI 7.
Owner decisions (2026-08-01): Config workbench, `/config/agents`, raw YAML writes, adaptive Guide, and independent Init Alert.
Owner correction (2026-08-03): ready stages require explicit Continue; Spotlight uses one SVG even-odd bevel mask.
-->

# Delta for opsx-config-center

## MODIFIED Requirements

### Requirement: Dedicated Config view for OPSX configuration

OpenSpecUI SHALL provide a route-backed Config workbench that separates configuration owners while keeping Config
as one top-level application destination.

#### Scenario: Open Config overview

- **WHEN** the user opens `/config`
- **THEN** the page SHALL summarize Project Binding, Active Root, Environment, Agent Delivery, Schemas, and Resolved
  Context readiness
- **AND** expose Config-owned Init, Guide, and Context actions
- **AND** direct failures SHALL remain visible without hover or expansion

### Requirement: Config view uses tabs

Config SHALL NOT combine fixed owner domains and dynamic Schema entities in one horizontal tab strip. It SHALL use
route-backed secondary pages: `/config/project`, `/config/root`, `/config/environment`, `/config/agents`,
`/config/schemas`, `/config/schemas/:id`, and `/config/context`.

#### Scenario: Navigate Config on a narrow viewport

- **WHEN** the Config workbench is rendered in a narrow container
- **THEN** every owner page SHALL remain discoverable without horizontal page scrolling
- **AND** Schema entities SHALL be reached through the Schema catalog rather than clipped dynamic tabs
- **AND** each route SHALL have one page-level scroll owner

### Requirement: Config view surfaces project configuration

Project configuration SHALL be separated into Project Binding and Active Root owners. Project Binding SHALL own
structured `store` and `references`. Active Root SHALL own structured `schema`, `context`, `rules`, and
`operations`, while also exposing an explicit raw YAML whole-document mode.

#### Scenario: Save structured Active Root fields

- **GIVEN** the YAML contains comments, binding fields, and unknown team keys
- **WHEN** the user saves structured official fields
- **THEN** only the owned YAML nodes SHALL change
- **AND** comments, `store`, `references`, ordering where representable, and unknown keys SHALL be preserved

#### Scenario: Save custom raw YAML

- **GIVEN** the user opened raw YAML at revision A
- **WHEN** the user saves valid YAML containing custom keys and the file remains at revision A
- **THEN** OpenSpecUI SHALL atomically write the complete document
- **AND** refresh Project Binding, Active Root, Root Context, Schema, and action-readiness projections
- **AND** SHALL NOT reject unknown keys merely because official OpenSpec does not define them

#### Scenario: Reject a stale raw save

- **GIVEN** the physical YAML changed after revision A was loaded
- **WHEN** the user attempts to save revision A
- **THEN** OpenSpecUI SHALL reject the write as a configuration revision conflict
- **AND** preserve the latest physical source for review

## ADDED Requirements

### Requirement: Environment and Agent Delivery Have One Structured Owner Each

Environment SHALL own machine `defaultStore`, feature flags, data-scope/config-path evidence, and unknown
passthrough evidence. `/config/agents` SHALL solely own structured `profile`, `delivery`, `workflows`, Agent
inventory, and Init/Update/repair execution.

#### Scenario: Configure machine default Store

- **WHEN** the user sets or clears `defaultStore`
- **THEN** Environment SHALL preserve the exact configured value through settlement
- **AND** Root Context SHALL independently report whether the CLI selected it effectively
- **AND** Project Binding SHALL NOT mirror the machine value

#### Scenario: Configure Agent delivery policy

- **WHEN** the user changes `profile`, `delivery`, or `workflows`
- **THEN** `/config/agents` SHALL be the structured mutation owner
- **AND** Environment and Settings SHALL provide no second structured editor

### Requirement: Initialize Project Alert

When the Launch Project lacks a local `openspec/` directory, OpenSpecUI SHALL offer one explicit-confirmation
Initialize Project Alert globally and through Config.

#### Scenario: Open without automatic mutation

- **GIVEN** local OpenSpec initialization is absent
- **WHEN** the Alert opens
- **THEN** it SHALL display the exact proposed command and local/effective Root facts
- **AND** SHALL NOT execute until the user confirms

#### Scenario: Complete initialization

- **WHEN** `openspec init <launch-project> --tools=none` settles successfully
- **THEN** the same Alert SHALL preserve the successful command evidence and transition to its success state
- **AND** SHALL expose `[Ok] [Start Guide]` without opening a second Dialog
- **AND** `Ok` SHALL close without starting the Guide
- **AND** `Start Guide` SHALL begin the adaptive Config Guide

#### Scenario: Dismiss the automatic offer

- **WHEN** the user closes the automatic Alert before initialization
- **THEN** automatic reopening SHALL be suppressed only for the current page runtime
- **AND** Config SHALL continue to expose Init while local setup remains absent

### Requirement: Adaptive Config Guide

Config SHALL provide one typed adaptive Guide for Project Binding, Active Root, Agent Delivery, and Resolved Context
verification. A guide library MAY render focus and popovers but SHALL NOT own readiness, navigation authority,
mutation, or completion.

#### Scenario: Ready stages require explicit continuation

- **GIVEN** a Guide stage is objectively current and ready
- **WHEN** the Guide observes that projection
- **THEN** the stage SHALL remain visible and SHALL enable Continue
- **AND** SHALL NOT advance until the user explicitly activates Continue
- **AND** warning, stale, blocked, failed, or active-edit stages SHALL keep Continue disabled

#### Scenario: Complete the Guide

- **WHEN** Resolved Context is current, reports a usable selected Root, and the user explicitly activates Continue
- **THEN** the Guide MAY complete after every preceding stage was explicitly continued
- **AND** presentation callbacks alone SHALL NOT mark completion

#### Scenario: Preserve target interaction through one bevel mask

- **WHEN** the Guide highlights a mounted semantic target
- **THEN** one SVG even-odd mask SHALL block pointer input only outside the hole
- **AND** the real target SHALL remain interactive without target DOM mutation
- **AND** the hole SHALL derive bevel cuts from computed target corner radii
- **AND** browsers without `corner-shape: bevel` SHALL receive square hole corners
