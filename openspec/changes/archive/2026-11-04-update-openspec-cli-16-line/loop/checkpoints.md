<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. Define the acceptance checkpoints and their evidence for the 1.16.0 line.
2. Keep every checkpoint falsifiable against a named command or artifact.
3. Record the Owner-only acceptance boundary.

Original request (2026-11-04): "后每隔 3 天检查一下有没有需要更新的，然后更近更新。按照标准工作流推进上线。"
-->

# OpenSpec CLI 1.16.0 checkpoints (OpenSpecUI 16)

## CP0 — Planning baseline

- [x] Worktree `openspecui-worktrees/update-openspec-cli-16-line`, branch
      `target/openspec-cli-16-line` off `origin/main` (`e99a05c9`).
- [x] `references/openspec` submodule checked out `v1.16.0`
      (`27c0515724decc633818c735ee596481eec78a8b`).
- [x] `references/openspec-1.16.0-report.md` written with source-diff and executed-CLI evidence.
- [x] Change artifacts written (intake, research plan, these checkpoints, four spec deltas).
- [x] Round-A research channel (2026-11-04, **6.5/10**): five blockers, each independently
      reproduced by the main agent —
      B1 `major` not `patch` (packages sit at `15.1.0`; precedent `a0bef65f`);
      B2 two missing spec deltas (`projection-contract-truth`, `opsx-config-center` both still
      pin the 1.15.0 baseline);
      B3 `scripts/check-openspec-reference.mjs` is a **silent fake green** (`OK: v1.15.0-19-g27c05157`);
      B4 ten version-semantic constants, not five, plus two script mirrors and
      `openspec-compat.test.ts`;
      B5 the root workspace _does_ declare `engines >=20.19.0` while `openspec-cli-116` needs
      `>=22.12.0`.
- [x] Round-A findings folded into intake decisions 2/4/5 and research-plan slices 1/2/4/5 plus
      the corrected audit token set; two new deltas generated; report's self-contradicting
      boundary paragraph rewritten.
- [x] Second review channel completed as a **research subagent**, not Codex — the Owner directed
      "别用Codex，走子代理审查就好" for this round. Round-B **8.0/10** (five blockers, all folded),
      Round-C **8.8/10 approved** (caught one semantic regression the rotation introduced: a
      retired-line scenario had been rewritten onto the admitted line).
- [x] Round-B / Round-C approved (scores recorded in the research plan).

## CP1 — Window + pin rotation

- [x] Red recorded: `classifyOpenSpecCliVersion('1.15.0')` asserted `unsupported` before the
      constant rotation (the alias bump cannot make the identity assertion fail).
- [x] `openspec-compat.ts` **ten** version-semantic constants rotated to the 1.16 window
      (`OPENSPECUI_TARGET_MAJOR`, both series constants, the three minimums, the next-series
      minimum, both ranges, `OPENSPEC_CLI_REFERENCE_TAG_PATTERN`); header intent updated.
- [x] Mirrors rotated: `openspec-compat.test.ts`, `scripts/diagnose-cli-runner.mjs`,
      `scripts/setup-example.ts`, `scripts/diagnose-cli-runner.test.mjs`.
- [x] Alias `openspec-cli-116` present; lockfile regenerated; `--version` proves `1.16.0`.
- [x] Every pin guard rotated (`EXPECTED_COMMIT`, **`check-openspec-reference.mjs`'s
      `v1.16.*` describe match**, regression assertion, cold-start commit + observed version,
      web playwright commit + version).
- [x] gitlink staged at `v1.16.0`; `CLAUDE.md` pointer rotated.

## CP2 — Fixture suite rotation

- [x] 14 positive suites renamed to `official-cli-v16-*` with version literals, type imports and
      helper paths rotated; intent headers carry the 2026-11-04 request line.
- [x] Boundary suite rotated to `official-cli-v15-boundary-fixtures.test.ts` on
      `openspec-cli-115` (1.15.0), with the config-failure discriminator replacing the
      `update --dry-run`/`install` absence probes.
- [x] `openspec-cli-114` alias removed together with
      `__tests__/official-cli-v14-fixtures.ts`; **no live consumer remains anywhere, including
      `.agents/skills/**`\*\* (the rotation skill's delivery doc hardcoded it and was repaired in
      this change).
- [x] Behaviour-assertion tests rotated with the gate flip: `cli-health-gate.test.tsx` (1.16
      admitted / 1.17 blocked), the two server "admitted session" fixtures, and
      `opsx-kernel-cli-projection.test.ts`'s series gate.
- [x] Full matrix green against 1.16.0 with zero assertion relaxations.
- [x] **PR-CI round 1 repaired a mirror this list under-counted**:
      `packages/server/src/tool-subscription-router.test.ts` still fed `version: '1.15.0'` as
      admitted session data plus `generatedBy`/`generatedByVersion` samples, so every subscription
      projection came back empty after the flip. All three samples now read 1.16.0; local 5/5.

## CP3 — Registry + staleness

- [x] Registry series `'1.16'` with every physical fact carried forward.
- [x] `PINNED_AGENT_GENERATOR_VERSION = '1.16.0'`; dependent literals rotated.
- [x] Registry + tool-init-state suites green.

## CP4 — New executable proofs

- [x] Config-failure envelope: both codes, the findings-transport variant, and the unchanged
      healthy shapes.
- [x] Step-coverage WARNING: three incomplete variants, complete clean, plain exit 0,
      `--strict` exit 1, `#### Notes` silent.
- [x] Matrix total recorded (15 pinned files / 51 tests, plus 6 new assertions).
- [x] Both new fixtures made platform-portable after round 1: separator-neutral config-path
      assertion, and a directory (not `chmod 000`) as the `unreadable_config` trigger. The second
      keeps Windows coverage instead of skipping the capability there.

## CP5 — Docs + changeset

- [x] `README.md` and `packages/cli/README.md` carry the 1.16 window and the Node `>=22.12.0`
      floor note.
- [x] `AGENTS.md` decision + pin lines.
- [x] `.changeset/*.md` for the four version-locked packages.
- [x] `openspec validate update-openspec-cli-16-line --strict` clean on the real 1.16.0 binary.

## CP6 — Gates, delivery, release

- [x] Broad gates green on the frozen tree. Round 1 failed on three fixture defects (one missing
      compat mirror, two Windows-portability) — fixed in `d9bb7c16`. Round 2 and the rebased round 3
      each failed once on a pre-existing shared-runner flake (`tool-subscription-router` explore
      stage; `cli-executor` tsx.cmd tree retirement) and passed on rerun with no code change. All
      seven checks green on the merged head.
- [x] Round-A folded, Round-B/Round-C approved (scores recorded).
- [x] PR merged with `mergedAt` verified (`166b44ab`, 2026-11-04T13:26:38Z).
- [ ] Archive PR merged; the four deltas synced into `openspec/specs/**` by hand (CLI `archive`
      refuses `RENAMED` + `MODIFIED` together).
- [ ] Release: `pnpm changeversion`, version PR merged, `release.yml` success, four independent
      facts (main head / remote tags / GitHub Release / every npm package), submodule gitlink
      verified not reverted.
- [ ] Resource回收 + residue audit reported.
- [x] Owner browser-walkthrough boundary unchanged (2026-07-20 law); no UI change ships.
