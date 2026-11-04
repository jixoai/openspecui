<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. Log every implementation batch with the commands actually run and their evidence.
2. Record each drift the executable matrix surfaces and its exact repair.
3. Keep red/green evidence falsifiable at named fixed points.

Original request (2026-11-04): "后每隔 3 天检查一下有没有需要更新的，然后更近更新。按照标准工作流推进上线。"
-->

# OpenSpec CLI 1.16.0 implementation log

Worktree `openspecui-worktrees/update-openspec-cli-16-line`, branch
`target/openspec-cli-16-line` off `origin/main` (`e99a05c9`). Fixture commands use the
`pnpm --filter @openspecui/core exec vitest run <file>` form (exec passthrough).

## Batch 0 — Detection and environment

1. `git fetch origin main --tags` in the repo and `git fetch origin --tags` in
   `references/openspec`: main head `e99a05c9`, pin `8e0288df` (v1.15.0), newest upstream tag
   `v1.16.0` (`27c05157`), npm `latest` = `1.16.0`. No other session had already followed the
   release (no v16 change in `openspec/changes/archive/`).
2. Grading: `git rev-list --count v1.15.0..v1.16.0` = 19; `git diff --shortstat` = 231 files,
   +4615/-1581; `src` = 12 files, +404/-41; `git diff --quiet` per key surface confirmed
   `src/index.ts`, `docs/agent-contract.md`, `src/core/config.ts`, `src/core/profiles.ts`, and
   `src/core/command-generation/` all UNCHANGED.
3. Worktree created off `origin/main`; submodule checked out `v1.16.0`; alias
   `openspec-cli-116` added; `pnpm install` clean (23.6 s); both alias bins answer
   `--version` with `1.16.0` and `1.15.0` respectively.
4. Executed-CLI evidence (throwaway `/tmp` project, real binaries):
   - broken `config.yaml` → 1.16.0 exits 1 with the bare `{status:[{severity:'error',code:
'unparseable_config',message,fix}]}` envelope; the same project under `--report findings`
     returns the same envelope; `chmod 000` yields code `unreadable_config`; healthy project
     keeps `items/root/summary/version` and `itemFindings/report/root/summary`.
   - the same broken config on 1.15.0 returns the ordinary report — the verified boundary
     discriminator.
   - a change with one complete and three incomplete scenarios → exactly three WARNINGs, item
     valid, exit 0; `--strict` exits 1 with `{items:1, passed:0, failed:1}`.
   - `update --dry-run --json` exits 0 on 1.15.0, so it cannot serve as a 1.16-only probe.

## Batch 1 — Round-A review (both channels, no production code touched)

**Research channel: 6.5/10.** Independently reproduced every evidence claim (pin/describe/diffstat,
the five `diff --quiet` surfaces, the three CLI behaviours, the schema-decode claim) and then hit
five planning blockers, each verified by the main agent before folding:

- B1 changeset must be `major` (packages sit at `15.1.0`; precedent `a0bef65f`).
- B2 two spec deltas were missing; `projection-contract-truth` and `opsx-config-center` still
  declared the 1.15.0 pinned baseline, so archiving would leave the corpus self-contradictory.
- B3 `scripts/check-openspec-reference.mjs` is a **silent fake green**: it ran `OK:
v1.15.0-19-g27c05157`, because `git describe --match 'v1.15.*'` accepts a post-tag checkout.
- B4 ten version-semantic constants, not five, plus two script mirrors and a source-text equality
  test.
- B5 the root workspace **does** declare `engines >=20.19.0` (the first draft claimed no
  `engines` anywhere) while `openspec-cli-116` requires `>=22.12.0`.

**Codex channel: 5.5/10** (1 h 23 m, 大地三). Converged with the research channel on the
evidence layer and on the major/changeset and alias-consumer class of problems, and added three
findings the research channel did not:

- **Archive actually fails.** `validate --strict` exits 0 while reporting "Archive would refuse
  this delta": the `RENAMED` entries used short titles, but the parser requires the full
  `### Requirement:` form (`references/openspec/src/core/parsers/requirement-blocks.ts:561`), so
  the rename never matched and the `MODIFIED` block landed on a header that does not exist.
  Renaming a scenario title also dropped that scenario from the merge. Codex proved it by running
  `archive -y` in a throwaway project (exit 1), then fixing a copy (exit 0).
- Three **behaviour-assertion** tests were mis-classified as honesty-only cleanup:
  `cli-health-gate.test.tsx` asserts `1.16.0` is blocked, and both server routers build
  "an admitted 1.15 session" fixtures.
- The rotation skill's own `references/delivery.md:45` hardcoded
  `openspec-cli-114/bin/openspec.js` for the archive step — an executable instruction, not a
  comment, that the alias retirement would have broken.

Folded: config-center delta regenerated with full `### Requirement:` RENAMED titles and inherited
scenario titles; the two missing deltas added; `check-openspec-reference.mjs` added to Slice 1 and
to the audit gates; the constant list expanded to ten with both script mirrors; engines decision
rewritten to raise the floor; behaviour-assertion tests given explicit slice ownership; the
delivery doc made line-agnostic (submodule bin primary) with a "never hardcode an alias" rule; the
audit rule changed from "old tokens must be zero" to a three-bucket triage; checkpoints CP1
aligned with the ten constants.

**Archive experiment (after the fold).** Copied the repository's `openspec/` tree to a throwaway
project and ran the pinned 1.16.0 `archive update-openspec-cli-16-line -y`: exit 0, totals
`+3 ~4 -0 →1 renamed`, main specs show the renamed requirement, the 1.16 window, and the 1.16.0
pinned generator baseline with **no** residual v15 baseline and no scenario loss.

## Batch 1b — Round-B research channel (8.0/10, +1.5) and its fold

The research channel re-ran the archive experiment at HEAD `36551bf4` and reproduced
`+3 ~4 -0 →1` exactly, then mechanically compared (requirement, scenario) sets before/after
(97→98, 56→56, 86→92, 15→15; zero losses). It also confirmed the fold landed where claimed. Four
remaining blockers, all real:

- **RB1 — a semantic bug my generator introduced.** The `opsx-config-center` retired-line scenario
  originally read `stable 1.14.x after the v15 admission gate` (1.14 was retired under v15). My
  script's blanket rotation moved it to `stable 1.16.x after the v16 admission gate`, i.e. it
  described the **admitted** line as retired, contradicting both the requirement text and its
  sibling scenario. Fixed to `stable 1.15.x after the v16 admission gate`; the semantic gate in
  the research plan now asserts both directions (`stable 1.15.x after …` present,
  `stable 1.16.x after …` absent). The one-off generator that produced the delta lived in
  `/tmp` and is not committed — the gates, not a script, are the durable invariant.
- **RB2 — three admitted-line mentions never rotated** (`an admitted 1.15 Agent projection` ×2,
  `the same 1.14-selected registry`). Rotated to 1.16 / 1.15-selected.
- **RB3 — the "honesty-only" bucket still held behaviour assertions.** `agent-delivery-registry.test.ts`
  asserts `selectAgentDeliveryRegistry('1.16.0') => []` (must reverse), `workflow.test.ts`'s
  `capabilities115` fixture feeds six gated-surface tests, and twelve web/server tests feed
  `version: '1.15.0'` as admitted session data. `tool-init-state.test.ts` uses `'1.15.2'`, which a
  "rotate 1.15.0" instruction cannot reach. The bucket criterion is now "does any assertion depend
  on admission/capability truth", with an explicit reversal-class list.
- **RB4 — two of the three hard-empty gates could never reach zero** (they matched file-header
  history, CHANGELOGs, and `target-openspec-cli-114-line` provenance). Replaced with verified
  patterns plus a post-merge semantic gate.

Re-run after the fold: `validate --strict` clean (0 issues), archive exit 0 with the same totals,
`rg "admitted 1\.15" openspec/specs` = 0, and no admitted line written as retired.

## Batch 2 — Window + pin rotation

Pending Round-B approval. Red record, rotation, matrix run.

## Batch 4 — First CI round (PR #321)

Three defects surfaced, all in test fixtures rather than production code. Recorded because two of
them are classes the plan predicted and then under-executed.

1. **A compat mirror the plan named but the rotation missed.** `packages/server/src/tool-subscription-router.test.ts`
   fed `version: '1.15.0'` as admitted session data, `generatedBy: "1.15.0"` into a generated
   skill, and expected `generatedByVersion: '1.15.0'`. After the window flip the session is
   unadmitted, so every subscription projection came back empty and the suite read as
   "missing tools" — a shape that looks like a production regression and is not one. RB3 had
   listed this class ("twelve web/server tests feed `version: '1.15.0'` as admitted session data");
   the executed rotation covered the files it enumerated and skipped this one. All three samples
   rotate to 1.16.0, and the file header records the failure shape so the next rotation recognises
   it. Local run: 5/5.
2. **Windows-only: a POSIX separator assertion.** The boundary discriminator asserted the CLI
   message contains `openspec/config.yaml`; Windows prints `openspec\config.yaml`. Now
   `join('openspec', 'config.yaml')`.
3. **Windows-only: `chmod 0o000` cannot deny reads.** Windows has no read bit, so the
   `unreadable_config` fixture took a different branch (exit 1, empty stdout). Replaced with a
   **directory** where the config file belongs: upstream gates on `existsSync` +
   `readFileSync` (`resolveConfigFilePath` / `readConfigParseError`), so a directory is a `kind:
'read'` failure on every platform, and the code is chosen by branch rather than errno. This
   keeps the fixture running on Windows instead of skipping the capability there — the
   `it.skipIf` pattern used for `chmod`-based tracking fixtures would have removed coverage.

Boundary that remains honest: the directory trigger proves the read-failure **branch**, not a
permission-denied errno. Upstream's code selection is errno-independent, so what OpenSpecUI decodes
is identical.
