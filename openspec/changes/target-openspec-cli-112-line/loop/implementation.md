<!--
Orthogonal intents (created 2026-09-03 Asia/Shanghai):
1. Track live implementation state, review rounds, and evidence for OpenSpecUI 12.
2. Record the subagent topology and the integrator-owned shared-file rule.
3. Keep the header law visible to every implementation agent.

Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
-->

# OpenSpecUI 12 implementation state

## Current state

- CP0 done: worktree + submodule pin (`e062b9572be933564ba3899d059377dfa1393e32`) + pin guards + evidence
  report + change artifacts, committed on `target-openspec-cli-112-line`.
- CP1 pending: Codex change review before any production slice starts.

## Evidence recording rule

Every implementation round records: the slice, the production owner file(s), the precise red case as it
failed (or the honest statement that a red case could not be captured and why), the focused green command and
its result, and the commit. A claim without its command output is not evidence.

## Subagent topology

- Batches follow the slice order in `research-plan.md`; each subagent touches only its slice's file set.
- Shared files (`packages/core/package.json` devDeps, lockfile, cross-package copy, AGENTS.md, README files,
  `.changeset/`) are integrator-owned: subagents report required changes; ZCode lands them.
- Subagents never `git commit`/`git push`, never operate shared resources (dev server, herdr), and must
  report difficulties encountered plus how they resolved them.

## Header law reminder

Every changed TypeScript/TSX physical file, including tests, carries an accurate timestamped
orthogonal-intent/original-request header. This change's original request line is dated 2026-09-03.

## Review rounds

(round dispositions recorded here as reviews complete)

## Round-A review disposition (PENDING)

Codex change review of the planning artifacts; expected focus: single-series window decision, findings
contract shape, registry snapshot inheritance, fixture roles (112 positive / 111 boundary).
