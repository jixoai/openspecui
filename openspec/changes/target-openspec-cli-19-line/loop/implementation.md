<!--
Orthogonal intents (created 2026-08-15 Asia/Shanghai):
1. Define the implementation handoff and evidence-recording format for OpenSpecUI 9.
2. Prevent planning artifacts from being misreported as production implementation.
3. Record hard loopback conditions for future implementation agents.

Original request (2026-08-15): "我会让其它Agent来开发，不是你负责。"
-->

# OpenSpecUI 9 implementation handoff

## Implementation State

```text
Planning author      complete planning only
Production code      not started
Release              not authorized
Final browser walk   Owner-only, pending
```

Implementation starts from the approved order in `loop/research-plan.md`. Each slice must first add or demonstrate
its named red case, then change one primary owner, then pass its named green case and focused review. Do not begin
the next slice after a failed focused review.

## Decisions Taken

```text
OpenSpecUI 9 compatibility
  accepted:    >=1.8.0 <1.10.0
  recommended: >=1.9.0 <1.10.0

Status                         Apply instructions
isPlanningComplete             progress.total/complete/remaining
planning readiness             implementation task truth

OpenSpecUI observes and projects CLI results.
The OpenSpec CLI owns archive mutation, retirement, and Agent artifact mutation.
```

The Change contains delta Specs for `openspec-cli-integration`, `opsx-workflow-ui`, `opsx-config-center`, and
`projection-contract-truth`. Any implementation that changes this contract needs an explicit loopback before code
is written.

## Evidence Record Format

For every completed slice, append a short entry here:

```text
Slice:
Primary owner:
Red case and command:
Green case and command:
Focused review result:
Files changed:
Residual risk:
```

Record fixture versions exactly. A test named after 1.9 that uses a hand-written payload is not sufficient evidence
for 1.8/1.9 support unless a separate test proves that payload against each pinned executable.

## Divergence Notes

None at planning completion. No production source code was changed while creating this Change.

## Loopback Triggers

- A v1.8 and v1.9 executable produce incompatible JSON for a supported command.
- A required upstream behavior lacks one objective UI/Server owner.
- Supporting the schema failure envelope requires a public wire-contract change outside the listed delta Specs.
- Agent global-root observation cannot be represented without broad filesystem access or unsafe deletion scope.
- Archive behavior requires reimplementing or simulating a CLI destructive action.
- Focused evidence fails, or a distribution gate exposes source/dist divergence.
- Any request broadens the version range beyond `<1.10.0` or asks for publish, merge, archive, or Owner acceptance.
