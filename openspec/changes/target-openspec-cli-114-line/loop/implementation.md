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

(pending)
