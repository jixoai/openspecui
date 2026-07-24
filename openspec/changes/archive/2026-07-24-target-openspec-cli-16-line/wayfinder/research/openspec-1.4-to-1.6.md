<!--
Orthogonal intents (updated 2026-07-15 Asia/Shanghai):
1. Establish the official v1.4.0/v1.4.1 -> v1.6.0 release evidence chain.
2. Record version-by-version public CLI, JSON, filesystem, workflow, and tool changes.
3. Pin task, validation, archive, and store semantics that can change OpenSpecUI behavior.
4. Separate shipped behavior from fixes, docs, and internal release infrastructure.
5. Identify OpenSpecUI adaptation consequences without implementing them.

Original requests (2026-07-15):
- "1.4(我们目前适配的) 到 1.6，最终有哪些变更落地，以及你推荐的适配方案是什么？"
- "那是我记错了，但我不确定1.5的适配已经完整，所以可以顺便看一下"
-->

# OpenSpec 1.4 to 1.6 adaptation research

## Scope and source law

OpenSpecUI 5.x nominally targets OpenSpec CLI 1.5.x, but that version label is not treated as proof of complete adaptation. This note therefore audits the full 1.4.x -> 1.6.0 contract, including whether the 1.4 and 1.5 behavior actually reached OpenSpecUI. It uses only the checked-out official repository under `references/openspec`: release tags, `CHANGELOG.md`, commits, source, tests, and first-party docs.

The source priority used here is:

```text
release tag + executable source/tests
             > checked-in OpenSpec specs
             > CHANGELOG
             > prose docs
```

This matters because the `v1.6.0` prose docs still contain a stale workflow list; the runtime profile and tests are internally consistent and are treated as authoritative.

| Release  | Dereferenced tag commit                    | Main release evidence                                                     |
| -------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| `v1.4.0` | `bc7ab26650a43384ad525de42a7f58eaa13846f5` | `references/openspec/CHANGELOG.md:75-108`                                 |
| `v1.4.1` | `1b06fddd59d8e592d5b5794a1970b22867e85b1f` | `references/openspec/CHANGELOG.md:69-73`, fix commit `0a01146` / PR #1165 |
| `v1.5.0` | `546224e00db26bd1be69874be465d5d6f5e4a851` | `references/openspec/CHANGELOG.md:51-67`                                  |
| `v1.6.0` | `e1b51d111ab446b54dee2d6159ac245f0339ae52` | `references/openspec/CHANGELOG.md:3-49`                                   |

## Executive delta

The adaptation is not one new command. The durable topology is:

```text
1.4.x baseline
  repo-local root + workspace/context-store/initiative beta
  top-level tasks.md progress
  11 generated OPSX workflows
              |
              | v1.5.0 breaking root-model replacement
              v
1.5.x
  Store + Reference + Context + Workset model
  root-aware JSON and --store on lifecycle commands
  workspace / context-store / initiative commands removed
              |
              | v1.6.0 workflow and correctness convergence
              v
1.6.x
  12 workflows, including agent-side /opsx:update
  Oh My Pi + Trae command delivery
  apply.tracks-selected task progress
  stricter and more faithful validate/archive behavior
  empty stores accepted before Git materializes optional directories
```

For OpenSpecUI, the high-risk contracts are:

1. Root identity and path provenance introduced in 1.5.
2. The 1.6 `update` workflow added to profile and generated-artifact completeness.
3. The task-progress definition narrowed from all candidate Markdown to the single artifact selected by `apply.tracks`.
4. Validation and archive now reject cases that previously resolved or exited incorrectly.

## Version-by-version release changes

### v1.4.0: the current adaptation baseline

These are baseline facts, not new 1.6 work, but they define what "already adapted" means:

| Change                                                           | Kind              | Evidence                                                                      | OpenSpecUI relevance                                                          |
| ---------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Kimi CLI skills-only support under `.kimi/skills/`               | New public tool   | `references/openspec/CHANGELOG.md:79-85`, commit `342ed43` / PR #1003         | Already represented in `packages/core/src/tool-config.ts:170-176`.            |
| Mistral Vibe skills-only support under `.vibe/skills/`           | New public tool   | `references/openspec/CHANGELOG.md:87-90`, commit `e364630` / release PR #1154 | Already represented in `packages/core/src/tool-config.ts:194-200`.            |
| Requirement headers parse case-insensitively                     | Parser fix        | `references/openspec/CHANGELOG.md:91-94`, commit `2d189ce` / PR #1031         | Keep as validation regression coverage; no new 1.6 surface.                   |
| Header-only SHALL/MUST receives a targeted remediation hint      | Validation UX fix | `references/openspec/CHANGELOG.md:96-98`, commit `9aded17` / PR #1135         | 1.6 later extends the same hint to main specs.                                |
| `/opsx:sync` enters the default core profile                     | Profile change    | `references/openspec/CHANGELOG.md:100-102`, commit `485c97e` / PR #1030       | The 1.6 profile change follows this same contract shape.                      |
| oh-my-zsh completion setup and canonical workspace aliases fixed | Runtime fixes     | `references/openspec/CHANGELOG.md:93-94,104-108`                              | No OpenSpecUI product surface unless it wraps completion installation errors. |

### v1.4.1: workspace collision and update routing

`v1.4.1` moved beta workspace view state from a foreign-looking root `workspace.yaml` into `.openspec-workspace/view.yaml`, stopped treating arbitrary root `workspace.yaml` files as OpenSpec workspaces, and stopped top-level `openspec update` from silently invoking a workspace update. A workspace update had to be explicit as `openspec workspace update`. Evidence: `references/openspec/CHANGELOG.md:69-73`, commit `0a01146` / PR #1165.

This behavior is transitional. `v1.5.0` removes the workspace and initiative command families entirely. OpenSpecUI should remove surviving workspace assumptions rather than build 1.4.1 compatibility glue for the 1.6 target. The removal is locked by `references/openspec/test/commands/legacy-groups-removed.test.ts:67-92`.

### v1.5.0: breaking Stores root model

#### Removed public surfaces

Commit `a0decbe` / PR #1190 is explicitly breaking (`feat(stores)!`) and replaces the prior workspace/initiative model.

| Removed surface                                                     | Final behavior                                                 | Evidence                                                                                                        |
| ------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `openspec workspace ...`                                            | Unknown command; absent from help                              | `references/openspec/test/commands/legacy-groups-removed.test.ts:67-82`                                         |
| `openspec initiative ...`                                           | Unknown command; absent from help                              | same test                                                                                                       |
| `openspec context-store ...`                                        | Replaced by `store`                                            | command diff in commit `a0decbe`                                                                                |
| `openspec set change ...` and initiative attachment                 | Removed                                                        | `v1.4.1..v1.5.0` CLI diff, commit `a0decbe`                                                                     |
| `new change --initiative` / `--areas`                               | Deliberate structured failure, not silently ignored            | `references/openspec/src/commands/workflow/new-change.ts:55-70`                                                 |
| direct `--store-path` lifecycle targeting                           | Rejected; register a store, then select it with `--store <id>` | `references/openspec/src/core/root-selection.ts:349-360`                                                        |
| bundled `workspace-planning` schema and workspace-specific guidance | Deleted                                                        | commit `a0decbe`; parity guard `references/openspec/test/core/templates/skill-templates-parity.test.ts:197-210` |

No 1.6 adapter should expose both old and new root models. Protocol compatibility, if ever required for an older OpenSpecUI line, belongs in a physically separate version implementation.

#### New commands and responsibilities

| Command                                              | Public responsibility                                                                                    | JSON/exit contract                                                                                                          | Evidence                                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `store setup/register/unregister/remove/list/doctor` | Create/register machine-known standalone planning repositories; inspect and remove registrations/files   | Store-family snake_case payloads; mutation failures preserve null fields plus `status`; human prompt cancellation exits 130 | `references/openspec/src/commands/store.ts:31-117,661-799`; `references/openspec/docs/agent-contract.md:79-92` |
| `doctor`                                             | Read-only health inspection of current root, selected store, and references                              | Health findings remain exit 0; command failure is root/store null-shape + `status`, exit 1                                  | `references/openspec/docs/agent-contract.md:73-74,85-92`                                                       |
| `context`                                            | Build the current root plus available referenced-store working set; optionally write a VS Code workspace | One JSON document; `--code-workspace` is its only write                                                                     | `references/openspec/docs/agent-contract.md:76-77`                                                             |
| `workset create/list/open/remove`                    | Persist and reopen a personal multi-folder view                                                          | Per-machine, not committed; members are not mutated                                                                         | `references/openspec/src/commands/workset.ts:566-625`; `references/openspec/src/core/worksets.ts:26-81`        |

#### New filesystem layout

```text
<store>/
├── .openspec-store/store.yaml       # committed store identity, version/id/remote
└── openspec/                        # committed planning root
    ├── config.yaml
    ├── specs/
    └── changes/

<global-data-dir>/openspec/
├── stores/registry.yaml             # machine-local store id -> checkout
└── worksets/worksets.yaml           # machine-local personal views
```

Sources: `references/openspec/src/core/store/foundation.ts:28-65,77-92`, `references/openspec/src/core/global-config.ts:60-104`, `references/openspec/src/core/worksets.ts:26-71`, and `references/openspec/docs/stores-beta/user-guide.md:332-343`.

Project `openspec/config.yaml` gains two root/context declarations:

- `store: <id>` is only a fallback for a config-only repository. It never overrides a real local planning shape (`references/openspec/src/core/project-config.ts:42-54`).
- `references:` declares read-only stores whose spec index is included in artifact/apply instructions (`references/openspec/src/core/project-config.ts:56-127`; JSON shape at `references/openspec/docs/agent-contract.md:59-65`).

#### Root resolution and path provenance

The root selection algorithm becomes part of the public CLI protocol:

```text
explicit --store <id>
  > nearest qualifying openspec/ ancestor
  > config-only store: declaration
  > error when stores are registered but no root was selected
  > implicit cwd only when the command allows scaffolding and no stores exist
```

Evidence: `references/openspec/src/core/root-selection.ts:349-404` and `references/openspec/docs/agent-contract.md:28-43`.

The machine-readable result adds:

```json
{
  "root": {
    "path": "/absolute/path",
    "source": "store | declared | nearest | implicit",
    "store_id": "optional-id"
  }
}
```

`RootOutput` is emitted at `references/openspec/src/core/root-selection.ts:411-422`. `list`, `show`, `validate`, `archive`, `status`, `instructions`, and `new change` support root selection. `view`, `templates`, `schemas`, and deprecated noun forms remain cwd-based; the limitation is explicit at `references/openspec/docs/stores-beta/user-guide.md:319-330`.

OpenSpecUI impact: absolute paths and `root.source` must be preserved through CLI parsing. Reconstructing paths from the server cwd can target the wrong repository for declared/explicit stores.

#### JSON and exit behavior introduced with Stores

The first-party agent contract summarizes the durable protocol:

- `--json` produces one JSON document on stdout; human prose/spinners/store banners go to stderr (`references/openspec/docs/agent-contract.md:5-10`).
- Workflow payloads remain mostly camelCase, store/context/doctor payloads use snake_case, and embedded `root.store_id` is always snake_case (`references/openspec/docs/agent-contract.md:7-10,126-136`).
- Root-resolution failures in JSON mode return a command-specific empty/null shape plus a diagnostic `status` array and exit 1 (`references/openspec/docs/agent-contract.md:37-43`).
- Archive gains strict non-interactive JSON mode. Success is `{archive:{change,archivedAs,path,specsUpdated,totals?},root}`; failure is `{archive:null,root?,status:[...]}` and exit 1 (`references/openspec/docs/agent-contract.md:70-71`).

OpenSpecUI already uses a lenient Store parser/fault model (`packages/core/src/store-types.ts:24-99,139-215`). The 1.6 work should preserve additive-field tolerance while adding fixtures for empty stores and current diagnostic codes.

#### Other v1.5 behavior

| Change                                                                                                                  | Kind                      | Evidence                                                                                                                                                        | OpenSpecUI impact                                                               |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `config set` parses JSON array/object containers; malformed containers remain strings; `--string` still forces a string | Config bug fix            | commit `f987cf3` / PR #1216/#1244; `references/openspec/src/core/config-schema.ts:141-209`; tests `references/openspec/test/core/config-schema.test.ts:146-188` | Profile/custom-workflow writes can use structured arrays instead of ad hoc CSV. |
| YAML frontmatter escapes carriage returns and centralizes escaping for Bob/Claude/Cursor/Pi/Windsurf                    | Adapter fix               | commit `cbf386b` / PR #1240; `references/openspec/src/core/command-generation/yaml.ts:1-38`                                                                     | Regenerate/inspect tool artifacts; do not duplicate the upstream serializer.    |
| Completion and shell-profile installers check actual writable file/directory permissions before mutation                | Installer correctness fix | commit `41ceebe` / PR #1247                                                                                                                                     | Surface init/update failures; not a new OpenSpecUI feature.                     |
| Documentation overhaul: explore-first guidance, command-location docs, existing-project and edit-change guides          | Docs only                 | commit `bb1f18c` / PR #1237                                                                                                                                     | Product docs/copy should be refreshed, but no runtime adapter is needed.        |
| Dependency/lock refresh                                                                                                 | Internal                  | commit `737518b` / PR #1249                                                                                                                                     | No OpenSpecUI contract.                                                         |

### v1.6.0: workflow and tool delivery

#### `/opsx:update` is an Agent workflow, not `openspec update`

Two similarly named surfaces remain orthogonal:

```text
openspec update [path]
  refreshes generated instruction / skill / command files

/opsx:update [change]
  asks an agent to revise existing planning artifacts coherently
```

The new workflow:

- reads change/artifact ids and concrete paths from `openspec list/status/instructions --json`;
- never branches on hard-coded artifact names;
- edits only `artifactPaths.<id>.existingOutputPaths`, never a glob `resolvedOutputPath`;
- never creates missing artifacts or advances the artifact frontier;
- never edits implementation code; implementation is handed to `/opsx:apply`;
- confirms each artifact edit and recommends a new change when intent, rather than detail, changes.

Evidence: `references/openspec/src/core/templates/workflows/update-change.ts:10-91,94-175` and contract tests `references/openspec/test/core/templates/update-change.test.ts:19-87` (commit `a70dacc` / PR #1278).

`update` is not optional-expanded-only. The core profile becomes six workflows and the complete registry becomes twelve:

```text
core = propose, explore, apply, update, sync, archive
all  = propose, explore, new, continue, apply, update,
       ff, sync, archive, bulk-archive, verify, onboard
```

Sources: `references/openspec/src/core/profiles.ts:10-34`, `references/openspec/test/core/profiles.test.ts:9-37`, and `references/openspec/src/core/shared/skill-generation.ts:54-105`.

OpenSpecUI currently hard-codes eleven workflows in both tool state and public hook/invocation contracts (`packages/core/src/tool-init-state.ts:6-20`; `packages/core/src/hooks.ts:67-102`). It must add `update` consistently across expected skills, command paths, profile drift, hook input, invocation prompt/command generation, routes/actions, and tests. Treating only the Settings badge as changed would leave false "initialized" states and make the workflow inaccessible elsewhere.

#### New and upgraded tools

| Tool                  | v1.6 change                                    | Exact generated layout/behavior                                                                                                                            | Evidence                                                                                                                                                       | Current OpenSpecUI gap                                                                                                                                                                         |
| --------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oh My Pi (`oh-my-pi`) | Entirely new supported tool                    | skills under `.omp/skills/`; commands `.omp/commands/opsx-<id>.md`; command references become `/opsx-...`; `$@` is injected after `**Input**:` when absent | commit `8886e3a` / PR #1276; `references/openspec/src/core/config.ts:45`; adapter `references/openspec/src/core/command-generation/adapters/oh-my-pi.ts:27-54` | Missing from `packages/core/src/tool-config.ts:57-223` and `TOOL_COMMAND_PATHS`.                                                                                                               |
| Trae (`trae`)         | Upgraded from skills-only to skills + commands | `.trae/commands/opsx-<id>.md`, `name`/`description` YAML frontmatter                                                                                       | commit `3f0ca3f` / PR #1090; `references/openspec/src/core/command-generation/adapters/trae.ts:32-52`                                                          | Tool metadata exists at `packages/core/src/tool-config.ts:215`, but `packages/core/src/tool-init-state.ts:68-175` has no Trae command path, so completeness is wrong in command/both delivery. |

All generated `SKILL.md` files now include `allowed-tools: Bash(openspec:*)`. Claude Code slash commands include the same field. It pre-approves the OpenSpec CLI and does not restrict other tools. Sources: commit `a5bfeda` / PR #1300, `references/openspec/src/core/shared/allowed-tools.ts:1-11`, `references/openspec/src/core/shared/skill-generation.ts:132-154`, and `references/openspec/src/core/command-generation/adapters/claude.ts:20-42`.

OpenSpecUI should treat `allowed-tools` as generated-content drift owned by `openspec update`, not invent its own skill rewriting.

### v1.6.0: task progress semantics

#### Previous behavior

In both `v1.4.1` and `v1.5.0`, `getTaskProgressForChange` read exactly `changes/<name>/tasks.md`, returning `0/0` on read failure. Evidence: `v1.4.1:src/utils/task-progress.ts:27-34` and `v1.5.0:src/utils/task-progress.ts:27-34`.

#### Final 1.6 behavior

OpenSpec 1.6 defines task progress procedurally:

```text
resolve schema for change
  |
  +-- apply.tracks exists
  |     select artifact where artifact.generates === apply.tracks
  |
  +-- no apply.tracks
        select artifact id == "tasks"
  |
expand that one artifact.generates under the change
  |
aggregate checkbox lines across every matched file
  |
schema unresolved / artifact absent / zero files
  -> fallback to top-level tasks.md
```

Sources: `references/openspec/src/utils/task-progress.ts:30-107` and tests `references/openspec/test/utils/task-progress.test.ts:68-167` (commit `a325305` / PR #1280, issue #1202).

This helper now drives:

- `openspec list` JSON status and counts;
- interactive `view` classification;
- deprecated `change list` counts;
- archive's incomplete-task prompt/blocking gate.

The archive gate is at `references/openspec/src/core/archive.ts:345-375`. Therefore, UI progress that disagrees with this rule can call a change complete while archive blocks it, or call it incomplete while archive permits it.

Current OpenSpecUI selects every schema artifact output pattern plus `applyTracks`, then scans every matching Markdown file (`packages/core/src/task-progress.ts:70-105`). That is broader than 1.6. The upstream-consistent OpenSpec task metric should select only the tracked artifact. If the product retains an "all planning checkboxes" metric, it must be a separately named projection, not `OpenSpec task progress`.

#### Verified upstream inconsistency: apply instructions and glob tracking

`openspec instructions apply --json` still treats `apply.tracks` as one literal path using `path.join(changeDir, tracksFile)` and a single read (`references/openspec/src/commands/workflow/instructions.ts:351-385`). It does not expand a tracked glob, while `list/view/archive` do.

Consequences:

- For a glob-tracked schema, do not replace the 1.6 tracked-artifact projection with `instructions apply` progress.
- Preserve the raw apply response for execution guidance, but calculate dashboard/archive-readiness parity from the tracked artifact until upstream converges these paths.
- Lock this known divergence with an explicit fixture instead of normalizing it away silently.

### v1.6.0: validation semantics

#### Change resolution and nested deltas

`openspec validate <change>`, `--changes`, `--all`, and the interactive selector now identify a change by directory existence, matching `status` and `instructions`. They no longer require `proposal.md`. A scaffolded/authoring change is validated, and an invalid proposal-less change exits 1 instead of being reported as unknown. Sources: `references/openspec/src/commands/validate.ts:81-120,132-211`; `references/openspec/test/commands/validate.test.ts` tests introduced by commit `a325305` / PR #1280, issue #1182.

Delta discovery recursively validates `specs/<area>/<capability>/spec.md` as well as the one-level form (`references/openspec/src/core/validation/validator.ts:120-142`). This guarantee is specific to validation; the release does not establish that every archive discovery path accepts arbitrary nested capability depth.

#### Unified requirement reader

Validation of changes, main specs, and archive rebuilds now shares a fence-, metadata-, and multi-line-aware reader (`references/openspec/src/core/parsers/requirement-text.ts:1-150`, commit `9a0dfb5` / PR #1281):

| Input case                                                         | 1.6 result                                                                                          |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Requirement text wraps and SHALL/MUST appears later                | Full body is retained; keyword passes.                                                              |
| `**ID**:` / `**Priority**:` precedes prose                         | Metadata is skipped when prose exists.                                                              |
| Body contains only metadata such as `**Constraint**: ... MUST ...` | Metadata remains the requirement text.                                                              |
| Fenced example precedes prose                                      | Fence content is not mistaken for requirement text.                                                 |
| `#### Scenario:` appears inside a fence                            | It is not counted as a real scenario.                                                               |
| SHALL/MUST appears as a substring                                  | It does not pass; the predicate is whole-word and uppercase.                                        |
| Canonical requirement has no body                                  | Display can fall back to title, while validation still emits the targeted body-keyword remediation. |

Displayed/JSON requirement text now contains the full body rather than only its first line (`references/openspec/CHANGELOG.md:37-47`). OpenSpecUI schemas and previews must tolerate embedded newlines.

In an `ADDED` or `MODIFIED` section, a non-canonical level-three header such as `### Documentation Requirements` generates an INFO issue with line metadata but does not make the report invalid, even under `--strict`. Source: `references/openspec/src/core/validation/validator.ts:141-160` and `references/openspec/src/core/parsers/requirement-blocks.ts:202-240`.

The header-only SHALL/MUST hint from 1.4 is extended to main specs, matching deltas (commit `a325305`, issue #1156).

### v1.6.0: archive semantics

#### Exit code correctness

Human-mode archive now sets exit code 1 on all three blocking paths:

1. change delta validation failure (`references/openspec/src/core/archive.ts:285-313`);
2. spec rebuild failure (`references/openspec/src/core/archive.ts:417-436`);
3. rebuilt-spec validation failure (`references/openspec/src/core/archive.ts:439-460`).

Regression tests are `references/openspec/test/core/archive.test.ts:919-1072`. JSON mode already failed non-zero. This is commit `5956a8e` / PR #1311.

OpenSpecUI must use process success/exit status as the primary success signal and then parse the JSON diagnostic envelope when requested. Searching stdout for "Validation failed" is no longer defensible.

#### Scenario-loss protection

When applying a `MODIFIED` requirement, archive compares scenario names in the current main requirement against the incoming modified block. If the incoming block omits a current scenario, archive aborts and leaves the change unarchived, preventing a stale parallel change from silently deleting scenarios. Sources: `references/openspec/src/core/specs-apply.ts:289-309,395-428`, `references/openspec/test/core/archive.test.ts:627-703`, commit `7e21cc5` / PR #1252, issue #1246.

Archive also prepares all spec rebuilds and validates each one before writing any target, preserving atomic no-write behavior on a late failure (`references/openspec/src/core/archive.ts:417-465`).

The appropriate UI response is to display the exact CLI failure and leave the change active. OpenSpecUI must not retry with `--no-validate` or synthesize a merged delta automatically.

### v1.6.0: empty Store correctness

Fresh store clones may legitimately lack `openspec/specs/`, `openspec/changes/`, and `openspec/changes/archive/`, because Git cannot preserve empty directories. In 1.6 those paths are optional when absent, but remain errors when a non-directory occupies the path. `openspec/config.yaml` and store identity still establish health. Sources: `references/openspec/src/core/openspec-root.ts:97-122,186-228`, commit `93e27a7` / PR #1328.

As a result:

- an empty store can register before any spec/change/archive exists;
- `list --json` succeeds with an empty changes array rather than "run init";
- archive selection reports no active changes instead of failing on the absent directory;
- a config-only repo that declares `store:` remains a pointer and cannot be registered as the store itself (`references/openspec/src/core/store/operations.ts`, commit `93e27a7`).

OpenSpecUI's Stores Beta parser is already permissive, but list/doctor UI tests need an empty healthy-store fixture. Missing optional folders must not be rendered as corruption.

## Contract summary by adaptation surface

| Surface               | 1.4/1.4.1                                                                 | 1.6 final contract                                                                                | Adaptation consequence                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Version line          | OpenSpecUI 4.x targets 1.4                                                | Existing law implies OpenSpecUI 6.x targets 1.6, with 1.5 as immediately previous compatible line | Update gate, specs, package/docs copy, reference check, and built assets together. Current constants are still 5.x/1.5 at `packages/core/src/openspec-compat.ts:1-11`. |
| Root                  | Repo-local plus now-deleted workspace beta                                | Shared root resolver, Stores Beta, `root` JSON provenance                                         | Preserve root/path, do not infer from cwd.                                                                                                                             |
| Workflow profile      | 11 total; 5 core including sync                                           | 12 total; 6 core including update                                                                 | Add workflow in every registry and drift/completeness calculation.                                                                                                     |
| Tools                 | Kimi/Vibe skills-only; Trae skills-only                                   | OMP skills+commands; Trae skills+commands                                                         | Add OMP metadata/path and Trae command path.                                                                                                                           |
| Generated frontmatter | Tool-specific prior content                                               | All skills and Claude commands pre-approve `Bash(openspec:*)`                                     | Let CLI own generated files; update drift fixtures.                                                                                                                    |
| Task progress         | One top-level `tasks.md`                                                  | One tracked artifact, possibly a glob with many files                                             | Replace all-artifact aggregation for the canonical metric.                                                                                                             |
| Validate resolution   | `proposal.md` membership assumptions                                      | Change directory existence; recursive nested delta validation                                     | Accept authoring/scaffold states and multiline requirement JSON.                                                                                                       |
| Archive               | Human validation blocks could exit 0; stale MODIFIED could drop scenarios | Exit 1 on blockers; atomic rebuild; scenario-loss guard                                           | Trust exit code + JSON diagnostics; never infer archive success from output text.                                                                                      |
| Store folders         | Required by initial beta                                                  | Missing empty planning dirs are healthy                                                           | Empty stores/list must be first-class states.                                                                                                                          |

## Change classification

### Must affect an OpenSpecUI 1.6 adapter

- Stores root/provenance protocol and root-aware JSON introduced in 1.5.
- `/opsx:update` profile, tool-state, invocation, and UI exposure.
- Oh My Pi support and Trae command delivery.
- `apply.tracks`-selected task projection.
- Proposal-less change validation, nested delta validation, full-body requirement JSON.
- Archive non-zero exits, diagnostic handling, atomic/spec-scenario safety failures.
- Empty Store behavior.

### Runtime fixes to inherit and regression-test, not redesign

- v1.4.1 workspace collision/update routing, solely to ensure no legacy assumptions survive.
- JSON-container config parsing.
- YAML CR escaping in command frontmatter.
- Completion/profile permission checking.
- requirement reader fidelity and INFO diagnostics.
- store registration before optional directories exist.

### Documentation or internal-only changes

These landed between tags but do not define a new OpenSpecUI runtime protocol:

- docs overhaul and explore-first narrative: commit `bb1f18c` / PR #1237;
- Cloudflare/Fumadocs website deployment: commit `65a7233` / PR #1285;
- kebab-case change-name prose clarification: commit `4ef0761` / PR #1261 (the runtime constraint predates 1.6);
- dependency/security lock refresh: commit `737518b` / PR #1249;
- removal of stale npm lock and pnpm CI cleanup: commit `8ac624b` / PR #1319;
- Windows test/CI flake hardening: commit `296ecbc` / PR #1325;
- docs scheduling and beta prerelease workflow changes: commits `871dece`, `8e9e457`;
- release changeset/version commits: `1552731`, `e1b51d1`.

Documentation copy should still be refreshed where it describes the canonical workflow, but these entries do not justify application code by themselves.

## Known upstream 1.6 inconsistencies to preserve as explicit boundaries

1. `references/openspec/docs/commands.md:9-18` correctly lists `update` in core, while `references/openspec/docs/supported-tools.md:12-19,83-89` omits it from core/custom workflow lists. Runtime `profiles.ts` and its tests win.
2. `instructions apply --json` reads `apply.tracks` as one literal file (`references/openspec/src/commands/workflow/instructions.ts:351-385`), while list/view/archive expand the selected artifact's glob. OpenSpecUI should name and test this divergence.
3. Stores are explicitly very early beta and the upstream agent contract records a snake_case/camelCase split (`references/openspec/docs/agent-contract.md:126-136`). Parsers should be strict about required meaning, permissive about additive fields, and version-attributed on failure.
4. Root selection is not universal: cwd-based `view/templates/schemas` cannot be advertised as store-capable merely because lifecycle commands are.

## Evidence-based adaptation boundary

This research supports the following sequencing for the parent Wayfinder discussion:

```text
P0 stable-line coherence
  version law + update workflow + OMP/Trae + tracked tasks
  validate/archive contracts + docs/spec/reference fixtures

P1 root correctness
  preserve RootOutput and absolute paths for every supported lifecycle command
  make declared/explicit store roots safe even if Stores UI remains minimal

P2 Stores Beta product surface
  separately decide lifecycle management, references, doctor/context, worksets
  retain versioned fault tolerance; do not make beta breadth block stable P0
```

Minimum upstream-derived fixtures should cover:

- proposal-less invalid change exits 1;
- nested delta validation;
- glob tracked tasks aggregate, scope containment, and fallback;
- glob `instructions apply` divergence;
- multiline/metadata/fenced requirement JSON;
- human archive blockers exit 1;
- stale `MODIFIED` scenario-loss rejection;
- empty store registration/list;
- OMP and Trae generated command paths;
- core profile contains exactly `update` in addition to the 1.5 core set.

This note does not decide the final product scope for Stores Beta. It establishes that root correctness is a protocol prerequisite, while a full store-management UI is a separable product decision.
