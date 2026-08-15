<!--
Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
1. Track v9 planning, recovery-gate evidence, and final delivery boundaries separately.
2. Prevent candidate implementation evidence from being marked as accepted completion.
3. Require focused owner review before package or Owner gates.

Original request (2026-08-15): "这里面很大的问题也是因为你作为架构师，openspec change 文件撰写不够清晰，导致Agent 没有如期完成所有开发，请你改进 change 文件，改进开发计划。"
-->

# OpenSpecUI 9 checkpoints

## 1. Planning and review correction

- [x] 1.1 Pin `references/openspec` to verified OpenSpec v1.9.0.
- [x] 1.2 Record 1.7 -> 1.8 -> 1.9 source and executable protocol evidence.
- [x] 1.3 Define the v9 supported/current version law and non-goals.
- [x] 1.4 Create the original owner/red/green implementation plan and delta Specs.
- [x] 1.5 Incorporate independent review into the authoritative delta Specs and recovery plan.

### Planning correction record (2026-08-15 Asia/Shanghai)

- The original implementation record incorrectly reported slices 1-7 as complete. The implementation review found
  that candidate tests did not exercise four required production boundaries and that two changed files violated the
  repository's ownership-metadata rule.
- `loop/recovery-plan.md` is the authoritative execution order for the reopened work. It replaces the old closure
  claim with R0-R5 gates; each gate names exactly one primary production owner, a true red case, green case, focused
  command, and stop condition.
- The active local `main` is 12 commits ahead of `origin/main`. The next implementation Agent must create a feature
  branch before production edits or PR work.

## 2. Candidate implementation recovery

`[ ]` below means the candidate source may contain a partial change, but the implementation review has not accepted
the gate. A checkbox may move to `[x]` only after its exact green case and focused command are recorded in
`loop/implementation.md` and a focused review passes.

- [x] R0 Repair `workflow.ts` ownership split and static-provider test header.
- [x] R1 Route 1.9 `schemas --json --store` through the actual selected-Root Kernel path and preserve its failure.
- [x] R2 Make archived validation a 1.9-only capability before Server or Web execution.
- [x] R3 Preserve typed static Schema failure evidence through list-only and detail access paths.
- [x] R4 Select Agent registry and command evidence from the running 1.8/1.9 CLI line.
- [x] R5 Rebuild, pack, isolated-install, and independently review the recovery branch distribution.

### Recovery closure record (2026-08-15 Asia/Shanghai)

All six gates closed on `fix/v9-cli-18-19-recovery` (planning commit `cc2c51a5`, production commits `3ad590eb`,
`c8f39156`, `79f47100`, `020e612c`, `e2d379f6`, `81237fa5`, `38a28c46`). Exact red/green commands, code decisions,
focused results, and baseline reproductions are recorded in `loop/implementation.md`. The two macOS baseline
failures (core `reactive-fs/path-realpath`, server `translation-cache-adapter` sqlite) were reproduced unchanged at
the branch parent `79c41a02` and stay baseline-only. Independent `code-review` of the recovery branch remains
available to the Owner and is not acceptance.

## 3. Existing candidate evidence

- [x] 3.1 The v9 admission classifier reports stable 1.8.x as supported non-current and 1.9.x as current.
- [x] 3.2 Planning completion and Apply progress candidate projections have focused executable evidence.
- [x] 3.3 The 1.8/1.9 executable fixture harness exists and may be extended by R1, R2, and R4.

These items are retained characterization evidence. They neither substitute for R0-R5 nor authorize release work.

## 4. Owner gates

- [x] 4.1 Browser/App walkthrough for 1.8.x and 1.9.x projects — performed 2026-08-15 by the
      implementation Agent with ego-browser at the Owner's explicit instruction; observed evidence and the
      two walkthrough-discovered fixes are recorded in `loop/implementation.md`. Recorded as evidence, not
      as the Owner's own acceptance; the Owner may re-walk at will.
- [ ] 4.2 Owner independently reviews the PR and authorizes merge, release, and Change archive.
