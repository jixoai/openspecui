<!--
Orthogonal intents (created 2026-09-26 Asia/Shanghai):
1. Preserve the original request and in-window patch-rotation decision for the OpenSpecUI 13 line.
2. Record the Owner-default decisions taken without an interactive answer, each vetoable in review.
3. State the planning-plus-delivery boundary for the implementation agents.

Original request (2026-09-26): "Openspec 1.13.2 释放了，更新本地引用。1. 调查变更内容，然后开始规划适配工作，我们将用标准工作流来推进。让 codex 参与 remix。2. 使用 vision 子代理负责端到端的走查验证，使用 ego-browser"
-->

# OpenSpec CLI 1.13.2 patch intake

## User Input

> Openspec 1.13.2 释放了，更新本地引用。1. 调查变更内容，然后开始规划适配工作，我们将用标准工作流来推进。让 codex 参与 remix。2. 使用 vision 子代理负责端到端的走查验证，使用 ego-browser

Standard FULL-WORKFLOW on a git worktree, same shape as the previous in-window rotations:

1. Create the worktree, update `references/openspec` to `v1.13.2`, investigate the upstream delta, and write
   the evidence report (`references/openspec-1.13.2-report.md`).
2. Write the openspec change; the change document is reviewed by Codex (remix) before implementation freezes.
3. Implementation runs as parallel subagent batches with non-overlapping file sets.
4. ZCode integrates, runs focused gates, then broad gates; Codex reviews around the change.
5. Iterate until complete; a vision subagent performs the agent-side E2E walkthrough with ego-browser
   (preparation evidence); then clean up herdr, archive the change, commit and push the PR.

## Objective Scope

Rotate the OpenSpecUI 13 line to the OpenSpec CLI 1.13.2 patch release **inside the unchanged
`>=1.13.0 <1.14.0` window**:

```text
OpenSpec CLI v1.13.2 (32 commits, src +883/-268)
  ├── P1  apply taskTrackingConfigured + unavailableTrackingFiles + glob tracks  -> contract + projection + surface
  ├── P2  Kilo Code command path .kilocode/workflows -> .kilo/command            -> registry physical fact
  ├── P3  artifact-glob recognition widened (brace/extglob)                      -> dependency-watch parity
  ├── P4  validation semantics/message content inside unchanged shapes           -> fixture evidence only
  ├── P5  behavior fixes in existing envelopes / delivered content               -> no production change
  └── P6  non-obligations (no new command/flag/capability; agent-contract.md unchanged) -> window, registry series, staleness unchanged
```

Deliverables: pinned reference/submodule/fixture rotation (`1.13.1` -> `1.13.2`), typed
Apply tracking-evidence contract with its projection chain and Change-Detail evidence surface, Kilo Code
registry path rotation with legacy-path evidence and both-generations cleanup, artifact-glob recognition
parity, pinned-fixture matrix updates, evidence report, docs pin references, and a changeset for an
OpenSpecUI 13.x release.

## Non-Goals

- No admission-window change: `>=1.13.0 <1.14.0`, `deriveOpenSpecCliCapabilities`, the Agent registry
  series, and generator staleness do not move (verified: `src/index.ts` byte-identical; no
  command/flag upstream).
- No apply gating: `taskTrackingConfigured` / `unavailableTrackingFiles` are typed evidence only; they
  never gate apply state, CLI progress authority, or the Apply action unlock (upstream contract:
  "Read all available artifacts… Treat apply `state` and `instruction` as context").
- No per-patch registry snapshot mechanism: the registry stays a single `'1.13'` snapshot; the Kilo path
  rotation is expressed as the pinned patch's physical reality plus `legacyPathTemplates` evidence and
  both-generations cleanup (the upstream CLI itself writes the new path and cleans both).
- No local mirror of upstream line-ending preservation, archive Windows copy fallback, or
  `verify-change` template semantics (CLI-owned; OpenSpecUI delegates archive/verify/delivery).
- No new major, no README re-scoping: the 13.x line continues; README version tables already say
  `1.13.x` ranges (audit for explicit `1.13.1` runtime claims and update only where found).

## Acceptance Boundary

- Agents deliver code, focused tests, fixture-matrix updates, and CI-equivalent local gates; the Owner
  performs the final end-to-end browser walkthrough and release acceptance (2026-07-20 law unchanged).
  The user-requested vision-subagent ego-browser walkthrough is **preparation evidence** for that Owner
  walkthrough, not a replacement.
- The pinned executable identity (`--version` = `1.13.2`) is asserted by the fixture matrix before any
  contract assertion, exactly as the 1.13.1 pin was.
- Red evidence for each slice is captured at its named fixed point (see research plan); the projections
  are pure decode/filter/spread chains, so structural reds carry the burden (no hidden lifecycle
  bookkeeping in this change).

## Owner-default decisions (vetoable in review)

1. **In-window patch rotation, not a new line.** 1.13.2 adds no command/flag/capability; window
   constants, registry series, and staleness baseline stay. Delivered as OpenSpecUI 13.x via changesets.
2. **Single pinned positive fixture.** `openspec-cli-113` alias rotates to `1.13.2`; no `1.13.1`
   executable fixture is retained (one-pinned-per-series pattern; every 1.13.2 change is
   additive-optional at decode, so 1.13.1 owns no rejection case the retained 1.12.0 boundary fixture
   does not).
3. **Apply evidence members are optional at decode, absent-on-older-patches, never synthesized.** The
   window admits 1.13.0/1.13.1, which never emit `taskTrackingConfigured`; the decode schemas keep it
   `z.boolean().optional()` with absence meaning "unknown (pre-1.13.2 CLI)", and
   `unavailableTrackingFiles` absent-when-empty per the upstream contract. Neither gates anything.
4. **Kilo registry rotation via legacyPathTemplates, not a per-patch snapshot.** The snapshot carries
   `.kilo/command/opsx-{workflow}.md` as the current path; `.kilocode/workflows/opsx-{workflow}.md`
   becomes `legacyPathTemplates` evidence. The registry's raw cleanup patterns cover only the two
   legacy generations of the old folder — `.kilocode/workflows/opsx-*.md` and
   `.kilocode/workflows/openspec-*.md` — mirroring what upstream's exact-allowlist legacy-cleanup owns;
   the new `.kilo/command/` folder is the live delivery target and never appears in cleanup patterns
   or runtime cleanup results (Round-B fold: the runtime `tool-init-state` consumer additionally
   routes the legacy `opsx-*` generation through `legacyCommandWorkflows` per-artifact retirement via
   the ambiguity filter, so tests assert both the raw-pattern boundary and the runtime result
   boundary).
5. **Apply tracking evidence surfaces beside `warnings`/`missingPrerequisites`** in the existing
   `ApplyProgressNotice` direct status region (amber evidence naming each unavailable path + verbatim
   reason; no state redefinition, no fabricated 0/0 semantics when `taskTrackingConfigured === false`).
   Round-A fold (B1): the direct-status mount condition extends to BOTH `unavailableTrackingFiles`
   non-empty AND `taskTrackingConfigured === false` — a member-only-`false` payload must mount the
   region, otherwise the no-tracking requirement is unreachable.
6. **Glob recognition parity ports the upstream helper verbatim** (extglob regex + brace-expansion
   scanner + POSIX normalization) because the mirror exists to keep dependency-watch granularity aligned
   with the CLI's own notion of "is this output a glob".
