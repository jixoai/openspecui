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

- [ ] 4.1 Owner personally completes the browser/App walkthrough for 1.8.x and 1.9.x projects. The
      2026-08-15 implementation-Agent observation remains historical preparation evidence in
      `loop/implementation.md`; it is not Owner acceptance and cannot check this item. This gate is blocked
      until R7.1-R7.3 are independently accepted.
- [ ] 4.2 Owner independently reviews the PR and authorizes merge, release, and Change archive.

## 5. Post-R5 independent review repair

R6.1-R6.5 and R6.8 retain their accepted focused evidence. The independent review below revoked the R6.6,
R6.7, and R6.9 closure claims; R0-R5 historical evidence is not a substitute for those gates. An unchecked item
may move to `[x]` only after its exact red/green command and focused review are recorded in
`loop/implementation.md`.

- [x] R6.1 Bypass/unsupported versions do not select admitted capabilities or a versioned Agent registry.
- [x] R6.2 Retained Agent physical projections preserve the selected registry after reactive replacement.
- [x] R6.3 Explicit Agent Init tools are validated against `projection.registry` before the CLI stream starts.
- [x] R6.4 Every static Schema accessor propagates the same typed captured failure.
- [x] R6.5 Change List stops presenting tracked data as implementation progress; Detail always presents CLI Apply.
- [x] R6.6 Archived validation renders reports only after `CliValidateReportSchema.safeParse` succeeds, without
      an assertion-cast boundary.
- [x] R6.7 The complete v9 TypeScript/TSX inventory has current truthful intent headers or documented exceptions.
- [x] R6.8 Archived-validation Router fixtures use a typed `CliExecutor` spy without double assertions.
- [x] R6.9 R6 source, build, packed CLI, isolated install, diff hygiene, and independent review agree.

### Superseded R6 closure record (2026-08-15 Asia/Shanghai)

The implementation Agent recorded all nine gates closed on `fix/v9-cli-18-19-recovery` (planning `0a4bbb95`;
production `045f204b`,
`621abf7e`, `22880f8a`, `28fe06e7`, `7601a497`, `16149f97`, `de1ef34f`, `887382fb`, `c1655acb`).
That record is retained in `loop/implementation.md` as historical Agent evidence, but it is not an accepted R6
closure: the independent review found two assertion casts at the R6.6 boundary, an unaudited 44th-file inventory
member at R6.7, and 28 diff-hygiene violations that invalidate R6.9. The authoritative recovery order is now
R7.1-R7.3 in `loop/recovery-plan.md`.

## 6. Independent-review closure repair

All R7 items are blocked until their exact red/green evidence is appended to `loop/implementation.md`. R7.3 must
finish with a fresh independent review; no earlier review, build, pack, or browser observation can be reused after
an R7 source edit.

- [x] R7.1 Remove both archived-validation assertion casts while retaining typed report and transport diagnostics.
- [x] R7.2 Complete the dynamic v9 TypeScript/TSX header inventory and clear every change-introduced whitespace
      violation.
- [x] R7.3 Re-run focused/source/distribution gates and a fresh independent whole-change review after R7.1-R7.2.

### Independent-review correction record (2026-08-15 Asia/Shanghai)

Current evidence is `git diff 79c41a02...b5c64f7f`: `archived-validation-evidence.tsx` contains the two
prohibited assertion casts; the inventory contains 44 changed TypeScript/TSX files while the R6 record claims 42
and leaves `agent-integrations-router.test.ts` on its August 6 header; and
`git diff --check 79c41a02...b5c64f7f` reports 28 trailing-whitespace violations. The strict Change validation
passes, but it validates artifact structure rather than these source claims.
