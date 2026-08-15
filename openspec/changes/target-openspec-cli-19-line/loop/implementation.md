<!--
Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
1. Record only accepted v9 implementation evidence and recovery results.
2. Separate candidate source state from focused-review completion.
3. Preserve loopback and Owner-only acceptance boundaries for the next Agent.

Original request (2026-08-15): "这里面很大的问题也是因为你作为架构师，openspec change 文件撰写不够清晰，导致Agent 没有如期完成所有开发，请你改进 change 文件，改进开发计划。"
-->

# OpenSpecUI 9 implementation record

## Current state

```text
Change artifacts      corrected and planning-valid
Candidate source      local main at 79c41a02; review-rejected for R0-R5
Implementation branch required before edits
Release/PR/archive    not authorized
Owner browser/App     pending and Owner-only
```

`loop/recovery-plan.md` is the execution authority. Do not restore the former “complete through slices 1-7” claim:
source changes exist for parts of those slices, but the following reviewed obligations remain unaccepted.

| Reopened scope | Why prior evidence is insufficient | Required record before closure |
| --- | --- | --- |
| R0 standards | `workflow.ts` exceeds the intent limit and a changed test lacks the required header | Physical split/header plus focused Core/Web verification |
| R1 schemas | the Kernel does not forward its selected Root to `schemas()` | 1.9 real selected-Root failure and 1.8 no-selector evidence |
| R2 archived validation | supported 1.8 sessions can invoke a 1.9-only flag | pre-execution typed unavailable result and 1.9 success/failure evidence |
| R3 static schemas | failure capture is lossy and list-only access returns `[]` | complete captured evidence and failure propagation through every static read |
| R4 Agent delivery | fixed 1.9 inventory causes an absent 1.8 adapter to erase the catalog | executable-backed 1.8/1.9 inventories and isolated missing-adapter evidence |
| R5 distribution | package evidence predates the required corrections | recovery-branch build, pack, install, and review results |

## Evidence recording rule

For each R0-R5 gate, append one entry only after the named green case passes:

```text
Gate:
Feature branch and commit:
Primary production owner:
True red case and command:
Code decision:
Green case and command:
Focused review result:
Files changed:
Residual risk or stop-condition check:
```

Do not record a mock-only payload as proof of a CLI-specific production path. Do not run R5 to compensate for a
failed focused gate. A test failure may be accepted as baseline-only only after it is reproduced unchanged against the
recovery branch parent and recorded with its exact command and error.

## Preserved candidate facts

- `references/openspec` is pinned to OpenSpec v1.9.0 at `2826b8889e5223a9a8095d4428b60b56597e1020`.
- Existing 1.8/1.9 executable workflow fixtures establish planning completion and Apply-progress behavior, but must
  be extended where R1, R2, and R4 require product-path proof.
- `pnpm test:ci` currently stops on the unchanged macOS `reactive-fs/path-realpath` canonical-path assertion
  (`/private/var` versus `/var`). It is not v9 evidence unless reproduced unchanged as R5 requires.

## Loopback triggers

- The official 1.8 or 1.9 executable contradicts a command, payload, selector, or Agent-inventory assumption in a
  delta Spec.
- A fix requires a second production owner not named in the relevant recovery gate.
- A static capture cannot carry the complete typed command evidence without widening the public projection contract.
- A focused gate fails, a new global-root mutation is introduced, or source/distribution output diverges.
- The request broadens support beyond stable `>=1.8.0 <1.10.0` or asks for PR, merge, publish, release, archive, or
  Owner acceptance.

When a trigger occurs, stop implementation, amend `loop/research-plan.md`, the affected delta Spec, and
`loop/recovery-plan.md`, then wait for approval before continuing.
