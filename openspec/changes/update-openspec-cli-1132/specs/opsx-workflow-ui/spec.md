<!--
Orthogonal intents (created 2026-09-26 Asia/Shanghai):
1. Add the Change Detail Apply tracking-evidence direct-plane surface for CLI 1.13.2.

Original request (2026-09-26): "Openspec 1.13.2 释放了，更新本地引用。1. 调查变更内容，然后开始规划适配工作，我们将用标准工作流来推进。让 codex 参与 remix。2. 使用 vision 子代理负责端到端的走查验证，使用 ego-browser"
-->

## ADDED Requirements

### Requirement: Apply Tracking Evidence Surface

The Change Detail Apply status region SHALL surface the OpenSpec 1.13.2 Apply task-tracking evidence on
the direct plane: when `unavailableTrackingFiles` is non-empty, the region SHALL mount and render one
amber evidence line per entry with the file path and the upstream reason verbatim; when
`taskTrackingConfigured` is `false`, the region SHALL state that the schema tracks no tasks so empty
`tasks` are not missing evidence. Absent members SHALL render nothing (no fabricated `0/0` semantics, no
"tracking unavailable" claim for pre-1.13.2 CLIs). The evidence SHALL NOT redefine the Apply state,
progress, or unlock presentation owned by the CLI payload.

#### Scenario: Unreadable tracking files render as direct evidence

- **GIVEN** a Change Detail whose apply instructions carry
  `unavailableTrackingFiles: [{path: "/abs/x/tasks.md", reason: "EACCES: permission denied"}]`
- **WHEN** the detail renders
- **THEN** the Apply status region SHALL be mounted showing the path and the reason verbatim in an amber
  evidence treatment beside the existing warnings/build-order evidence
- **AND** the Apply state chip SHALL still reflect the payload's own `state`

#### Scenario: No-tracking schemas are not missing evidence

- **GIVEN** a Change Detail whose apply instructions carry `taskTrackingConfigured: false` and empty
  `tasks`
- **WHEN** the detail renders
- **THEN** the status region SHALL state that the schema tracks no tasks
- **AND** SHALL NOT present the empty task list as blocked or incomplete work

#### Scenario: Absent members render nothing extra

- **GIVEN** apply instructions decoded from a 1.13.0/1.13.1 payload (neither member present)
- **WHEN** the detail renders
- **THEN** the status region SHALL be exactly what the member-less payload implies today (regression
  guard)
