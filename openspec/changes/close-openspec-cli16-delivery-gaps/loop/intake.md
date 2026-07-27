<!--
Orthogonal intents (updated 2026-07-26 Asia/Shanghai):
1. Capture the independent review's confirmed OpenSpec 1.6 delivery gaps.
2. Freeze the old adaptation Change as traceable source material while this Change closes its migrated obligations.
3. Separate implementation proof, loading-change regression ownership, and owner-only browser walkthroughs.
4. Define the neutral multi-environment projection and CLI-backed reactive Work upgrade required before walkthrough resumes.

Original request (2026-07-23): "走查任务直接到新的change中做。你目前的工作就是：review + interview + replan(write new openspec change)"
Original request (2026-07-20): "以后任何需要最终端到端的浏览器走查，就交给我来做。你最多负责到最基础的vitest+playwright的相关组件化的测试。"
Original request (2026-07-26): "这个任务很重要 请你更新 change，展开全面的接口升级和内核升级和测试升级，等全部完成之后，我再来继续做验收"
-->

## User Input

> 建议 review 后，关闭当前的 change，将所有问题在一个新开的 change 中展开，这样上下文更干净。
>
> 走查任务直接到新的 change 中做。你目前的工作就是：review + interview + replan(write new openspec change)。
>
> 对我进行采访提问的时候，我们需要高效一点，对于一般的共识没必要提问（你知道我的哲学）。
>
> 以后任何需要最终端到端的浏览器走查，就交给我来做。你最多负责到最基础的 vitest+playwright 的相关组件化的测试。
>
> 最终计算结果本质是来自于 OpenSpec CLI 所提供的内容。即便现在有正在的任务，界面上仍然可以读到缓存，但它也能知道这个缓存现在正在被更新中。这是一套通用的数据拉取推送技术。

The independent review baseline is `24c313c...HEAD` on `feat/openspec-cli-16-contract-baseline`.
The reviewed old Change `target-openspec-cli-16-line` was at `109/131`; independent correction reopens
three overstated claims, leaving an honest `106/131` and 25 unchecked entries. Those obligations
remain real obligations. Current PR #207 checks predate the reviewed range and are not evidence for it.

## Objective Scope

Close the confirmed correctness, security, protocol, App-projection, static-provenance, test-evidence,
and delivery-gate gaps required before the OpenSpec CLI 1.6 adaptation can be accepted.

```text
backend host + effective data home
                |
                v
     opaque, stable envUri --------------+
                |                        |
                v                        v
Access Gate -> authenticated HTTP / WS   App: explicit selected environment
                |                        |
                +--> mutation accepted -> running -> terminal
                           |                         |
                           +--> invalidation ---------+--> current pull / truthful UI
```

The Change owns the following fixed points:

- one backend-issued, opaque `envUri` for the same backend host and effective data home, reused by
  health, Store mutations, and App grouping;
- Access Gate enforcement on every advertised HTTP and WebSocket surface, with credential-scoped
  reachability that never calls a reachable protected backend "offline";
- App selection and observation of connected environments without silently redirecting a Store operation
  to the first online backend;
- Store mutation transport whose observable lifecycle is truly `accepted -> running -> terminal`, where
  `indeterminate` means an unrecoverable post-start terminal loss rather than any rejected request;
- typed decoding of untrusted hosted responses, static no-live-evidence provenance, reactive file-write
  settlement, checked test fixtures, source headers, and passing delivery gates;
- one owner-per-fixed-point implementation sequence and a final manual walkthrough ledger owned by the
  manager.
- one general CLI-backed reactive Work contract: official-source-audited physical evidence establishes
  dynamic invalidation dependencies; only settled typed CLI results enter the projection cache; Push
  carries invalidation/lifecycle and clients Pull replacement data while retained cache remains visible.

`target-openspec-cli-16-line` remains frozen until its 25 unchecked items are mapped by proof or explicit
transfer. With manager confirmation it may then be archived as an honestly partial/superseded record;
unchecked items and warnings remain unchanged and the archive is not a completion claim.
`accelerate-live-projection-loading` / `refine-live-projection-experience` remain separate work:
their known server emission regression is a hard delivery blocker but is not silently folded into this
Change's implementation scope.

## Non-Goals

- Do not alter the established Project Web root/Store/Reference workflow semantics, add an account or
  permission system, expose Store Git clone/pull/push/synchronization, or scan arbitrary filesystems.
- Do not invent a second App data store, construct `envUri` in the App, infer health from URL strings, or
  treat a failed authentication request as a completed Store mutation.
- Do not absorb the independent visual loading-language redesign or pending Kanban layout work. The
  CLI-backed reactive interface/kernel/test upgrade is now explicitly in scope because it is a correctness
  prerequisite for Store, Root, Context, and Environment acceptance rather than a cosmetic optimization.
- Do not claim user-facing desktop, mobile, multi-tab, static, WebSocket, or mutation walkthrough
  acceptance from Vitest, component Playwright, Storybook, source inspection, or CI alone.
- Do not archive the old Change before its transfer ledger and manager confirmation; do not merge the
  branch, release packages, or mark an unchecked old task complete merely because a replacement exists.

## Acceptance Boundary

This Change is implementation-ready only when its plan supplies one production owner, one public-boundary
red case, one green case, and mutation-resistance evidence for every implementation package.

It is implementation-complete only when all of the following are true:

- the confirmed review defects are fixed with checked tests at their real HTTP/WS/RPC/UI owners;
- `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`,
  `pnpm test:browser:ci`, and fresh static SSG checks pass on the candidate;
- the loading-change regression is independently repaired and no longer blocks those gates;
- every migrated CLI-backed projection exposes the no-data/data-present lifecycle, retains settled cache
  during revalidation, derives replacement truth only from the CLI, and has no healthy-path polling owner;
- the manager records the final real-browser walkthroughs in this Change; and
- the old Change's migrated entries are reconciled honestly and may use the documented partial archive;
  this corrective Change still follows complete verify/archive and protected-branch delivery rules.
