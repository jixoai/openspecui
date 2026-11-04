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

## Batch 1 — Window + pin rotation

Pending: red record, then the rotation and matrix run.
