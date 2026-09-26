<!--
Orthogonal intents (created 2026-09-26 Asia/Shanghai):
1. Add the Apply task-tracking evidence typed contract for CLI 1.13.2.
2. Add the Kilo Code command-path registry rotation as a pinned physical fact.
3. Add artifact-glob recognition parity for dependency-watch granularity.

Original request (2026-09-26): "Openspec 1.13.2 释放了，更新本地引用。1. 调查变更内容，然后开始规划适配工作，我们将用标准工作流来推进。让 codex 参与 remix。2. 使用 vision 子代理负责端到端的走查验证，使用 ego-browser"
-->

## ADDED Requirements

### Requirement: Apply Task Tracking Evidence Contract

OpenSpecUI SHALL decode the OpenSpec 1.13.2 `instructions apply --json` task-tracking members as typed
facts: `taskTrackingConfigured` (boolean, `true` when the schema sets a non-null `apply.tracks` even if
no file matches) and `unavailableTrackingFiles` (array of `{path, reason}` for every matched tracking
file that could not be read). Because the admission window `>=1.13.0 <1.14.0` also admits 1.13.0/1.13.1
executables that never emit `taskTrackingConfigured`, the decode schemas SHALL treat both members as
optional with absent-when-upstream-absent semantics: absence of `taskTrackingConfigured` SHALL mean
"unknown (pre-1.13.2 CLI)" and SHALL NEVER be synthesized as `false`; `unavailableTrackingFiles` SHALL
be absent when every matched file is readable (never `null`, never an empty synthesized array). Both
members SHALL project verbatim through the Apply instructions projection chain as evidence and SHALL
NOT gate apply state, CLI progress authority, or any action unlock.

#### Scenario: Decode and project tracking evidence from a 1.13.2 payload

- **GIVEN** an `instructions apply --json` success payload carrying
  `taskTrackingConfigured: true` and `unavailableTrackingFiles: [{path: "/abs/tasks.md", reason: "EACCES: permission denied"}]`
- **WHEN** the payload is decoded through the CLI contract schema and projected through the Apply
  instructions schema
- **THEN** both members SHALL be retained as typed facts with the path and reason verbatim
- **AND** the projected `state` and `applyInstructionProgress` SHALL be exactly what the payload's own
  `state` and `progress` imply (no local gating from the new members)

#### Scenario: Absent members on pre-1.13.2 payloads stay absent

- **GIVEN** an `instructions apply --json` payload produced by a 1.13.0/1.13.1 executable (neither
  member present)
- **WHEN** the payload is decoded and projected
- **THEN** the projection SHALL carry neither member
- **AND** SHALL NOT synthesize `taskTrackingConfigured: false` or an empty `unavailableTrackingFiles`
  array

#### Scenario: Glob-tracked task aggregation is the CLI's count

- **GIVEN** a change whose schema sets `apply.tracks` to a glob matching more than one concrete file
- **WHEN** the 1.13.2 CLI apply instructions are read
- **THEN** `tasks` and `progress` SHALL reflect every readable matched file as the CLI aggregated them
- **AND** the local tracked-task divergence projection SHALL compare against that aggregated truth
  without redefining the CLI denominators (2026-08-18 law)

#### Scenario: Tracking configured with zero matched files stays configured

- **GIVEN** a 1.13.2 payload whose schema sets a non-null `apply.tracks` that matches zero concrete
  files
- **WHEN** the payload is decoded
- **THEN** `taskTrackingConfigured` SHALL be `true` with empty `tasks`
- **AND** the projection SHALL NOT recode the fact as no-tracking (`false`) or as missing evidence

#### Scenario: Unreadable tracking evidence keeps all_done unreachable

- **GIVEN** a 1.13.2 payload whose `apply.tracks` matches one unreadable and one readable file, the
  readable file holding only complete tasks, and whose CLI-resolved `state` is `ready` (the upstream
  state chain excludes `all_done` while any matched file is unreadable)
- **WHEN** the payload is decoded and projected
- **THEN** the projected `state` SHALL be the payload's `ready` verbatim (not rewritten, not
  `all_done`) and `unavailableTrackingFiles` SHALL name the unreadable path with its reason

### Requirement: Agent Registry Kilo Command Path Rotation

The Agent delivery registry snapshot for the `'1.13'` series SHALL carry Kilo Code's command delivery
path as `.kilo/command/opsx-{workflow}.md` (the pinned 1.13.2 physical reality) while preserving the
previous in-series path `.kilocode/workflows/opsx-{workflow}.md` as legacy path evidence. The skills
directory SHALL remain `.kilocode`. Cleanup patterns SHALL cover both legacy generations in the old
folder (`.kilocode/workflows/opsx-*.md` and `.kilocode/workflows/openspec-*.md`) and SHALL NOT mark the
live `.kilo/command/` folder as cleanup-owned. OpenSpecUI continues to never hand-write or delete Agent
artifacts; the registry is delivery/inventory evidence mirrored from the pinned CLI.

#### Scenario: Registry projects the rotated path

- **WHEN** the Agent registry inventory is selected for an admitted 1.13.x CLI
- **THEN** the Kilo Code command artifact SHALL carry pathTemplate `.kilo/command/opsx-{workflow}.md`
  with plain-markdown content and `legacyPathTemplates` containing
  `.kilocode/workflows/opsx-{workflow}.md`
- **AND** the registry's raw cleanup patterns SHALL list exactly the two legacy generations of the old
  folder (`.kilocode/workflows/opsx-*.md`, `.kilocode/workflows/openspec-*.md`) — distinct from the
  runtime cleanup projection: the legacy `opsx-*` generation is ambiguity-skipped as a pattern and
  retired through `legacyCommandWorkflows` per-artifact, while the `openspec-*` wildcard enumerates
  matches as evidence per the registry's inherited wildcard-projection convention (upstream's own
  cleanup is an exact allowlist; a user file matching the wildcard is still collected as evidence —
  a documented projection divergence, and OpenSpecUI executes no deletion itself), and `.kilo/command/`
  never appears in any cleanup pattern or runtime result

#### Scenario: Pinned executable generates the new path

- **GIVEN** the pinned `openspec-cli-113` fixture (1.13.2) initializing the `kilocode` tool in a fixture
  repository
- **WHEN** command generation runs
- **THEN** files SHALL be generated under `.kilo/command/opsx-<id>.md`

### Requirement: Artifact Glob Recognition Parity

The local `isGlobPattern` mirror SHALL recognize the same glob syntax the pinned CLI's artifact-graph
recognizes: the original wildcard characters (`*`, `?`, `[`), brace expansions containing `,` or `..`,
and extglob groups, after POSIX separator normalization. The mirror exists solely to keep
dependency-watch granularity aligned (directory-tree watch for glob outputs, single-file watch for
literal outputs); it SHALL NOT fork the upstream semantics. This parity is a watcher-granularity fact
only: the tracked-task file matcher (`opsxPathMatchesPattern`) stays wildcard-class, and OpenSpecUI
SHALL document brace/extglob task tracking as a boundary rather than a silent divergence.

#### Scenario: Brace and extglob outputs are watched as globs

- **GIVEN** a schema artifact output path `docs/{api,cli}.md` or `!(a|b).md`
- **WHEN** artifact output dependencies are touched for reactive watching
- **THEN** the path SHALL be recognized as a glob pattern and watched at its directory granularity
- **AND** literal paths without wildcard, brace-expansion, or extglob syntax SHALL keep single-file
  watching
