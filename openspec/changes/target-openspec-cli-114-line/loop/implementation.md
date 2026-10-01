<!--
Orthogonal intents (created 2026-10-02 Asia/Shanghai):
1. Track live implementation state, review rounds, and evidence for OpenSpecUI 14.
2. Record subagent topology and the integrator-owned shared-file rule.
3. Keep the header law visible to every implementation agent.

Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
-->

# OpenSpecUI 14 implementation state

## Current state

- CP0: worktree `openspecui-114` @ `target-openspec-cli-114-line` (off main `4d8c0072`); submodule pinned
  `v1.14.0` (`94ca9c1e`); dependencies installed; evidence report + change artifacts written; review rounds
  pending.

## Evidence recording rule

Every round records: slice, production owners, the precise red as it failed (or the honest statement why a
red could not be captured), the focused green command + result, and the commit. Claims without command
output are not evidence.

## Subagent topology

Batches follow the slice order; each subagent touches only its slice's files. Shared files (package.json
devDeps, lockfile, AGENTS.md, READMEs, `.changeset/`) are integrator-owned. Subagents never commit/push, run
focused tests via `pnpm --filter <pkg> exec vitest run <file>` (never `test --`), report difficulties
(feedback protocol), and reclaim any process they start.

## Review rounds

### Round-A review disposition (herdr v14-change-reviewer, gpt-5.6-terra xhigh, 2026-10-02) — 6.2/10, REVISE

Worked 16m 37s. Seven blockers, all verified against source and adopted:

1. **B1 show names missing** → report/intake recount to six surfaces; Slice 2 owns
   `CliSpecRequirementSchema` + scenario `name` through the Spec Catalog chain; new "Spec Requirement Names
   Contract" delta; show-name fixture evidence assigned to the widened `show` suite (both surfaces).
2. **B2 status warnings lost at the kernel rebuild** → `opsx-kernel.ts` `projectWorkflowStatus` (the
   explicit `ChangeStatusSchema.parse({...})` copy used by BOTH single and batch paths) added to Slice 2
   owners; red driven from a real 1.14 payload through the kernel to the Server-visible output, verbatim.
3. **B3 edit-roots lacked normative coverage** → new "Status Action Context Edit Roots Contract" (both
   branches) + executable two-branch fixtures in the `default-store` counterpart beside the non-store
   control; report documents both branches.
4. **B4 boundary executable contradiction** → unified everywhere: the just-retired **1.13.2**
   (`openspec-cli-113` alias) becomes the v14 boundary line; v12 boundary suite + `openspec-cli-112` alias +
   v12 helper retire; compat unit tests still cover 1.13.0/1.13.2 rejection directly.
5. **B5 matrix counts unresolvable** → file-level matrix: 11 migrate (apply-readiness keeps 1132 tracking
   cases as regression + gains sourcePath/line), 2 new, boundary per B4; checkpoints match (13 files).
6. **B6 contradictory inherited scenario titles** → recorded as known legacy in Spec hygiene with a
   proposed separate spec-hygiene change (verified rename process on an isolated copy; Owner decision);
   new scenarios never carry contradicting titles.
7. **B7 "verbatim" warning was truncated** → complete raw string re-captured from the disposable fixture
   (including the `skip_design is not a supported key; only skip_specs exists...` tail) and embedded in the
   report as the fixture contract string.

Non-blocking corrections adopted: `nested`/list-`warnings` reclassified as 1.13.1 regression items (the one
new list member is `archived`); 1132 baseline verified accurate by the reviewer (no overlap).

Pending: Round-B re-review.

### Round-B review disposition (herdr v14-change-reviewer, gpt-5.6-terra xhigh, 2026-10-02) — 7.4/10, REVISE

Worked 12m 27s. Round-A B2/B3/B7 confirmed closed; four residual blockers, all documentation-consistency
class, adopted:

1. **B1 boundary text self-contradiction** — the "v13-only fields absent" assertion was semantically wrong
   (1.13.2 IS a v13 CLI and legitimately emits taskTrackingConfigured etc.). Rewritten everywhere: the
   boundary asserts 1.13.2 identity + unsupported classification + **1.14-only members absent** (task
   sourcePath/line, list archived, show names, status warnings), never v13-era absence. Residual 1.13.0
   wordings in intake/report synced to 1.13.2.
2. **B2 v12 alias has live consumers** — `tool-init-state.test.ts` and `agent-command-content.test.ts`
   resolve `openspec-cli-112` as historical generator evidence. Retirement narrowed to the v12 boundary
   suite + v12 helper; the npm alias stays; pre-delete rg check named in the plan.
3. **B3 spec-hygiene disposition honesty** — the Round-A note overstated ("verified" nothing). This change
   records the inherited title/body contradiction as known legacy, annotates the affected scenario BODIES
   with an explicit "Historical title retained for scenario identity; this line is retired and blocked in
   OpenSpecUI 14" first line (bodies are normative and editable today), and proposes the rename-mechanism
   verification as a separate Owner-gated change. v14 merge does not block on it; the Owner may veto.
4. **B4 report/intake count drift** — owner map gains the show-names row; list row says "the one new member
   archived (nested/warnings are 1.13.1 regression fixtures)"; intake decision 1 "five"→"six"; decision 2
   rewritten to name this line's new members vs migrated ones.

Pending: Round-C re-review.
