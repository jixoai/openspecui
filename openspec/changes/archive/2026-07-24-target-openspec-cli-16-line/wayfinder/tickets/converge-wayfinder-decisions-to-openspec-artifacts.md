<!--
Orthogonal intents (created 2026-07-15 Asia/Shanghai):
1. Convert the closed Wayfinder decision set into implementation-ready OpenSpec artifacts.

Original request (2026-07-14): "我们最终使用openspec来管理 wayfinder 产出的文档。"
-->

# Converge Wayfinder decisions into OpenSpec artifacts

Status: closed
Type: task

## Question

Create the declared `opsx-collab-pr-loop` artifacts (`intake`, `research-plan`, `implementation`, and `checkpoints`) under this change's `loop/` directory so every closed Wayfinder decision has one formal implementation contract, no unresolved architecture choice remains, and the resulting change is ready for implementation without making `wayfinder/` a second source of truth.

## Resolution

The Wayfinder decisions have converged into the CLI-declared formal artifacts:

- [`loop/intake.md`](../../loop/intake.md) preserves original input, objective scope, non-goals, and acceptance boundaries.
- [`loop/research-plan.md`](../../loop/research-plan.md) records verified facts, approved architecture, phased execution, risks, and verification.
- [`loop/implementation.md`](../../loop/implementation.md) truthfully records that code work has not started, fixes implementation constraints, and defines loopback triggers.
- [`loop/checkpoints.md`](../../loop/checkpoints.md) is the tracked implementation ledger.

`openspec status --change target-openspec-cli-16-line` reports all four artifacts complete. `openspec instructions apply --change target-openspec-cli-16-line --json` reports the change ready with 130 tracked checkpoints: 7 completed research/planning facts and 123 unstarted implementation/delivery tasks.

The actual schema is `opsx-collab-pr-loop`, not the conventional proposal/design/specs/tasks artifact set. From this point, `loop/` is the implementation source of truth; `wayfinder/` remains decision provenance and is not edited as a parallel plan.
