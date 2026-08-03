<!--
Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
1. Preserve the manager's original OpenSpec 1.7/OpenSpecUI 7 adaptation request.
2. Define the complete observable protocol scope without authorizing parallel OpenSpec logic.
3. Fix the release, evidence, review, and browser-acceptance boundaries for this loop.
4. Record confirmed decisions separately from interview questions that remain open.
5. Capture the Config information-architecture audit and prevent duplicate configuration owners.

Original request (2026-08-01): "更新本地references/openspec，目前 `openspec@v1.7.*` 已经发布，我们开始 `openspecui@v7.*` 的适配计划"
Owner confirmation (2026-08-01): "确认，开始change的创建，然后开始必要的采访，完成采访后创建出完整的change文件集，然后开始完成相关的工作"
Owner bypass-lifetime decision (2026-08-01): "仅当前页面会话有效"
Owner default-Store decision (2026-08-01): "同意"
Owner tool-migration decision (2026-08-01): "同意 并且我觉得这一点很重要，现在的 Agent 适配已经不像之前那样简单了。"
Owner Agent-UI exploration (2026-08-01): consider a read-only Settings projection plus an indirect detailed surface; compare Dialog, Settings subpage, and Config subpage ownership.
Owner Config-guide request (2026-08-01): add a `Guide` action to Config, use a JavaScript guide library to lead users through real OpenSpec project configuration, visually redesign Active Root Config, and investigate whether Environment Global and the wider Config surface require restructuring.
Owner Config-workbench decision (2026-08-01): "同意" — adopt the route-backed Config workbench and make `/config/agents` the sole structured owner of Agent delivery policy.
Owner Active-Root YAML decision (2026-08-01): preserve raw YAML writes because teams may extend the document beyond the official OpenSpec standard; OpenSpecUI aligns official fields but cannot define every organization or individual's configuration contract.
Owner Config-Guide decision (2026-08-01): "同意" — ship one adaptive `Configure this project` Guide that skips objectively ready stages and ends at Resolved Context verification; do not create separate static tours per Config page.
Owner Config-Guide correction (2026-08-03): every stage remains visible; `ready` only unlocks explicit Continue and observations never auto-advance or auto-complete.
Owner Spotlight correction (2026-08-03): one SVG even-odd mask replaces four overlay regions and mirrors computed bevel radii with a square unsupported-browser fallback.
Owner initialization-entry request (2026-08-01): when OpenSpecUI starts on a project without a local `openspec/` directory, open a global Dialog offering guided project setup; Config also exposes an Init action that executes the official `openspec init` workflow.
Owner initialization-Alert decision (2026-08-01): Initialize Project is an independent Alert that explicitly runs `openspec init --tools=none`, shows command execution through settlement, and on success offers `[Ok] [Start Guide]`; experienced users may continue independently while new users enter the Guide.
-->

## User Input

> 更新本地references/openspec，目前 `openspec@v1.7.*` 已经发布，我们开始 `openspecui@v7.*` 的适配计划

> 确认，开始change的创建，然后开始必要的采访，完成采访后创建出完整的change文件集，然后开始完成相关的工作

> 确定，不过这也启发了我，我希望在Config页面加一个 `Guide` 的按钮，点击后使用js引导库来引导用户完成相关的openspec项目配置。
> 但这也意味着我们需要对现有的 Active Root Config 做可视化改造。
> 等一下，我发现 Environment Global Config 好像已经包含了我们要的agents相关配置，这个页面是不是也要重构？
> 还得再调查，config页面存在很多不完善的设计

> 如果启动openspecui的时候，发现当前项目目录没有 openspec 文件夹，那么就全局弹出一个Dialog，告知用户可以进行引导完成项目配置。
> 这还包括 `openspec init`；Config 页面需要提供一个 init 按钮来执行 `openspec init`。

Confirmed compatibility decision:

```text
OpenSpec CLI <1.7.0          unsupported; blocked by version-mismatch Dialog
OpenSpec CLI 1.7.x           current / adapted
OpenSpec CLI >=1.8.0         unsupported; blocked by version-mismatch Dialog
Skip version check           explicit user-risk admission bypass
```

## Objective Scope

Adapt OpenSpecUI 7 to the complete observable OpenSpec CLI 1.7 protocol recorded in
`references/openspec-1.7.0-report.md`:

1. Advance the product compatibility line from OpenSpec 1.6/OpenSpecUI 6 to OpenSpec 1.7/OpenSpecUI 7.
2. Preserve OpenSpec 1.7 workflow JSON exactly, including `skipped` artifacts, artifact dependency arrays,
   Apply runtime context/guidance, skipped Artifact Instructions, and Archive Instructions.
3. Preserve recursive Spec identities across owned, referenced, search, export, SSG, and detail projections.
4. Project global `defaultStore` through Environment Global and Root Context without converting it into a
   project binding or permission.
5. Synchronize the 1.7 tool registry and physical delivery model, including Codex skills-only delivery,
   Devin/Windsurf migration evidence, Qwen Markdown commands, and new CodeArts Agent, Hermes, and ZCode tools.
6. Retain the official CLI as the sole owner of parsing, validation, Root selection, archive merging, schema
   resolution, and update cleanup behavior.
7. Deliver the work through focused red/green/mutation evidence, CI-equivalent gates, PR review, and a major
   Changeset while preserving owner-only final browser acceptance.

## Non-Goals

- Do not redesign App Workspaces, Stores, OpenTray hosting, translation engines, or release infrastructure.
- Do not implement OpenSpec 1.7 behavior by reading or interpreting source files in parallel with the CLI.
- Do not claim or probe OpenSpec CLI 1.8 compatibility.
- Do not preserve retired Codex prompt files as a current protocol surface.
- Do not infer Apply/Archive operation guidance from artifact rules or UI-authored text.
- Do not merge, release, archive the Change, or claim final browser acceptance without the manager's explicit
  phase decision.
- Do not include concurrent CT2/release work currently present in the worktree.

## Acceptance Boundary

The loop is implementation-complete only when all of the following are objectively true:

1. The local reference is pinned to released OpenSpec `v1.7.0` at
   `4e16790d90d8f54d4773ad9a5e71a57cd9f1e86b`, and the runtime/package contract used by OpenSpecUI 7 is aligned
   with the adapted 1.7 line.
2. Fixed 1.6 and 1.7 CLI fixtures prove that only 1.7 is supported, 1.6 is blocked by default, the explicit
   `Skip version check` action can bypass only the Web admission gate, and every changed JSON contract is tested
   without fabricated payloads or transpile-only evidence.
3. A valid `skip_specs: true` change remains readable and actionable: skipped artifacts never become errors,
   missing work, completed physical files, or mutation targets.
4. Apply and Archive actions consume their exact selected-Root instruction surfaces and preserve context,
   operation guidance, Store selector, Root evidence, and failure diagnostics.
5. Nested Spec ids remain byte-for-byte stable across live and static routes, referenced Stores, search,
   export, and document lookup.
6. `defaultStore` is visible and repairable through its Environment Global owner while Root Context remains the
   authority for the effective selected Root.
7. Tool configuration mirrors OpenSpec 1.7 ids, aliases, detection paths, skill roots, command formats, and
   delivery capability; Codex legacy prompts appear only as cleanup/drift evidence.
8. Each implementation slice names one production owner, one precise red fixed point, one green result, and
   mutation evidence before broader gates.
9. Required local checks pass for the exact implementation head. Automated browser fixtures remain preparation
   evidence; the manager owns the final end-to-end walkthrough.

## Confirmed Decisions

- OpenSpecUI 7 supports only OpenSpec CLI 1.7.x; 1.6.x and every other series are unsupported and blocked by
  default.
- An available unsupported CLI may be forced through the existing version-mismatch Dialog by clicking
  `Skip version check`; the user accepts all resulting risk and OpenSpecUI provides no compatibility promise.
- The bypass changes admission only. It does not simulate 1.7 features, rewrite CLI evidence, or suppress
  downstream failures.
- The bypass is held only by the current in-memory page runtime. Refresh, reconstruction, App reopen, or a new
  page clears it; no browser storage, Workspace setting, project config, or Server state persists the override.
- Global `defaultStore` is a first-class structured control in Config → Environment Global. It offers Store-id
  suggestions, preserves objective configured/stale values, supports explicit clearing, and explains final Root
  fallback semantics. Root Context owns effective resolution evidence; Project Binding never mirrors this value.
- The complete OpenSpec 1.7 Agent/tool delivery migration ships in OpenSpecUI 7.0, including Codex skills-only,
  Devin/Windsurf migration evidence, Qwen Markdown commands, CodeArts Agent, Hermes, ZCode, detection paths,
  physical scopes, and delivery capabilities.
- The adaptation covers the complete observable 1.7 protocol rather than changing only the compatibility gate.
- One `opsx-collab-pr-loop` Change owns the program, with independently reviewable implementation slices.
- Planning artifacts must be complete before Apply begins; implementation starts immediately afterward.
- Config becomes a route-backed workbench with owner-specific secondary pages instead of one mixed fixed/dynamic
  horizontal tab strip.
- `/config/agents` is the sole structured mutation owner for `profile`, `delivery`, and `workflows`. Settings keeps
  only a read-only Agent summary/link; Environment Global cannot provide a second structured editor for those
  fields.
- Active Root keeps both structured and raw YAML editing. Structured mutations own official OpenSpec fields and
  preserve unrelated nodes; raw YAML remains an explicit whole-document escape hatch for team-specific fields.
  Raw writes require valid YAML, preserve unknown keys, reject stale revisions, and refresh every affected
  structured projection after atomic settlement. Unknown fields are not rejected merely because the official
  OpenSpec model does not define them.
- Config ships one adaptive `Configure this project` Guide: Project Binding → Active Root → Agent Delivery →
  Resolved Context verification. Every stage remains visible; current `ready` enables Continue, explicit Continue
  advances, and observations never auto-complete. Blockers, warnings, and failures keep Continue disabled. The
  headless presentation owns only focus/popover primitives; OpenSpecUI owns one SVG bevel Spotlight mask.

## Initialization Investigation

- OpenSpec 1.7 exposes `openspec init [path]` with `--tools`, `--force`, `--profile`, and `--no-animation`.
- The existing Settings initialization surface already owns tool inventory, detected tools, profile override,
  force cleanup, cancellation, streaming Terminal evidence, and result settlement. The implementation should move
  that capability into Config rather than create a second Init executor.
- Local project initialization and effective Planning-root readiness are different facts. A project without a local
  `openspec/` directory may still resolve a usable Store root through explicit selection or `defaultStore`.
- Therefore the startup Dialog is triggered by Launch Project local initialization state, while its severity and
  copy are derived from Root Context: missing local setup is an onboarding fact, not automatic proof that all OPSX
  reads are unavailable.
- `openspec init` always targets the Launch Project directory. It never runs against a selected external Store or
  another Active Root.
- Initialization and guidance are deliberately separate. The startup/Config Init Alert previews and, only after an
  explicit user action, runs `openspec init <launch-project> --tools=none`. This creates the official project files
  without selecting or rewriting Agent integrations.
- The Alert owns detected, confirming, running, success, failure, and cancelled states. It renders the exact command
  and streaming/final evidence. Only the settled success state exposes `[Ok] [Start Guide]`; failure exposes retry
  and close without pretending the project is initialized.
- The adaptive Guide starts after initialization when chosen:

```text
Project Binding → Active Root → Agent Delivery → Resolved Context verification
```

- Agent Delivery remains a later, independently chosen Guide stage. Because initialization always uses
  `--tools=none`, the Alert cannot silently install, migrate, or clean Agent artifacts.

## Config Investigation

Current production evidence establishes that the existing Config surface cannot absorb the 1.7 adaptation through
another horizontal tab or Dialog alone:

```text
Config route (1,655 lines)
├─ fixed owner tabs
│  ├─ Project Binding
│  ├─ Active Root
│  └─ Environment Global
└─ dynamic entity tabs
   └─ Schema(<id>) × N
```

- Fixed configuration domains and an unbounded Schema entity collection share one horizontal tab strip. Desktop
  truncates the final entity; mobile exposes only a clipped subset and arrow controls, so navigation state is not
  self-describing.
- Active Root is a whole-file YAML editor. It does not visualize the 1.7 project-config contract (`schema`,
  `context`, per-artifact `rules`, and per-operation `operations.apply/archive.guidance`). Because the same physical
  file may also contain Project Binding's `store` and `references`, whole-file replacement can cross the product's
  declared ownership partition.
- Environment Global currently combines four different intents: effective config preview, whole-file editing,
  Agent delivery policy (`profile`, `delivery`, `workflows`), and Planning-root Update/drift execution. OpenSpec 1.7
  adds `defaultStore`, making this surface denser rather than fixing the ownership problem.
- Settings separately owns OpenSpec Diagnostics and Initialize OpenSpec. The initialization section already depends
  on Environment Global delivery/workflow state and owns Agent inventory, selection, execution, cancellation, and
  Terminal output. Moving only its Dialog would preserve the split owner rather than resolve it.
- Upstream 1.7 global configuration has exactly five known domains: `featureFlags`, `profile`, `delivery`,
  `workflows`, and `defaultStore`. `profile`/`delivery`/`workflows` form one Agent delivery policy and must have one
  structured mutation owner.

The current architecture recommendation is therefore a Config workbench, not a larger tab bar:

```text
/config                    overview + readiness + Guide + Context action
├─ /config/project         Project Binding: store + references
├─ /config/root            structured Active Root: schema + context + rules + operations
├─ /config/environment     machine defaults: defaultStore + feature flags + advanced evidence
├─ /config/agents          Agent delivery policy + inventory + Init/Update/repair
├─ /config/schemas         schema catalog
│  └─ /config/schemas/:id  schema detail/editor
└─ /config/context         effective resolved evidence
```

Settings becomes a read-only Agent summary and link. The current Initialize OpenSpec mutation moves to
`/config/agents`; OpenSpec diagnostics move to the Config overview/Context evidence plane. Environment Global stops
providing an independent structured editor for Agent policy. Its raw source becomes evidence or an advanced
passthrough editor that excludes fields owned by Agent Delivery.

The Guide presentation is not allowed to own completion state. OpenSpecUI owns a typed, state-derived setup workflow,
Router/mutation orchestration, Spotlight, controls, and visual language; the headless Base UI Popover supplies only
anchor positioning and focus primitives. A guide step may wait for an element or navigate to a Config subpage, but
objective readiness comes from Root Context, Planning Config, Schema, and Agent delivery projections.

## Interview Result

The product interview is complete. No unresolved product choice blocks artifact creation or Apply. The missing-local-
OpenSpec Alert never mutates automatically: the user explicitly confirms initialization. Closing the Alert suppresses
the automatic offer only for the current page runtime; Config retains a persistent Init entry whenever local setup is
absent.
