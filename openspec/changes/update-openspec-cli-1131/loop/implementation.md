<!--
Orthogonal intents (created 2026-09-17 Asia/Shanghai):
1. Keep implementation reality synchronized with the approved 1.13.1 patch plan.
2. Record scope updates, key decisions, and loopback triggers per slice.

Original request (2026-09-17): "Openspec 1.13.1 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
-->

# OpenSpec CLI 1.13.1 patch implementation log

## Status: implemented — all slices landed, broad gates green, Round-C B1'' folded; PR delivery next

| Slice | Scope | Status | Evidence |
| --- | --- | --- | --- |
| CP0 | worktree + pin + report + change artifacts | done | submodule `v1.13.1` @ `634c557`; report + this change |
| CP0-R1 | Round-A review + blocker fold | done | super-thinker 6.5/10 REVISE -> B1/B2/B3 folded (see checkpoints) |
| CP0-R2 | Codex Round-B fold + REVISE conditions | done | 6.5/10 REVISE, 4 conditions resolved (structural set, degradation semantics, interfaces/tests, P5 correction) |
| 1 | fixture alias + identity constants + reference guard + CLAUDE pointer | done | red `expected '1.13.1' to be '1.13.0'` -> 29/29 green @ 1.13.1; commit `c0dacb0e`; out-of-plan pins `b825c87c`/`6eefdc10`; fifth pin point + lane registration post-test:ci (`opsx-kernel-schemas-root.fixtures.test.ts`) |
| 2 | change-list nested/warnings contract + projection + Changes surface | done | commit `fa146e5e` (26 files); 14 runtime reds + type-boundary red -> green; core 72/72, server 35/35 + router 107/107, web 21/21; integrator added `change.listWithMeta`/`subscribe` transport subtraction + v12-boundary version-arg rotation |
| 3 | task-line reading parity + toggle parity | done | commit `92d50a73`; red 5 failing -> green; 29/29 core task/parser + 9/9 opsx-types + 1/1 server toggle + 23/23 web change-view; upstream-vs-local 32-line corpus differential identical |
| 4 | executable fixtures + decode regression + docs + changeset | done | commits `3c1a488d` (fixtures + decode) + `f57cc675` (AGENTS.md decision + changeset); real-CLI nested/warnings evidence, task-count parity 5/2, diagnostics decode regression 43->46 |
| Gates | format / lint / typecheck / test:ci / test:browser:ci | done | all green; test:ci 778/780 + 13 skipped with the two triages recorded below and in CP5 |
| Round-C | Codex implementation review | done | 7.9/10 REVISE with the single blocker B1'' (this file's stale status line) — fixed here; codex pre-committed 8.5/10 and PR delivery once fixed. N1''/N2'' considered: the use-opsx `[]` normalization keeps its documented view-layer rationale; the nested fixture already asserts the structural fields (code/name/nested) plus two message key-phrases. N3'' (realpath triage) accepted with PR-notes evidence. |
| Delivery | PR from `target/openspec-cli-1131-patch` | pending | PR notes carry the Owner-walkthrough boundary and both environmental triages |

## Decisions taken during implementation

- 2026-09-17 Slice 1 execution found two pin points the plan's owner list missed, both rotated in follow-up
  commits (`b825c87c`, `6eefdc10`): the reference-commit regression pin
  (`upstream-contract-regression.test.ts:96` — its red `expected 634c557 to be 9d4e5974` was the guard
  working as designed) and two `PINNED_OPENSPEC_COMMIT` constants
  (`root-context-cold-start.integration.test.ts`, `w2-project-binding-playwright.ts`, found by repo-wide
  hash grep). CHANGELOG/AGENTS.md mentions are frozen history or Slice 4 docs work.
- 2026-09-17 Round-A (super-thinker substitute; Codex proxy `BNUI-01deiMac.local:20002` returning 502):
  - B1 folded: kernel `entries`-only filtering cannot remove change rows because row ids come from local
    directory listings (`adapter.listChanges()`/`listChangesWithMeta()`), and Store content + search are
    independent paths. Design changed to: kernel projects `warnings` (single nested-name derivation);
    `entries`/`value` stay actionable-only; Changes/Dashboard/search/Store-content row builders subtract
    the set; degradation keeps today's behavior on CLI loss.
  - B2 folded: `[ x]` is a padded single-token box -> done; `[WIP]` (multi-token) never matches. Test
    expectations corrected after node-verified pattern runs.
  - B3 folded: upstream delta is 38 commits, not 40.
  - N1/N2/N3 adopted: extra focused gates (`parser`, `tracked-task-mutation`); `warnings.code` typed
    `z.string()` (in-window codes may grow; literal would break decode); fixture namespace root must not
    contain `tasks.md`.

## Loopback triggers

- Codex proxy recovery -> submit Round-B review of the folded plan (background watcher armed). — resolved:
  the Owner fixed the proxy; Codex executed Round-B and Round-C is planned after the gates.
- test:ci triage (2026-09-17): 2 of 793 failed.
  - `opsx-kernel-schemas-root.fixtures.test.ts` — a fifth pin point the rotation missed: a local
    `PINNED_BINS` map keyed `'1.13.0'` made `PINNED_BINS[version]` undefined and crashed `writeConfig`
    on `undefined.trim()`. The file sat in no typecheck lane (main tsconfig excludes `**/*.test.ts`),
    so the `Record<PinnedOpenspecV13Version,...>` guard was invisible — registered into
    `tsconfig.workflow-contract-tests.json` per the typed-test-evidence law; fixed and green.
  - `reactive-fs/path-realpath.test.ts` — environmental, not ours: deterministic under this shell's
    `TMPDIR=/var/...` prefix (macOS realpath canonicalizes to `/private/var`), passes with the
    normalized `/private/var` TMPDIR, and `git diff main..HEAD -- packages/core/src/reactive-fs/` is
    empty. Linux CI has no such prefix. Recorded for PR notes.
- test:browser:ci first run failed environmentally: Playwright `chromium_headless_shell-1208` was not
  installed in the local cache; installed via `pnpm exec playwright install chromium` and re-run.
- PR CI round 1 triage (2026-09-18): Fast/Windows failed on the cold-start integration assertions
  (hardcoded `version: '1.13.0'` — the SIXTH rotation point, only reachable in CI's broader file set;
  local test:ci runs 82 files vs CI's 102); Browser Gate was a pure cascade (shard `needs` Fast Gate).
  Windows-only search-router failure was a REAL integration defect: the search wiring forced the
  `opsx-change-list` CLI Work on every collection (`getCurrent`), putting a cold CLI computation on
  the first-emission path — reproduced locally on macOS after which the fix was designed. Search now
  PEEKS the projection (`read()`; `ready`/current data only, never requesting the Work): search adds
  no CLI computation of its own and degrades to full local indexing when the projection is not
  current — strictly aligned with the degradation law. Commit `1f462f6c`.
