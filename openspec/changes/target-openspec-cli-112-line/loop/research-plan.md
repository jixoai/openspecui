<!--
Orthogonal intents (created 2026-09-03 Asia/Shanghai):
1. Record source- and CLI-backed OpenSpec 1.12 research facts.
2. Define the approved OpenSpecUI 12 compatibility decision and implementation topology.
3. Assign one production owner and exact red/green evidence to each implementation slice.
4. State risk, validation, release, and Owner-only acceptance boundaries.

Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
-->

# OpenSpecUI 12 research and implementation plan

## Research Findings

The full executed evidence is recorded in `references/openspec-1.12.0-report.md`. Planning-critical facts:

```text
CLI 1.12 validate --report findings --json (requires explicit bulk scope; no item name; no archived+active mix)
  envelope        = { report: { kind:'validation-findings', version:'1.0', scope, returnedItems, totalItems },
                     itemFindings: BulkItemResult[] (only items with issues),
                     summary: { totals, byType }, root }
  exit code       = full-run rule (failed > 0 -> 1); findings never re-labels verdicts
  request errors  = shared status-array envelope, code 'invalid_validation_report_request', plus fix string
  empty scope     = { returnedItems: 0, totalItems: 0, itemFindings: [] } (normal success document)
  full report     = byte-compatible with 1.11 ({ items, summary, version:'1.0', root })
  1.11 boundary   = flag rejected (to be proven by the retained pinned 1.11.0 fixture)

CLI 1.12 merge-conflict INFO findings (validator.ts)
  INFO issue      = 'Archive would refuse this delta: <reason>' per conflicting delta (dry-run of archive merge)
  advisory fail   = one INFO 'Could not check archive merge conflicts: <error>'; report is NOT discarded
  fs errors       = skipped inside the dry run; buildUpdatedSpec rethrows every fs error except ENOENT/ENOTDIR
  duplicates      = paths already reported as ERROR/missing-header/empty-section are not duplicated
  verdict         = unchanged; INFO existed in the level enum since before 1.12; --strict escalation unchanged

Agent delivery 1.12
  + codeassistant (SourceCraft Code Assistant): skillsDir .codeassistant, NOT requiresIdeRestart,
    commands .codeassistant/commands/opsx-<id>.md (11), skills .codeassistant/skills/openspec-*/SKILL.md (11),
    natural-language skill references (no slash invocation for skills), no migrations
  all 1.11 tools and layouts are unchanged in 1.12 (antigravity stays .agents-current; zed unchanged)

init 1.12
  .gitkeep anchors under specs/ and changes/archive/ (wx flag; extend mode too; re-init restores;
  never overwrites files or follows marker symlinks); anchors join the created-path ledger

IDE restart hint
  one shared module (src/core/shared/ide-restart.ts) owns init+update wording:
  'Restart your IDE to refresh commands.' / '... skills.'; covers workflow removal; no new tool sets the flag

templates
  explore gains PLANNING_GUIDANCE; propose/ff gain inspect-before-drafting instructions
  -> generated artifact content changes; no CLI JSON shape changes; generator staleness rotates

stream discipline
  unchanged for JSON runs; human text output now prints per-issue lines (incl. INFO) in bulk mode
```

Changelog-visibility gap: none protocol-relevant this cycle; 13 commits absent from the published changelog
are docs/CI/dependency chores. The pinned source diff remains the adaptation baseline.

The current OpenSpecUI 11 source state to be rotated:

```text
packages/core/src/openspec-compat.ts
  OPENSPECUI_TARGET_MAJOR = 11; OPENSPEC_CLI_TARGET_SERIES = '1.11'
  OPENSPEC_CLI_SUPPORTED_SERIES = ['1.10', '1.11']
  accepted:    >=1.10.0 <1.12.0        -> becomes >=1.12.0 <1.13.0
  recommended: >=1.11.0 <1.12.0        -> becomes >=1.12.0 <1.13.0
  NEXT_SERIES_MIN_VERSION = '1.12.0'   -> becomes '1.13.0'
  REFERENCE_TAG_PATTERN = 'v1.11.*'    -> becomes 'v1.12.*'

packages/core/src/agent-delivery-registry.ts
  AgentCliSeries = '1.10' | '1.11'; no codeassistant entry; parseOpenSpecCliSeries hardcodes minors 10/11

packages/core/src/tool-init-state.ts
  PINNED_AGENT_GENERATOR_VERSION = '1.11.0'

packages/core/src/cli-contracts/workflow.ts
  CliValidateReportSchema covers the full report only; no findings schema; no --report argv surface
  (CliValidationIssueSchema already types level ERROR|WARNING|INFO)

packages/core/package.json devDeps
  openspec-cli-110 / openspec-cli-111 aliases; official-cli-v11-* fixture suites; pin guards on a0ddb60
  (pin guards and the submodule already moved to e062b95 in this branch's first commit)

scripts/diagnose-cli-runner.mjs (+ diagnose-cli-runner.test.mjs)
  OPENSPEC_CLI_TARGET_SERIES = '1.11' fallback mirror — stale-series parity must rotate with slice 1
```

## Decision & Plan (For Approval)

### Compatibility law

```text
                        stable 1.12.x
OpenSpecUI 12           current + recommended (single-series window)
Admission               allowed

all prereleases, <1.12.0 (including the whole 1.10/1.11 v11 window), >=1.13.0, unknown -> blocked by default
```

The single-series window is the recorded Owner-default decision (vetoable): v9/v11 both opened two-series
windows only after both minors were published and fixture-verified; 1.13 does not exist today. The
current-page-only version-bypass law remains unchanged. Bypass never rewrites compatibility evidence or
support claims and does not conceal later protocol failures.

### Procedural topology

```text
pinned 1.12 executable fixtures (+ retained 1.11 boundary negatives)
                 |
                 v
Core CLI contracts + compatibility classification + capability gates
                 |
        +--------+---------------------------+
        v        v                           v
validate findings   validation evidence      Agent physical projection
transport + UI      (INFO class surface)     (codeassistant; staleness)
        +--------+---------------------------+
                 v
        Server reactive read model
                 v
        Web / Config / Change Evidence owners
                 v
        focused owner review -> package gates -> Owner acceptance
```

### Ordered implementation slices

| Order | Slice and production owner                                                                                                                                                                         | Precise red case                                                                                                                                                                                                                                               | Green case and focused gate                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `packages/core/src/openspec-compat.ts` + compatibility UI copy (`cli-health-gate.tsx`, settings diagnostics, `use-cli-runner`) + `scripts/setup-example.ts` and `scripts/diagnose-cli-runner.mjs` (with its test) mirrors | `1.12.0-rc.1` admitted or `1.11.0` still admitted; a `1.10.x` executable still admitted; setup-example still pins `1.11`; the diagnose mirror still falls back to the retired `1.11` series | 1.12.x current and recommended; 1.10.x/1.11.x rejected with actionable copy naming `>=1.12.0 <1.13.0`; all three constant sites (compat, setup-example, diagnose mirror) agree. Run `openspec-compat.test.ts` and `diagnose-cli-runner.test.mjs` first. |
| 2     | `packages/core/src/cli-contracts/workflow.ts` + `executor.ts` + `cli-executor.ts`                                                                                                                  | a findings document rejected by every existing validate schema; `--report` never reaches argv; a request-error `status` envelope misparsed as a validate report; INFO issues dropped or coerced to WARNING                                                                                                                                                                  | typed `CliValidateFindingsSchema` (`report.kind/version/scope/returnedItems/totalItems`, `itemFindings`, `summary`, `root`) decodes beside the unchanged full-report schema; the shared diagnostic-failure union covers `invalid_validation_report_request`; `validate --report <full\|findings>` argv round-trips with explicit bulk scope. Run contract tests.                                                                                                                                                              |
| 3     | `packages/core/src/agent-delivery-registry.ts` + `tool-init-state.ts` + Agent command content                                                                                                      | codeassistant missing for 1.12; registry still selecting a `1.11` series snapshot; antigravity losing its `.agents`-current/migration facts in the 1.12 snapshot; generator evidence still pinned to 1.11.0; a 1.11-generated tree shown current                                                                 | `'1.12'` series type and snapshot: every 1.11 tool keeps its 1.11 physical facts, codeassistant enters with `minCliSeries '1.12'` (`.codeassistant` roots, natural-language skills, no restart, no migration), retired `'1.10'/'1.11'` series select no inventory; `PINNED_AGENT_GENERATOR_VERSION = '1.12.0'`; series-aware comparison flags below-admitted generators stale. Run registry/state tests.                                                                                                                     |
| 4     | Real fixture harnesses: core `package.json` devDeps (`openspec-cli-112` alias; keep `-111`), `__tests__/official-cli-v12-fixtures.ts` + `official-cli-v12-*` suites, bins map, `upstream-contract-regression.test.ts` re-pin (already on this branch) | absence red (honest, recorded as such): the CP3 suite references files that do not exist yet, so any run fails before implementation — this slice owns evidence files, not production behavior, so no independent production red exists; the provenance guard is mutation-red after implementation: pointing a v12 bins-map entry at the `openspec-cli-111` alias must fail the helper's `--version` identity assertion | pinned 1.12.0 executables prove the findings envelope (populated/empty/request-error), the merge-conflict INFO class, the envelope-compatible full report, codeassistant physical layout, `.gitkeep` anchors, restart-hint wording, and JSON stream purity; pinned 1.11.0 proves `--report` rejection. Run matrix tests independently first. |
| 5     | `packages/core/src/opsx-kernel.ts` capability gates + findings transport                                                                                                                           | the kernel invokes `--report findings` without a derived capability; a bypassed unsupported session receives findings/batch/diff argv; findings replaces the full report as a validation truth source                                                                          | `deriveOpenSpecCliCapabilities` gains `findingsReport` (1.12 series) while `batchStatus`/`requirementDiff` remain series-derived for 1.12; findings loads as evidence behind the gate; validate Work identity and reactive dependencies unchanged. Run kernel/projection tests.                                                                                                                                                                                                                                               |
| 6     | Server read-model + Web surfaces: `packages/server/src/router.ts` `cli.validate` route + validation-evidence owners, `/config/agents` inventory, `cli-health-gate`/settings copy | INFO rendered as generic warning noise or dropped; findings surface hides full-run totals behind `returnedItems`; registry empty for an admitted 1.12 session; blocked-1.11 dialog copy still naming v11 ranges | an end-to-end typed chain: Core findings contract -> Server projection (through the existing `cli.validate` public route boundary, with server integration tests) -> validation evidence surface rendering INFO as a first-class informational class with both `returnedItems` and preserved totals and CLI provenance; `/config/agents` shows the SourceCraft inventory row with natural-language skill reference display; mismatch dialog names `>=1.12.0 <1.13.0`. Run focused Web component tests. |
| 7     | Release preparation: Changesets (major v12 for the fixed group `["openspecui", "@openspecui/*"]`, ignoring `@openspecui/ai-provider`), `README.md` + `README-zh.md` + `packages/cli/README.md` under the release README law (versioned historical README archives stay untouched), package build/pack, AGENTS.md architecture-decision entry (including correcting the two stale v1.7.0 submodule-pin statements) | packed CLI/Web assets still carry the v11 gate; README version table still describing 1.10/1.11 as current; AGENTS.md still asserting a v1.7.0 reference pin | one v12 major Changeset for the fixed group, with `changeset status` plus a dry run proving `11.1.0 -> 12.0.0` for every publishable package; both READMEs state the v12 line (repository README keeps the full version table with v11 archived); pack evidence proves source and distribution shape agree. No publish/release action. |

Slice 4's runner may land before slices 2/3, but each assertion belongs to the owner slice it proves.
Slice 5 depends on slices 2 and 4. Slice 6 depends on 2/3/5. Slice 7 starts only after focused checks for
1-6 pass. No broad gate substitutes for a failed focused owner review.

### Required implementation decisions

1. Rotate the compat series model to `['1.12']` with explicit literal constants (`NEXT_SERIES_MIN_VERSION`
   `'1.13.0'`, `REFERENCE_TAG_PATTERN 'v1.12.*'`, `OPENSPECUI_TARGET_MAJOR 12`). String series equality means
   every consumer reads the admitted series from the constant; nothing derives `'1.12'` from parsing alone.
2. Model the findings envelope as its own typed schema beside (never inside) `CliValidateReportSchema`; keep
   `summary`/`root` shared with the full report; decoding must not consult the process exit code, and the
   findings document must never be presented as the full validation truth.
3. INFO is a first-class validation display level (informational class), already typed in
   `CliValidationIssueSchema`; validity arithmetic and `--strict` escalation stay CLI-owned.
4. Capability model: `batchStatus`, `requirementDiff`, and the new `findingsReport` derive from admitted
   series membership in `deriveOpenSpecCliCapabilities`; a page-level bypass manufactures no command surface.
5. Registry: the `'1.12'` snapshot inherits every 1.11 physical fact (antigravity `.agents`-current with
   `.agent` legacy/migration, zed skills-only, shared-root arbitration) and adds codeassistant with
   `minCliSeries '1.12'`; retired series select no inventory. Keep the per-series override mechanism for
   future widening; do not collapse it into a single flat registry. Narrowing `AgentCliSeries` to `'1.12'`
   SHALL retain the separate historical provenance union (`AgentProvenanceCliSeries` keeps `'1.9' | '1.10' |
   '1.11'`) so existing on-disk metadata and fixtures stay typed instead of being force-cast.
6. `PINNED_AGENT_GENERATOR_VERSION` moves to `1.12.0`; the generated-by comparison stays series-aware
   (below-admitted or unparseable is stale). The constant never substitutes for a live resolution.
7. Fixture discipline: pinned 1.12.0 executables prove every newly accepted contract; the retained pinned
   1.11.0 executable proves capability-boundary rejections only; no hand-authored payloads for newly accepted
   contracts.
8. README law: repository README keeps the full version table (v12 current; v11 and older archived with their
   ranges) and the package README is scoped to the current release line only; both update in this delivery.
9. Spec hygiene rides with this Change: delta Specs advance stale line wording (`Batch Status Envelope
   Contract`, `Requirement Diff Evidence Contract`, `JSON Stream Discipline for Admitted CLIs`, `Static
   Projection Does Not Invent Line-Current Runtime Evidence`, `Generator Evidence Follows the Admitted CLI`,
   `Pinned Workflow Fixtures Are Executable`, `OPSX Command Mapping`, `Kernel-First OPSX Read Model`,
   `Explicit Planning Completion Projection`, `MODIFIED Delta Diff Evidence Surface`) and rename the
   version-bound `OpenSpecUI 11 Agent Delivery Inventory`. One delta file uses at most one
   `## MODIFIED Requirements` section (the upstream parser overwrites same-title sections, silently dropping
   earlier ones). Historical scenario titles with inverted line semantics (for example `Accept the current
   1.11 line`, `Zed is a 1.10-line skills-only target`) are deliberately preserved with updated content,
   because a MODIFIED block replaces the whole requirement and dropping a scenario is scenario loss; the
   preserved title is not a behavioral claim.
10. `.gitkeep` anchors are init-owned markers: any OpenSpecUI-side directory enumeration that distinguishes
    content from emptiness must treat them as anchors, not artifacts, and no parallel anchor writer exists.

## Capability Impact

### New or Expanded Behavior

- OpenSpecUI 12 admits stable CLI 1.12.x and recommends it.
- A typed findings report contract and a capability-gated validation findings evidence surface with INFO as
  an informational display class and both filtered and full-run totals.
- Merge-conflict advisory findings (`Archive would refuse this delta` / `Could not check archive merge
  conflicts`) surface as CLI-owned informational evidence.
- Agent delivery inventory projects SourceCraft Code Assistant for 1.12 sessions.
- Generator staleness rotates to the 1.12 baseline.

### Modified Behavior

- 1.10.x/1.11.x change from admitted to blocked in OpenSpecUI 12 (mismatch dialog; session-only bypass
  unchanged).
- Batch status, requirement diff, and init-language capabilities remain available on the admitted 1.12 line;
  their gates now derive from the `'1.12'` series constant.
- READMEs and compatibility copy state the new ranges everywhere they appeared for v11.

## Risks and Mitigations

| Risk                                                            | Mitigation                                                                                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Findings surface mistaken for the validation truth              | contract and UI tests assert the full report stays the truth source and the findings view shows preserved totals alongside `returnedItems`.                   |
| INFO findings rendered as warnings or dropped                   | focused Web tests render the merge-conflict INFO class distinctly; level enum already typed.                                                                   |
| Single-series window silently auto-admits a future 1.13         | `NEXT_SERIES_MIN_VERSION '1.13.0'` keeps `>=1.13.0` blocked by default; compat tests assert the boundary.                                                      |
| Registry regression loses 1.11-era facts in the 1.12 snapshot   | registry tests project antigravity/zed/shared-root facts for 1.12 sessions and assert retired series select nothing.                                            |
| Boundary negatives lost with the single-series window           | retained pinned 1.11.0 fixture proves `--report` rejection; the matrix keeps two executables with distinct roles.                                               |
| Generator staleness flags healthy 1.12 trees                    | series-aware comparison tests cover generatedBy `1.11.x` (stale) vs `1.12.x` (current) vs unparseable (stale).                                                 |
| Human-output text changes break prose capture                   | typed executors parse JSON only; evidence prose capture tests tolerate the new per-issue lines; no 1.11 text pattern-matching remains.                          |
| Scope creep into unrelated areas                                | the change touches only the packages/files named in slices; unrelated in-flight work stays untouched.                                                          |

## Owner acceptance boundary

Automated evidence (focused Vitest, pinned fixtures, component-level Playwright, pack checks) prepares
acceptance only. The Owner performs every final end-to-end browser walkthrough, PR delivery, archive, merge,
and release decision.
