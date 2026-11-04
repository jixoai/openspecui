<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. Keep implementation reality synchronized with the plan.
2. Record the probe as the evidence that shaped the design, including what it disproved.

Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
-->

## Implementation Log

### 2026-11-04 — Planning

- Intake, research plan, checkpoints, and the `reactive-file-system` delta written.
- Probe executed on macOS (`/tmp/watcher-probe/probe.mjs`, kept as evidence): create-while-subscribed
  is delivered and diffed; create-while-dead is **invisible to `getEventsSince` (`[]`)**; the same
  diff after re-subscribing reports it. Design consequence: the query API is a detector; re-arm plus
  re-read is the recovery primitive.
- Rejected before implementation, with reasons: per-directory polling (violates the fanout law and
  re-reads only what we choose); bind-time resync inside the watcher pool (unprovable from a macOS
  probe and it changes the pool's callback contract — two pool tests encode "acquire does not
  notify"); swapping to chokidar/watchman (out of scope; watchman is not installed on CI and adding a
  daemon is a distribution decision).

No production code yet.
