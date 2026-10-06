<!--
Orthogonal intents (created 2026-10-06 Asia/Shanghai):
1. Preserve the original request and in-window patch-rotation decision for the OpenSpecUI 14 line.
2. Record the Owner-default decisions taken without an interactive answer, each vetoable in review.
3. Record the gitlink regression incident this rotation repairs.

Original request (2026-10-06): "官方发布了 v1.14.1，请按照规范更新跟进这个版本"
-->

# OpenSpec CLI 1.14.1 patch intake

## User Input

> 官方发布了 v1.14.1，请按照规范更新跟进这个版本

Standard workflow on a git worktree, same shape as the previous in-window rotations
(update-openspec-cli-1131 / -1132):

1. Create the worktree, update `references/openspec` to `v1.14.1`, investigate the upstream delta,
   and write the evidence report (`references/openspec-1.14.1-report.md`).
2. Write the openspec change; the change documents and implementation are reviewed by Codex
   (remix) before delivery freezes.
3. Implementation, focused gates, then broad gates; Codex reviews around the change.
4. Iterate until complete; archive the change after merge, release only on explicit Owner request.

## Objective Scope

Rotate the OpenSpecUI 14 line to the OpenSpec CLI 1.14.1 patch release **inside the unchanged
`>=1.14.0 <1.15.0` window**:

```text
OpenSpec CLI v1.14.1 (13 commits, src +2015/-1830 — mostly the lazy-load shuffle)
  ├── P1  archive diagnostic code archive_retirement_cleanup_failed    -> evidence-only (open code string)
  ├── P2  apply all_done: completion separated from archive readiness  -> fixture proof (new case)
  ├── P3  validate: >500-char requirement info -> WARNING, --strict fails -> fixture proof (new case)
  ├── P4  view/specs/verify template behavior fixes                   -> CLI-owned, no mirror
  ├── P5  CLI lazy-loads command implementations                       -> surface byte-stability asserted
  └── P6  no new command/flag/capability; window, registry, staleness -> do not move
```

Zero production package changes: every obligation lands in fixture constants, pin guards,
the executable proof matrix, and evidence docs.

## Incident: gitlink regression repaired by this rotation

The 2026-10-02 release commit `06dec8b9` (`chore(release): apply changeset version`) reverted the
`references/openspec` gitlink from v1.14.0 (`94ca9c1e`) back to v1.13.0 (`9d4e5974`). The PR-time
pin guards (`scripts/prepare-openspec-reference.mjs` `EXPECTED_COMMIT` check in `pr-quality.yml`
and `upstream-contract-regression.test.ts`) never fired because no PR has opened since the release
merge; Release/Deploy workflows do not run them. This rotation re-pins the gitlink to v1.14.1, which
restores guard consistency; the merged guard pair then proves it on the PR itself.

## Owner-default decisions (vetoable in review)

1. **No changeset.** Zero production package code changes (test constants/fixtures, CI prepare
   script, reference docs only); the docs/CI-only changeset exception applies. A patch bump would
   publish packages with no behavioral delta. If review vetoes, add a patch changeset for
   `openspecui`/`@openspecui/core`.
   **Folded (2026-10-06, Codex Round-A blocker 1): vetoed and repaired.** `scripts/changeset-check.mjs`
   classifies `packages/core/package.json` and the web playwright script as release-affecting paths
   and the gate compares `base...HEAD` (so it only fires after commit), and both 1131/1132 rotations
   shipped changesets. `.changeset/update-openspec-cli-1141.md` now patches all four
   version-locked packages with the rotation summary.
2. **Fixture headers keep creation-time pin mentions.** Per the 1131/1132 rotation precedent
   (rotation commits touched constants/guards only), per-fixture intent lines such as "Execute the
   pinned OpenSpec 1.14.0 …" stay as written; the live pin truth is owned by the rotated constants
   and guards. Files that changed for other reasons (boundary literals, local `PINNED_BINS`, new
   cases) carry the 2026-10-06 request line.
3. **Generator staleness baseline stays 1.14.0.** Series-aware staleness is line-grained;
   `tool-init-state.test.ts` `generatedByVersion`/`generatorVersion` literals are baseline
   constants, not executable pins, and do not rotate.
4. **No agent E2E walkthrough beyond the existing browser suites.** No UI change ships; the
   Owner's final browser walkthrough boundary (2026-07-20 law) is unchanged.
