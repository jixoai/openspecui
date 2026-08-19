<!--
Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
1. Record the delivered implementation surface and its evidence trail.
2. Record Owner decisions on the three deferred worktree transport questions.

Owner decisions (2026-08-19):
1. "port 0" — worktree child servers use ephemeral ports (follow-up change)
2. "process, 并基于操作系统的线程数来约束最大并发" — Windows worktree transport switches to process with OS-cpu-count concurrency bound (follow-up change)
3. "尝试恢复，如果还是卡住那么就保持跳过，并补充注释相关的问题，后续再研究攻克" — restore the skipped real worker termination test; keep skip with documentation if it still hangs

Original request (2026-08-19): "先解决实际问题。然后再去做门禁路径范围化。"
-->

# Implementation Record

## Delivered PRs

| PR   | Merge      | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #255 | `9ad19017` | WMI in-flight guard (`core/child-process-tree.ts`), root vitest process-topology project (`vitest.root.config.ts`), smoke EBUSY backoff (`windows-installed-cli-smoke.sh.ts`), worktree registry lifecycle + watcher propagation + diagnostics (`cli/worktree-instance-manager.ts`, `cli/worktree-server-worker.ts`, `cli/cli-command.ts`, `cli/index.ts`), server vitest teardown ignore restored with vitest 4.1 bug documentation |
| #256 | `c40b49e2` | CI path scoping: `windows_required` output from `scripts/lib/ci-scope.mjs` and `scripts/ci-scope.mjs`; `@openspecui/website` classified Windows-neutral; `quality-windows` job-level skip condition in `pr-quality.yml`                                                                                                                                                                                                              |

## Codex review trajectory

Round 1 (4.0/10) identified three P0s: watcher not propagated (fixed), close admission race (fixed), process endpoint truth (deferred). Round 2 (5.5/10) confirmed P0-1 and P0-3 fixed; P0-2 deferred per Owner decision.

## Deferred to follow-up change (Owner decisions above)

- Process transport endpoint truth (ready IPC for process children)
- Ephemeral port (port 0) contract
- Windows process transport with OS-cpu-count concurrency
- Smoke lifecycle evidence (daemon identity/PID/tree report on EBUSY)
- Restoring the skipped real worker termination test
