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
   adds a REQUIREMENT-LEVEL identity note in the delta spec intro (titles name historical admission eras;
   bodies are the normative text and already state retired/blocked for every affected scenario); the
   inherited scenario bodies themselves are unchanged. The rename-mechanism verification stays a separate
   Owner-gated proposal and is NOT a precondition of this change; the Owner may veto.
4. **B4 report/intake count drift** — owner map gains the show-names row; list row says "the one new member
   archived (nested/warnings are 1.13.1 regression fixtures)"; intake decision 1 "five"→"six"; decision 2
   rewritten to name this line's new members vs migrated ones.

### Round-C review disposition (herdr v14-change-reviewer, gpt-5.6-terra xhigh, 2026-10-02) — 7.8/10, REVISE

Worked 6m 15s. Boundary/alias/count fixes confirmed closed; two residuals, both factual-record corrections,
adopted:

1. **C1** — the Round-B disposition log claimed per-scenario body annotations that were never made (the
   actual change was the requirement-level identity note). Disposition text corrected to describe the real
   diff; inherited bodies unchanged; rename mechanism stays Owner-gated and non-blocking.
2. **C2** — report drift: the Protocol delta tree still listed `nested`/list-`warnings` as 1.14 additions
   and the fixture owner map still said the `openspec-cli-112` alias retires. Both rewritten to the
   single source of truth (archived is the one new list member; alias retained for its two historical
   consumers); the broken parallel sentence at the list section fixed; residual audit re-run.

### Round-D review disposition (herdr v14-change-reviewer, gpt-5.6-terra xhigh, 2026-10-02) — 8.1/10, REVISE

Worked 3m 57s (narrow). C1 confirmed closed. C2 partially closed — and the reviewer caught a real
integration error on our side: the Round-C correction script aborted on a later assertion before its
`write()`, so the protocol-tree carry-forward line and the list-sentence rewrite never landed even though
the Round-C disposition claimed them (batch-edit write-after-all-assertions failure; lesson already in the
global correction log). Re-applied with write-first verification (protocol tree gains the carry-forward
line, the stale `list --json` tree row is gone, the list paragraph reads as a complete sentence); the
fixture owner-map alias fix from Round-C had landed and is confirmed.

### Round-E review disposition (herdr v14-change-reviewer, gpt-5.6-terra xhigh, 2026-10-02) — 9.1/10, GO

Worked 1m 27s (narrow). Both re-applied fixes verified in the actual `bc633fb9` diff (not the disposition's
self-description): the stale tree row is gone, the carry-forward line is unique, the list paragraph is a
complete sentence, and the Round-D record matches the real changes. No blockers, no new non-blocking notes.
**Verdict: GO — implementation may start under the CP/slice evidence rules.**

Review arc: Round-A 6.2 REVISE (7 blockers) → B 7.4 (4) → C 7.8 (2) → D 8.1 (1, caught our lost write) →
E 9.1 GO.

## Batch A implementation record (2026-10-02)

### Slice 1 — Compat window and mirrors (CP1)

Production: `packages/core/src/openspec-compat.ts` (MAJOR 14, series `'1.14'`, `>=1.14.0 <1.15.0`,
NEXT_SERIES `'1.15.0'`, tag `'v1.14.*'`), `scripts/diagnose-cli-runner.mjs` + `scripts/setup-example.ts`
mirrors rotated with their tests. Red evidence was recorded by the slice agent before the constant flip
(6 failure sites: compat classification, boundary labels, mirror series assertions). Green:
`openspec-compat.test.ts` inside the core run below; scripts mirror inside `pnpm test:root`
(20 files / 75 passed | 12 skipped, includes `diagnose-cli-runner.test.mjs` parity cases).

### Slice 2 — CLI contract chain and kernel warnings (CP1)

Production: `cli-contracts/workflow.ts` (`CliApplyTaskSchema` + `sourcePath`/`line`;
`CliSpecRequirementSchema` + scenario `name`; `CliWorkflowStatusFieldsSchema` `warnings` shared by
single and batch entry shapes, batch stays entry-level only; change-list entry `archived`; new
`CliVersionSchema`), `cli-contracts/executor.ts`, `opsx-types.ts`, and the Round-A B2 owner fix in
`opsx-kernel.ts`: `projectWorkflowStatus` now carries
`...(data.warnings !== undefined ? { warnings: data.warnings } : {})` through its explicit
`ChangeStatusSchema.parse({...})` rebuild — decode `.passthrough()` is stripped at that rebuild, so the
copy is required on BOTH the single and the shared batch path. Red evidence: new
`opsx-kernel-status-warnings.test.ts` captured the warnings loss through the real kernel rebuild before
the fix (verbatim single + batch payloads). Green: core focused run —
`pnpm --filter @openspecui/core exec vitest run src/openspec-compat.test.ts src/cli-contracts/workflow.test.ts src/opsx-types.test.ts src/opsx-kernel-status-warnings.test.ts src/planning-cli-projection.test.ts src/agent-command-content.test.ts`
→ 6 files / 114 passed; `pnpm --filter @openspecui/core exec tsc --noEmit` → 0 errors.

### Slice 3 — Agent registry rotation (CP2)

Production: `agent-delivery-registry.ts` (series `'1.14'`, +10 entries: amp, atomcode, codestudio, dsh,
easycode, gigacode, grok, veai, warp, IBM Bob; gsd shares the `.agents` root with amp), `tool-init-state.ts`
+ tests. Integrator decision on the slice agent's escalation: `SHARED_AGENTS_SKILLS_OWNER_CANDIDATES`
widens from three to five values `['codex','zed','agents','amp','gsd']` — upstream 1.14 arbitration pool
counts five `.agents` skills writers and the reviewed spec delta already says so; antigravity stays
commands-only (adapter-backed). The slice agent had conservatively kept the three-valued tuple and
deferred; the registry + its test were updated together in the integrator pass. Green:
`vitest run src/agent-delivery-registry.test.ts src/tool-init-state.test.ts src/agent-command-content.test.ts`
→ 93 passed.

### Batch A integrator pass (2026-10-02)

- Fixed one stale assertion the slice rotation missed: `packages/server/src/tool-subscription-router.test.ts`
  global install expectation `@fission-ai/openspec@1.13` → `@fission-ai/openspec@1.14` (production constant
  had already rotated; the assertion failed once, then passed: file 5/5).
- Server focused suites: `agent-delivery-projection-service` + `agent-integrations-router` + `tool-subscription-router`
  → 22 + 5 passed across two runs (the split is the fixed assertion file re-run).
- `pnpm --filter @openspecui/server run typecheck` (10 tsconfig lanes) → 0 errors.
- Note for future rounds: multi-package `pnpm --filter A --filter B exec tsc` produces spurious TS6059
  rootDir errors in this repo; per-package invocations are authoritative.
