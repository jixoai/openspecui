<!--
Orthogonal intents (created 2026-09-03 Asia/Shanghai):
1. Preserve the original request and version-line decision for OpenSpecUI 12.
2. Record the Owner-default decisions taken without an interactive answer, each vetoable in review.
3. State the planning-plus-delivery boundary for the implementation agents.

Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
-->

# OpenSpecUI 12 intake

## User Input

> Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进

Standard FULL-WORKFLOW on a git worktree:

1. Create the worktree, update `references/openspec`, investigate the upstream delta, and write the evidence
   report.
2. Write the openspec change; the change document is reviewed by Codex before implementation freezes.
3. Implementation runs as parallel subagent batches with non-overlapping file sets.
4. ZCode integrates, runs focused gates, then broad gates; Codex reviews milestones around the change.
5. Iterate until complete; then clean up herdr, archive the change, commit and push the PR, clear the
   worktree, rebase-check `main`.

## Objective Scope

Ship OpenSpecUI 12 as one adaptation line for OpenSpec CLI 1.12.x: pinned reference update, research report,
typed validate-findings contracts, merge-conflict INFO presentation, SourceCraft Code Assistant delivery
projection, generator staleness rotation, executable fixtures, README/release preparation, and the Owner-only
acceptance boundary.

```text
OpenSpec CLI 1.12.x ----> OpenSpecUI 12 contracts, projections, tests, release preparation
```

## Owner-default decisions (vetoable in review)

The Owner was offered the version-line choice interactively during planning and did not answer; these
decisions follow the recorded recommendation and precedent. The Codex change review and the Owner may veto any
of them before implementation freezes.

1. **OpenSpecUI 12, single-series window `>=1.12.0 <1.13.0`.** The v9 (1.8+1.9) and v11 (1.10+1.11) windows
   were both opened after their second minor was published and fixture-verified; only `1.12.0` exists today,
   so v12 does not claim support for an unpublished `1.13`. The rejected alternative was OpenSpecUI 13 with
   `>=1.12.0 <1.14.0` (preserving the skip-even naming), which would auto-admit a future unverified series.
   When 1.13 ships, admission is a separate verified decision: a 12.x window widening (the 6.1/1.7-bridge
   precedent) or a new major.
2. **`validate --report findings` is exposed as a capability-gated validation evidence surface**, not a
   replacement for the full validate report as the validation truth source; the UI presents both the filtered
   `returnedItems` view and the preserved full-run totals.
3. **SourceCraft Code Assistant enters the Agent registry with `minCliSeries: '1.12'`** and no UI beyond the
   existing `/config/agents` inventory; its skills are referenced by natural language, with no slash-command
   surface projected.
4. **The fixture matrix keeps the `openspec-cli-111` devDep alias for capability-boundary negatives** (a
   pinned 1.11.0 executable rejecting `--report findings`) while `openspec-cli-112` becomes the positive
   evidence executable; no hand-authored payload may establish a newly accepted 1.12 contract.

## Non-Goals

- Do not create or publish an OpenSpecUI 13 line, and do not admit or pre-claim OpenSpec CLI `1.13`.
- Do not support OpenSpec CLI `<1.12.0`, prereleases, or `>=1.13.0`; no 1.10/1.11 compatibility bridge.
- Do not recompute archive merge conflicts or requirement diffs locally; the CLI findings/diff remain
  evidence, not a parallel parser.
- Do not expose an `init --language` UI input (carried over from v11).
- Do not introduce parallel `.gitkeep` anchor logic; init delegation stays the only anchor writer.
- Do not repair unrelated active/archive validation failures in this repository.
- Do not publish, merge, archive this Change, or claim final browser acceptance. Those remain Owner actions.

## Acceptance Boundary

The delivery is complete only when:

- `references/openspec` points at the verified v1.12.0 source baseline and
  `references/openspec-1.12.0-report.md` states the executed-evidence baseline;
- the Change artifacts and delta Specs pass targeted strict validation;
- every implementation task identifies its primary owner, precise red case, green case, and focused-review stop
  rule, ordered relative to dependent work;
- the Codex change review has been incorporated (and later the code-review loop closed);
- pinned 1.12.0 executable fixtures prove every newly accepted contract, with pinned 1.11.0 proving the
  capability-boundary rejections; and
- the final interactive walkthrough remains explicitly Owner-only.
