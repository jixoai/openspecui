<!--
Orthogonal intents (created 2026-09-12 Asia/Shanghai):
1. Track live implementation state, review rounds, and evidence for OpenSpecUI 13.
2. Record the subagent topology and the integrator-owned shared-file rule.
3. Keep the header law visible to every implementation agent.

Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
-->

# OpenSpecUI 13 implementation state

## Current state

- CP0 done: worktree + submodule pin (`9d4e5974e5c0d9a09b9c6c1e1eb0975e80ec4461`) + evidence report + change
  artifacts, on branch `target-openspec-cli-113-line` (uncommitted until the Codex change review round lands).
- Slices: not started.

## Evidence recording rule

Every implementation round records: the slice, the production owner file(s), the precise red case as it
failed (or the honest statement that a red case could not be captured and why), the focused green command and
its result, and the commit. A claim without its command output is not evidence.

## Subagent topology

- Batches follow the slice order in `research-plan.md`; each subagent touches only its slice's file set.
- Shared files (`packages/core/package.json` devDeps, lockfile, cross-package copy, AGENTS.md, README files,
  `.changeset/`) are integrator-owned: subagents report required changes; ZCode lands them.
- Subagents never `git commit`/`git push`, never operate shared resources (dev server, herdr), and must
  report difficulties encountered plus how they resolved them (subagent feedback protocol).
- Subagents that start any long-lived process (dev server, fixture daemon) must terminate it and report the
  pid plus recovery evidence (resident-process recovery law).

## Header law reminder

Every changed TypeScript/TSX physical file, including tests, carries an accurate timestamped
orthogonal-intent/original-request header. This change's original request line is dated 2026-09-12.

## Review rounds

(round dispositions recorded here as reviews complete)
