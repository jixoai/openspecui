<!--
Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
1. Preserve the owner's no-retry-masking direction and the real-resource-topology law.
2. Bound the four evidence-backed failure families: worktree child readiness race, pending-runtime
   lifecycle leak, scripts-test process-topology concurrency, and smoke-root EBUSY cleanup.
3. Preserve the three owner-deferred decisions (ephemeral port contract, Windows process transport,
   skipped real-worker termination test timing).

Original request (2026-08-19): "我觉得这里有一些是可修复的，比如`EBUSY: resource busy or locked`，还有 `TRPCClientError: Timed out waiting for worktree server at http://localhost:3100` 这种错误，这种大概率是 vitest 并发测试，导致资源冲突。这方面可能需要更多的日志，或者封装好相关的资源使用策略，做好并发隔离，应该就可以解决。你和 herdr codex 开会讨论一下。先解决实际问题。然后再去做"门禁路径范围化（结构性减暴露）"。最后实在分析起来模糊两可的，你们再和我讨论一下，"任务内自动重试"这个方案属于浪费资源隐藏问题，尽量不做。"
-->

## User Input

> 我觉得这里有一些是可修复的，比如`EBUSY: resource busy or locked`，还有 `TRPCClientError: Timed out waiting for worktree server at http://localhost:3100` 这种错误，这种大概率是 vitest 并发测试，导致资源冲突。这方面可能需要更多的日志，或者封装好相关的资源使用策略，做好并发隔离，应该就可以解决。

## Joint ZCode + Codex root-cause findings (2026-08-19, evidence in research-plan)

1. Worktree child readiness failure is a real probe-then-bind race plus wrong-endpoint registration,
   with a deterministic pending-runtime leak window that escapes `close()`.
2. `enableWatcher: false` from the parent never reaches the child worker contract, widening the
   watcher/file-lock resource topology.
3. The supervisor-test failures are root-level scripts tests running process-topology probes
   concurrently against WMI with zero isolation.
4. The smoke EBUSY is the owned-root deletion; the guard passed, and no lock-holder evidence exists
   in current logs.

Owner-deferred decisions (do not decide inside this Change): ephemeral port vs predictable 3100+
contract for worktree children; switching the Windows worktree runtime to process transport;
restoring the skipped real-worker termination test as mandatory.
