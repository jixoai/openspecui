<!--
Orthogonal intents (created 2026-09-26 Asia/Shanghai):
1. Define the acceptance checkpoints and their evidence for the 1.13.2 patch rotation.
2. Keep every checkpoint falsifiable against a named command or artifact.
3. Record the Owner-only acceptance boundary and the agent-side walkthrough boundary.

Original request (2026-09-26): "Openspec 1.13.2 释放了，更新本地引用。1. 调查变更内容，然后开始规划适配工作，我们将用标准工作流来推进。让 codex 参与 remix。2. 使用 vision 子代理负责端到端的走查验证，使用 ego-browser"
-->

# OpenSpec CLI 1.13.2 checkpoints

## CP0 — Planning baseline (planning)

- [x] Worktree `openspecui-worktrees/update-openspec-cli-1132`, branch
      `target/openspec-cli-1132-patch` off `main` (`0cfb2c38`).
- [x] `references/openspec` submodule pinned `v1.13.2`
      (`db2309783547a14e150dbcbfc19120e4028446c3`).
- [x] `references/openspec-1.13.2-report.md` written with source-diff evidence.
- [x] Change artifacts (specs deltas + loop docs) written.
- [x] Codex Round-A change review completed 2026-09-26 (score 6/10; upstream facts and owner map
      fully confirmed; 2 P1 blockers + 7 P2 suggestions).
- [x] Round-A P1-1 folded: `taskTrackingConfigured === false` joins the `hasDirectStatus` mount
      condition and `ApplyProgressNotice` input (research-plan Slice 2, intake decision 5).
- [x] Round-A P1-2 folded: former Slice 4 (isGlobPattern) merged into Slice 2 — one owner/batch holds
      `opsx-types.ts`; slices renumbered (fixture matrix is Slice 4).
- [x] Round-A P2 folds: Kilo cleanup allowlist wording corrected; `tool-init-state` runtime cleanup
      boundary tests added (Slice 3); zero-files-matched fixture + unavailable-never-all_done
      falsifiable scenario added; glob-parity scope note (`opsxPathMatchesPattern` stays
      wildcard-class); Slice 4 gains explicit red/green command points.
- [ ] Codex Round-B change review approved (revised documents; score recorded here).

## CP1 — Pin rotation (implementation)

- [ ] `packages/core/package.json` alias `openspec-cli-113` -> `@fission-ai/openspec@1.13.2`;
      lockfile regenerated; workspace install clean (single install before parallel batches).
- [ ] `PINNED_OPENSPEC_V13_VERSIONS = ['1.13.2']`; fixture identity assertions green against the
      1.13.2 executable across all `official-cli-v13-*.test.ts`.
- [ ] `scripts/prepare-openspec-reference.mjs` `EXPECTED_COMMIT` =
      `db2309783547a14e150dbcbfc19120e4028446c3`; header intent updated.
- [ ] `CLAUDE.md` session pointer reads `references/openspec-1.13.2-report.md`.
- [ ] Red recorded: identity assertion against the stale `1.13.1` constant.

## CP2 — Apply tracking-evidence contract + surface (implementation)

- [ ] Contract: `taskTrackingConfigured?: boolean` + `unavailableTrackingFiles?: {path, reason}[]`
      typed on `CliApplyInstructionsSuccessSchema`; absent-when-empty preserved; 1.13.0/1.13.1-shaped
      payloads (members absent) decode identically to today.
- [ ] Projection: both members carried through `ApplyInstructionsInputSchema` /
      `ApplyInstructionsProjectionSchema` as verbatim evidence; never gate apply state or progress.
- [ ] Web: `ApplyProgressNotice` renders unavailable-tracking evidence (amber, path + verbatim reason)
      and the `taskTrackingConfigured === false` no-tracking note; `hasDirectStatus` mounts for
      non-empty `unavailableTrackingFiles` AND for `taskTrackingConfigured === false` (Round-A B1);
      TestingLibrary red recorded before the fix, including the member-only-`false` mounting case.
- [ ] Glob-recognition parity (merged into this slice's batch): `isGlobPattern` recognizes brace
      expansions and extglobs (POSIX-normalized), upstream-verbatim; recognition unit cases green;
      existing wildcard/literal cases unchanged (superset only).
- [ ] Spec deltas applied (`openspec-cli-integration`, `opsx-workflow-ui`).

## CP3 — Kilo Code registry path rotation (implementation)

- [ ] Registry entry: current path `.kilo/command/opsx-{workflow}.md`; legacyPathTemplates carries
      `.kilocode/workflows/opsx-{workflow}.md`; cleanup patterns cover both old-folder generations and
      do not touch the live `.kilo/command/` folder.
- [ ] Registry tests rotated; projection/router tests green (consumers verified registry-driven).
- [ ] `tool-init-state` cleanup-boundary tests: `.kilocode/workflows/opsx-*.md` handled as legacy
      command path (ambiguity-skipped as pattern, retired via `legacyCommandWorkflows`); `.kilo/command/`
      never appears in any cleanup result (Round-A fold).
- [ ] Pinned-fixture assertion: the 1.13.2 executable generates `.kilo/command/opsx-<id>.md`.

## CP4 — Fixture matrix, docs, changeset (implementation)

- [ ] Apply-readiness fixtures: glob-tracked aggregation + `taskTrackingConfigured: true`; the
      zero-files-matched case stays `true` with empty `tasks`; unreadable tracking evidence covered at
      minimum by contract tests (executable unreadable case where the harness allows chmod on POSIX).
- [ ] Validation fixtures: message-text expectations updated only where 1.13.2 texts fire.
- [ ] `AGENTS.md` evidence-map pin line updated to 1.13.2 (`db23097`); README audited for explicit
      `1.13.1` runtime claims (expected none).
- [ ] `.changeset/*.md` for the `openspecui` patch release.

## CP5 — Review, walkthrough, delivery

- [ ] Codex implementation review (score recorded; blockers folded and re-verified).
- [ ] Vision-subagent ego-browser E2E walkthrough of the Change Detail apply evidence plane
      (preparation evidence; isolated instance/HOME per the self-walkthrough discipline).
- [ ] Broad gates green: `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`,
      `pnpm test:browser:ci`.
- [ ] PR opened from `target/openspec-cli-1132-patch`, CI green, merged per Manager Mode; change
      archived after merge; herdr resources released; worktree retained for follow-up iterations until
      the Owner's final cleanup instruction.
- [ ] Owner final browser walkthrough boundary unchanged (2026-07-20 law).
