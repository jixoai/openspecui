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
- [ ] Round-A Codex channel completed; converged/divergent findings folded.
- [ ] Round-B approved (score recorded).

## CP1 — Window + pin rotation

- [ ] Red recorded: stale `['1.15.0']` identity assertion fails after the alias bump, before the
      constant rotation.
- [ ] `openspec-compat.ts` five constants rotated to the 1.16 window; header intent updated.
- [ ] Alias `openspec-cli-116` added; lockfile regenerated; `--version` proves `1.16.0`.
- [ ] Helper renamed to `official-cli-v16-fixtures.ts` with `PINNED_OPENSPEC_V16_VERSIONS`.
- [ ] Every pin guard rotated (`EXPECTED_COMMIT`, regression assertion, cold-start commit +
      observed version, web playwright commit + version).
- [ ] gitlink staged at `v1.16.0`; `CLAUDE.md` pointer rotated.

## CP2 — Fixture suite rotation

- [ ] 14 positive suites renamed to `official-cli-v16-*` with version literals, type imports and
      helper paths rotated; intent headers carry the 2026-11-04 request line.
- [ ] Boundary suite rotated to `official-cli-v15-boundary-fixtures.test.ts` on
      `openspec-cli-115` (1.15.0), with the config-failure discriminator replacing the
      `update --dry-run`/`install` absence probes.
- [ ] `openspec-cli-114` alias removed; no live consumer remains.
- [ ] Full matrix green against 1.16.0 with zero assertion relaxations.

## CP3 — Registry + staleness

- [ ] Registry series `'1.16'` with every physical fact carried forward.
- [ ] `PINNED_AGENT_GENERATOR_VERSION = '1.16.0'`; dependent literals rotated.
- [ ] Registry + tool-init-state suites green.

## CP4 — New executable proofs

- [ ] Config-failure envelope: both codes, the findings-transport variant, and the unchanged
      healthy shapes.
- [ ] Step-coverage WARNING: three incomplete variants, complete clean, plain exit 0,
      `--strict` exit 1, `#### Notes` silent.
- [ ] Matrix total recorded.

## CP5 — Docs + changeset

- [ ] `README.md` and `packages/cli/README.md` carry the 1.16 window and the Node `>=22.12.0`
      floor note.
- [ ] `AGENTS.md` decision + pin lines.
- [ ] `.changeset/*.md` for the four version-locked packages.
- [ ] `openspec validate update-openspec-cli-16-line` clean.

## CP6 — Gates, delivery, release

- [ ] Broad gates green on the frozen tree.
- [ ] Round-A folded, Round-B approved (scores recorded).
- [ ] PR merged with `mergedAt` verified; archive PR merged.
- [ ] Release: `pnpm changeversion`, version PR merged, `release.yml` success, four independent
      facts (main head / remote tags / GitHub Release / every npm package), submodule gitlink
      verified not reverted.
- [ ] Resource回收 + residue audit reported.
- [x] Owner browser-walkthrough boundary unchanged (2026-07-20 law); no UI change ships.
