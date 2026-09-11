<!--
Orthogonal intents (created 2026-09-12 Asia/Shanghai):
1. Preserve the original request and version-line decision for OpenSpecUI 13.
2. Record the Owner-default decisions taken without an interactive answer, each vetoable in review.
3. State the planning-plus-delivery boundary for the implementation agents.

Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
-->

# OpenSpecUI 13 intake

## User Input

> Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue

Standard FULL-WORKFLOW on a git worktree:

1. Create the worktree, update `references/openspec` to `v1.13.0`, investigate the upstream delta, and write
   the evidence report (`references/openspec-1.13.0-report.md`).
2. Write the openspec change; the change document is reviewed by Codex before implementation freezes.
3. Implementation runs as parallel subagent batches with non-overlapping file sets.
4. ZCode integrates, runs focused gates, then broad gates; Codex reviews milestones around the change.
5. Iterate until complete; then clean up herdr, archive the change, commit and push the PR.
6. After delivery, survey GitHub issues related to the 1.13 line (upstream protocol facts referenced by the
   report: Fission-AI/OpenSpec #1783, #1798, #1799, #1800, #1801, #1802, #1807, #1808, #1657, #1689, #1700,
   #1779, #1780, #1782) and this repository's 1.13-support issues, linking the adaptation report and PR;
   close or comment only where the delivered work objectively resolves the issue.

## Objective Scope

Ship OpenSpecUI 13 as one adaptation line for OpenSpec CLI 1.13.x: pinned reference update, research report,
Apply Instructions `missingPrerequisites`/`warnings` typed contract and its Web projection, generator
staleness rotation to the 1.13.0 baseline, executable pinned fixtures with 1.12.0 boundary negatives,
README/release preparation, and the Owner-only acceptance boundary.

```text
OpenSpec CLI 1.13.x ----> OpenSpecUI 13 contracts, projections, tests, release preparation
```

## Owner-default decisions (vetoable in review)

The Owner asked for planning to start immediately with the standard worktree workflow and Codex participation;
the decisions below follow the recorded recommendation and repo precedent. The Codex change review and the
Owner may veto any of them before implementation freezes.

1. **OpenSpecUI 13, single-series window `>=1.13.0 <1.14.0`** (new major, not a 12.x widening). The v12 report
   pre-declared 1.13 admission as a separately verified decision; the verified 1.13 delta is small but real
   (two projected Apply Instructions fields + generator-staleness rotation). A 12.x bridge would force the
   staleness baseline to become series-conditional inside 12.x and diverge from the one-line-per-series cadence
   every line since v7 has used. `1.14` is not pre-claimed.
2. **`missingPrerequisites` and `warnings` are projected typed contract fields, not a new capability gate.**
   Inside the single-series 1.13 window every admitted CLI produces them; the schema marks both optional
   (upstream omits them when empty) and the projection surfaces them when present. A `deriveOpenSpecCliCapabilities`
   flag was rejected because there is no non-current admitted series to distinguish.
3. **Apply `warnings` render on the direct plane; `missingPrerequisites` renders as readable next-step
   evidence.** The warning predicts an objective `openspec validate` failure (OPSX-first information hierarchy
   law: failures are direct-plane), while the build-order chain is guidance, not a blocker.
4. **Pinned fixture rotation:** `openspec-cli-113` (npm alias `@fission-ai/openspec@1.13.0`) becomes the
   positive line; the retained `openspec-cli-112` executable proves capability-boundary rejections (1.12
   blocked by the v13 gate). The v11 helper and alias stay untouched where they already exist; no positive
   contract evidence may come from a retired line.
5. **CLI-internal parser/merge fixes are fixture-scoped, not UI logic.** CommonMark marker acceptance,
   duplicate delta sections, wrapped scenario bullets, and fence-aware archive merging are proven through the
   pinned 1.13.0 executable fixtures; OpenSpecUI adds no parallel parsing.
6. **GitHub issue handling happens after delivery**, limited to linking objective evidence; no issue is closed
   on prediction.

## Constraints

- OpenSpec CLI remains the workflow source of truth; no parallel parsing or archive logic.
- Every changed TypeScript/TSX physical file (including tests) carries an accurate timestamped
  orthogonal-intent/original-request header.
- Release README law: any release updating the repository README must update `packages/cli/README.md` in the
  same delivery; both scope to the v13 line.
- Browser acceptance ownership law: agents stop at focused Vitest plus component-level Playwright evidence;
  the Owner performs the final walkthrough.
- Branch protection: PR from `target-openspec-cli-113-line`; no direct pushes to `main`; Changeset required
  for publishable packages.
