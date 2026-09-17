<!--
Orthogonal intents (created 2026-09-17 Asia/Shanghai):
1. Preserve the original request and in-window patch-rotation decision for the OpenSpecUI 13 line.
2. Record the Owner-default decisions taken without an interactive answer, each vetoable in review.
3. State the planning-plus-delivery boundary for the implementation agents.

Original request (2026-09-17): "Openspec 1.13.1 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
-->

# OpenSpec CLI 1.13.1 patch intake

## User Input

> Openspec 1.13.1 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。

Standard FULL-WORKFLOW on a git worktree, same shape as the v13 line delivery:

1. Create the worktree, update `references/openspec` to `v1.13.1`, investigate the upstream delta, and write
   the evidence report (`references/openspec-1.13.1-report.md`).
2. Write the openspec change; the change document is reviewed by Codex before implementation freezes.
3. Implementation runs as parallel subagent batches with non-overlapping file sets.
4. ZCode integrates, runs focused gates, then broad gates; Codex reviews around the change.
5. Iterate until complete; then clean up herdr, archive the change, commit and push the PR.

## Objective Scope

Rotate the OpenSpecUI 13 line to the OpenSpec CLI 1.13.1 patch release **inside the unchanged
`>=1.13.0 <1.14.0` window**:

```text
OpenSpec CLI v1.13.1 (38 commits, src +3402/-499)
  ├── P1  list --json nested entries + top-level warnings   -> contract + projection + surface
  ├── P2  widened task-line reading                          -> local parser parity + toggle parity
  ├── P3  schema validate valid-with-issues semantics        -> fixture evidence only (no consumer)
  ├── P4  validate findings content additions                -> fixture evidence only (shape-compatible)
  ├── P5  behavior fixes in existing envelopes               -> no production change
  └── P6  non-obligations (no new command/flag/capability)   -> window, registry, staleness unchanged
```

Deliverables: pinned reference/submodule/fixture rotation (`1.13.0` -> `1.13.1`), typed
`nested`/`warnings` change-list contract with its projection chain and Changes-page evidence surface,
local task-line reading parity with the CLI's widened semantics, pinned-fixture matrix updates, evidence
report, docs pin references, and a changeset for an OpenSpecUI 13.x release.

## Non-Goals

- No admission-window change: `>=1.13.0 <1.14.0`, `deriveOpenSpecCliCapabilities`, the Agent registry
  series, and generator staleness do not move (verified: no new command/flag upstream).
- No `schema validate` consumer is introduced (P3 is observable only through existing failure envelopes).
- No UI-side mirror of the CLI's hostile-input hardening (`e571b5b` closed it CLI-side; OpenSpecUI adds
  no defense and invents no `invalid_item` handling beyond existing generic diagnostics decode).
- No task-toggle UX redesign: parity means the existing toggle works on the widened forms, nothing more.
- No new major, no README re-scoping: the 13.x line continues; README version tables already say
  `1.13.x` ranges and stay untouched.

## Acceptance Boundary

- Agents deliver code, focused tests, fixture-matrix updates, and CI-equivalent local gates; the Owner
  performs the final end-to-end browser walkthrough and release acceptance (2026-07-20 law unchanged).
- The pinned executable identity (`--version` = `1.13.1`) is asserted by the fixture matrix before any
  contract assertion, exactly as the 1.13.0 pin was.
- Red evidence for each slice is captured at its named fixed point (see research plan); mutation-resistance
  applies where acceptance depends on hidden lifecycle bookkeeping (it does not in this change — the
  projections are pure decode/filter chains, so structural reds carry the burden).

## Owner-default decisions (vetoable in review)

1. **In-window patch rotation, not a new line.** 1.13.1 adds no command/flag/capability; window constants,
   registry series, and staleness baseline stay. Delivered as OpenSpecUI 13.x via changesets.
2. **Single pinned positive fixture.** `openspec-cli-113` alias rotates to `1.13.1`; no second `1.13.0`
   executable fixture is retained (one-pinned-per-series pattern; every 1.13.1 change is additive-optional,
   so 1.13.0 owns no rejection case the retained 1.12.0 boundary fixture does not).
3. **The kernel projection owns one authoritative nested-name set; row builders subtract it.**
   `fetchChangeListProjection` keeps `entries` and the compat `value` actionable-only (entries carrying
   `nested` are excluded) and projects top-level `warnings` — the single derivation of the nested-name
   set. Change-row builders keep their own id sources (local directory listings) and subtract the set
   where they already join CLI data: Changes projection, Dashboard summary, search change documents,
   and the Store content projection's independent `list --json` decode. When the CLI list is
   unavailable, surfaces degrade to today's behavior (rows stay, summaries absent) — row visibility
   never becomes CLI-gated. (Round-A B1: filtering CLI entries alone removes summaries, not rows,
   because row ids come from local listings.)
4. **Warnings surface on the Changes page direct plane** (amber evidence region naming the directory and
   upstream message); Dashboard stays actionable-changes-only. Namespaced directories get no change-detail
   route entry (upstream reads now fail on them).
5. **Local task reading mirrors the CLI pattern verbatim** (all CommonMark markers, ordered markers,
   indentation, single-token markers, whitespace-only boxes, link-continuation guard, CRLF tolerance;
   done iff `x`/`X`), including `toggleMarkdownTask` write-back on the widened forms.
