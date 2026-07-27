<!--
Orthogonal intents (created 2026-07-26 Asia/Shanghai):
1. Specify typed lifecycle for cached CLI projections while replacement work runs.
2. Specify official-source-audited dynamic trigger dependencies without parallel domain parsing.
3. Specify invalidation/lifecycle Push followed by typed projection Pull.
4. Prohibit healthy-path polling and require bounded degraded fallbacks.
5. Specify public-boundary and mutation-resistant proof for the shared mechanism.

Original request (2026-07-26): "最终计算结果本质是来自于 OpenSpec CLI 所提供的内容。即便现在有正在的任务，界面上仍然可以读到缓存，但它也能知道这个缓存现在正在被更新中。这是一套通用的数据拉取推送技术。"
Original request (2026-07-26): "更新 change，展开全面的接口升级和内核升级和测试升级，等全部完成之后，我再来继续做验收。"
-->

# cli-backed-reactive-projection Specification

## Purpose

Define typed retained lifecycle, invalidation Push followed by projection Pull, and timer-free freshness for cached
OpenSpec CLI-backed projections.

## Requirements

### Requirement: CLI Result Is The Cached Projection Truth

For every OpenSpec CLI-backed projection, the system SHALL cache only a settled typed CLI result together with
its raw payload/stdout, stderr, diagnostics, contract-drift evidence, success, and exit status. Filesystem reads,
parsed configuration fragments, watcher events, and invalidation generations SHALL only determine when that CLI
Work may be stale; they MUST NOT replace or reconstruct the projected OpenSpec business result.
Environment-global config Work SHALL observe the exact path returned by `openspec config path`; it MUST NOT treat
the distinct OpenSpec data home, project Context, or Store registry as global-config change evidence.

```text
physical/content trigger
          |
          v
invalidate CLI Work identity
          |
          v
run or join typed OpenSpec CLI ----------> settled CLI projection cache
```

#### Scenario: Trigger content changes a dynamic dependency

- **GIVEN** a settled CLI projection whose official execution reads a declaration that resolves another path
- **WHEN** that declaration changes, adds, moves, or removes the resolved path
- **THEN** the Work SHALL reconcile its observed dependency set and rerun the same typed CLI command
- **AND** no parser result used to discover the path SHALL be published as the CLI projection

### Requirement: Retained Snapshot And Replacement Lifecycle Are Independent Facts

The public projection contract SHALL represent no-data loading/error separately from data-present ready,
revalidating, and refresh-error states. A replacement run SHALL retain the latest settled CLI snapshot for display,
mark it non-authoritative, and report `revalidating` independently. Successful replacement SHALL atomically publish
the new settled snapshot as current. Failed replacement SHALL retain the prior snapshot as display-only with exact
refresh-error evidence. A retired generation SHALL NOT publish any late state, data, error, or invalidation effect.

#### Scenario: Slow replacement preserves readable cached data

- **GIVEN** CLI generation A settled successfully
- **WHEN** a matching trigger starts generation B and B remains in flight
- **THEN** clients SHALL be able to read A as `stale-display-only`
- **AND** SHALL independently observe that B is `revalidating`
- **AND** A SHALL NOT authorize any mutation while B is unresolved

#### Scenario: Replacement failure preserves prior truth without claiming freshness

- **GIVEN** CLI generation A settled successfully
- **WHEN** generation B fails with process, contract, diagnostic, or exit evidence
- **THEN** clients SHALL receive `refresh-error` with A retained for display
- **AND** the failure evidence SHALL remain attributed to B
- **AND** A SHALL NOT be relabelled current

### Requirement: Lifecycle Push Wakes Typed Projection Pull

The Server SHALL push only projection identity, Work generation, invalidation cause, and lifecycle. Each client SHALL
pull the corresponding typed projection after initial subscription, invalidation, reconnect, explicit refresh, or
mutation settlement. Same-identity subscribers SHALL join one bounded CLI execution, and each pull during that
execution SHALL return the retained lifecycle state without starting duplicate CLI processes.

#### Scenario: Two clients converge after one physical change

- **GIVEN** two clients observe the same current CLI projection
- **WHEN** one matching physical change invalidates it
- **THEN** both clients SHALL receive a lifecycle wake-up
- **AND** their pulls SHALL join one replacement CLI Work
- **AND** each SHALL first be able to read the retained updating state and later the same settled replacement

### Requirement: Healthy Projection Freshness Has No Polling Owner

Normal OpenSpec projection freshness SHALL be driven by observed files/directories/content-derived paths, explicit
mutation invalidation, transport reconnect, or user refresh. A periodic timer MAY exist only as a named bounded
fallback for watcher failure, missing-path observation, platform limitations, or an upstream substrate with no
change evidence. Heartbeats, debounce, PWA update checks, PTY sampling, and process maintenance SHALL remain
physically and semantically separate from OpenSpec projection freshness.

#### Scenario: Healthy watchers remain timer-free

- **GIVEN** launch, data-home, and dynamically discovered Store/Reference roots are observed successfully
- **WHEN** no physical change, mutation, reconnect, or explicit refresh occurs
- **THEN** no timer SHALL execute Root, Context, Store list, Store Doctor, or another CLI-backed projection
- **AND** the bounded fallback SHALL remain inert

### Requirement: Shared Mechanism Has Public And Mutation-Resistant Evidence

The implementation SHALL prove initial load, ready, revalidating with retained data, initial error, refresh-error,
dynamic dependency replacement, mutation-triggered multi-client convergence, absence of healthy polling, and late
generation retirement at checked public boundaries. A claimed red test SHALL fail at the named production owner,
and removing the exact cache transition, dependency reconciliation, single-flight join, or late-generation guard
SHALL make its corresponding test fail.

#### Scenario: Downstream fixture cannot substitute for the production owner

- **GIVEN** a test claims that a physical trigger refreshes a CLI-backed projection
- **WHEN** the real trigger-to-Work handoff is removed
- **THEN** that same named test SHALL fail before replacement data settles
- **AND** manually invoking a downstream refresh callback SHALL NOT satisfy the evidence
