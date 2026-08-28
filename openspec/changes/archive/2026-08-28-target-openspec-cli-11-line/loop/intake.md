<!--
Orthogonal intents (created 2026-08-28 Asia/Shanghai):
1. Preserve the original request and version-line decision for OpenSpecUI 11.
2. Record the Owner-default decisions taken without an interactive answer, each vetoable in review.
3. State the planning-plus-delivery boundary for the implementation agents.

Original request (2026-08-28): "openspec v0.11.0 开始相关的适配工作。我们目前是 openspecui v9 适配 0.9.*，直接跳过 0.10.0，我们直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11"
-->

# OpenSpecUI 11 intake

## User Input

> openspec v0.11.0 开始相关的适配工作。
>
> 我们目前是 openspecui v9 适配 `0.9.*`，直接跳过 0.10.0，我们直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11
>
> （上游实际版本线为 1.9 -> 1.10.0 -> 1.11.0；`0.10/0.11` 按 `1.10/1.11` 执行，v11 发布遵循 v9 跳过 v8 的先例。）
>
> 1. 你先拉取代码，然后仔细审核变更，撰写 openspec change，中途有疑问可以问我。你的工作计划要符合多个子代理同步进行的设计。
> 2. 完成撰写后，再让 codex 来做 change reviewer。
> 3. 等敲定任务之后，你开始调用子代理推进所有工作。
> 4. 子代理持续返回，你负责初步的 review 和整合，持续分发推进，直到所有任务完成。
> 5. 调用 codex 进行 code review，围绕 openspec change 持续进行对齐，将新的任务继续分发给子代理。多轮迭代直到全部完成。
> 6. 收尾：清理 herdr、archive openspec changes、git commit+push、clear worktree；rebase main 时检查底层法则升级交集。

## Objective Scope

Ship OpenSpecUI 11 as one adaptation line for OpenSpec CLI 1.10.x and 1.11.x: pinned reference update,
research report, typed contracts, batch status transport, diff evidence, Agent delivery inventory, executable
fixtures, README/release preparation, and the Owner-only acceptance boundary.

```text
OpenSpec CLI 1.10.x ----\
                          +--> OpenSpecUI 11 contracts, projections, tests, release preparation
OpenSpec CLI 1.11.x ----/
```

## Owner-default decisions (vetoable in review)

The Owner was not interactively reachable during planning; these four scope decisions follow the recorded
recommendation and precedent. The Codex change review and the Owner may veto any of them before implementation
freezes.

1. **Version gate blocks 1.9.x and older.** Accepted range `>=1.10.0 <1.12.0`; 1.10.x supported non-current,
   1.11.x current/recommended; no 1.9 compatibility bridge (v9 treated 1.7 identically).
2. **`status --all` is adopted as the real loading transport** for admitted 1.11 sessions, capability-gated,
   preserving the `opsx-status-list` Work identity and per-change reactive dependencies; 1.10 keeps the
   per-change spawn path.
3. **`show --diff` reaches the UI**: typed contract plus Change Detail MODIFIED-delta diff/warning evidence.
4. **`init --language` is not exposed in the UI.** The persisted `context` block stays owned by the Active Root
   structured editor; the Initialize Project Alert keeps `--tools=none` as its exact official mutation.

## Non-Goals

- Do not create or publish an OpenSpecUI 10 line.
- Do not support OpenSpec CLI `<1.10.0`, prereleases, or `>=1.12.0`; no 1.9 compatibility bridge.
- Do not change production source code in the planning pass beyond what the ordered slices authorize.
- Do not expose an `init --language` UI input.
- Do not recompute requirement diffs locally or replicate archive/diff logic.
- Do not repair unrelated active/archive validation failures in this repository.
- Do not publish, merge, archive this Change, or claim final browser acceptance. Those remain Owner actions.

## Acceptance Boundary

The delivery is complete only when:

- `references/openspec` points at the verified v1.11.0 source baseline and
  `references/openspec-1.11.0-report.md` states the executed-evidence baseline;
- the Change artifacts and delta Specs pass targeted strict validation;
- every implementation task identifies its primary owner, precise red case, green case, and focused-review stop
  rule, ordered relative to dependent work;
- the Codex change review has been incorporated (and later the code-review loop closed);
- pinned 1.10.0/1.11.0 executable fixtures prove every newly accepted contract; and
- the final interactive walkthrough remains explicitly Owner-only.
