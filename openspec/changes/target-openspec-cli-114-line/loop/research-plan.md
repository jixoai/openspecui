<!--
Orthogonal intents (created 2026-10-02 Asia/Shanghai):
1. Convert the verified 1.14 protocol delta into ordered implementation slices with owners and evidence.
2. Keep every slice red/green case executable against a named fixed point.
3. Record batch topology and the shared-file integrator rule.

Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
-->

# OpenSpecUI 14 research plan

Evidence: `references/openspec-1.14.0-report.md` (pinned `v1.14.0` @ `94ca9c1e`; executed npm observations).

## Spec hygiene

Scenario titles are current-spec identity (archive refuses drops); bodies carry v14 semantics. Historical
titles ("Zed is a 1.10-line skills-only target", "SourceCraft enters at 1.12") describe introduction facts;
`minCliSeries` values never rotate while `AgentCliSeries` does.

## Slice 1 — Compatibility window and mirrors

Owners: `packages/core/src/openspec-compat.ts`(+test) — MAJOR 14, series `'1.14'`, ranges
`>=1.14.0 <1.15.0`, NEXT_SERIES `'1.15.0'`, tag pattern `v1.14.*`; `scripts/diagnose-cli-runner.mjs`(+test)
and `scripts/setup-example.ts` mirrors with boundary assertions (1.13 rejected / 1.14 accepted).
Red: constants-first run against current assertions (record 5+ failures incl. stable 1.13.x → unsupported).
Green: compat + diagnose focused tests; core typecheck.

## Slice 2 — Typed contracts through the full projection chains

Owners (complete chains, v13-B1 lesson):

- Apply tasks: `cli-contracts/workflow.ts` `CliApplyTaskSchema` + `opsx-types.ts` `ApplyTaskSchema` gain
  optional `sourcePath`/`line`; contract tests pin the executed 1.14 payload (both members present, absolute
  path, 1-based line) plus an older-shape payload without them.
- Status warnings: `CliWorkflowStatusSuccessSchema` (batch + single, whichever owns the envelope) and the
  opsx status input/projection schemas gain optional top-level `warnings: string[]`; tests pin the executed
  `skip_design` warning verbatim.
- List members: the change-list CLI contract gains per-entry optional `archived`/`nested` and an optional
  top-level `warnings` array (`nested_change_directory` finding); executed `--archived`/`--all` documents as
  fixtures.
- Version command: a new typed contract for `{schemaVersion:1, version, install, update?}` with an executor
  method (`version({check})`); no capability flag (admitted-window invariant).
- Store edit roots: no schema change (same array shape); fixture expectations rotate to
  `[implementationRoot, projectRoot]` semantics in Slice 6 fixtures only.

Red: schema-drop reds per surface (parse executed payload through the projection schema asserting the member
survives; fails today). Green: the three contract files + opsx-types tests; core typecheck.

## Slice 3 — Agent registry rotation (largest slice)

Baseline note: the 2026-09-27 `update-openspec-cli-1132` change already rotated the Kilo Code command root
to `.kilo/command/` — that physical fact carries forward unchanged. This slice rotates the series and adds
the ten 1.14 entries.

Owners: `packages/core/src/agent-delivery-registry.ts`(+test): `AgentCliSeries = '1.14'` (minor 13 → 14 in
the resolver), provenance union retains `'1.12'`/`'1.13'`; **ten new entries** in official order —
`amp` (`.agents` root, detection `.amp`), `gsd` (`.agents` root, detection `.gsd`), `atomcode`, `codestudio`
(restart true), `dsh` (skills-only), `easycode` (TOML commands), `gigacode`, `grok` (skills-only), `veai`
(skills-only), `warp` (detection `WARP.md`); label `IBM Bob`; Devin Desktop "(formerly Windsurf)" label
note. `tool-init-state.ts`: `PINNED_AGENT_GENERATOR_VERSION = '1.14.0'`; series-aware staleness
(1.13.x-generated → stale). Server tests rotate (`agent-delivery-projection-service`,
`agent-integrations-router`, agent parts of `tool-subscription-router`).

Red: rotate PINNED first, record the 1.13.0-generated-stays-current assertion failures.
Green: registry/state suites + server agent suites.

## Slice 4 — Status warnings Web surface

Owners: `packages/web/src/routes/change-view.tsx` status region + the v13 summary-row component pattern
(`apply-progress-notice.tsx` or a sibling advisory component): status `warnings` render as ONE always-visible
summary row (count + CLI attribution) with verbatim expansion; absent member degrades silently; never gates
actions.

Red: component test asserting the row before the render change. Green: focused web tests + typecheck.

## Slice 5 — Reference pin and the complete fixture matrix

Owners: `scripts/prepare-openspec-reference.mjs` EXPECTED_COMMIT → `94ca9c1e...`;
`upstream-contract-regression.test.ts` pin rotation; `packages/web/scripts/w2-project-binding-playwright.ts`
pin; `packages/core/package.json` alias `"openspec-cli-114": "npm:@fission-ai/openspec@1.14.0"` (integrator
lockfile); `__tests__/official-cli-v14-fixtures.ts` helper. **Full positive matrix migrates to v14** — the
twelve v13 suites (workflow, default-store, nested-spec, show-diff, validation-full, validation-findings,
batch-status, agent-delivery, apply-readiness, nested-change, task-reading, plus any apply-tracking suite
from the 1132 line) get v14 counterparts, with apply-readiness extended to assert task
`sourcePath`/`line`, **plus two new suites**: `v14-version-report` (no-check envelope only, per no-network
fixture discipline) and `v14-change-list-inventory` (`--archived`/`--all` archived flag, nested warnings
shape). Boundary: rotate `official-cli-v12-boundary-fixtures.test.ts` role text to the v14 gate (1.12.0
stays the retired executable — 1.13.2 remains the admitted-line provenance through the v13 suites' archive);
retire the v13 positive suites with their counterparts (deletion proof: `git diff --name-status` + orphan
scan; the v13 helper is deleted unless the boundary suite still consumes it — it consumes v12). Mutation
red: bins-map → wrong alias fails `--version` identity.

Red: alias-resolution failure before install; pin-guard failure before rotation.
Green: joint v14 gate + boundary + upstream-contract-regression; core typecheck; lockfile diff + shim check.

## Slice 6 — Cross-package alignment (four owner groups)

1. Web compat copy: `cli-health-gate`(+test), settings diagnostics, `use-cli-runner` — ranges/labels derive
   from shared constants; rotate literal expectations (1.13→1.14, retired window now includes 1.13).
2. Server evidence: `router.test.ts`, `change-diff-evidence-service.test.ts`,
   `cli-validate-findings-router.test.ts`, `root-context-cold-start.integration.test.ts` (commit pin),
   `tool-subscription-router.test.ts` compat assertion.
3. Web evidence: `change-view.test.tsx` admitted fixtures, `validation-findings-evidence`(+test),
   `archived-validation-evidence`(+test).
4. CLI/scripts: `worktree-instance-manager.test.ts`, setup-example consumers.

Red/green per group, recorded separately.

## Slice 7 — Release preparation (integrator)

Changeset (major: core/server/web/openspecui); README law (repo en/zh `@^13` row + archived 1.13 copies +
CLI package README scoped to v14); CLAUDE.md pointer to the 1.14 report; AGENTS.md architecture decision +
submodule pin line. Full gates: format/lint/typecheck/browser + per-package test runs (explicit list, not
recursive-only); disclose pre-existing flakes honestly (path-realpath, load-sensitive startup timing).

## Batch topology

- Batch A (parallel): Slices 1, 2, 3 (disjoint file sets).
- Batch B (parallel): Slices 4, 5, 6 (each depends only on Batch A constants/schemas).
- Batch C: Slice 7 integrator-only.

## Stop-loss

Any slice whose red cannot be produced honestly, or whose focused green fails twice for unrelated reasons,
escalates before proceeding; no unrelated defects merge into this change.
