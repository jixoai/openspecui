## User Input

<user>BUG，我切换 git worktree，然后页面就报错：

```
14:30:34.649 index-CmiApudF.js:31044 Subscription error: TRPCClientError: No "subscription"-procedure on path "notifications.subscribe"
14:30:34.802 index-CmiApudF.js:82767 Uncaught TypeError: Cannot read properties of undefined (reading 'systemNotificationsEnabled')
```

以上是控制台的报错，请分析原因</user>

<user>编写 openspec change 开始推进，为了以后开发新功能，出现类似的问题，要把 worktree 切换定为测试的 一个必做项。所以这次你要做好测试平台的封装。然后使用 BDD 进行驱动开发</user>

## Objective Scope

- Treat Git worktree handoff as a platform boundary that requires protocol/capability compatibility, not just `/api/health.projectDir` liveness.
- Prevent newer Web bundles from silently handoffing into older sibling worktree servers that lack required tRPC procedures such as `notifications.subscribe`.
- Make notification/config consumers degrade safely when optional runtime capabilities or config sections are unavailable during startup, handoff, static mode, or protocol mismatch.
- Add a reusable test platform for worktree handoff scenarios so future feature work can validate cross-worktree behavior without rebuilding ad hoc fixtures.
- Drive implementation with BDD: write failing behavior tests first, observe failure, then implement the minimum platform law and atom changes needed to pass.
- Update OpenSpec specs/checkpoints so worktree switching becomes a required verification item for future features that touch runtime protocols, subscriptions, config shape, server startup, or bundled CLI-served UI.

## Non-Goals

- Do not add a one-off `notifications.subscribe` special case in the handoff path.
- Do not hide all subscription errors globally; incompatible runtime protocols must be detectable and testable.
- Do not couple handoff compatibility to one feature name, one router path, or one specific worktree branch.
- Do not introduce a second local source of truth for feature capabilities in the Web UI when the backend runtime can advertise them.
- Do not redesign the Git page UI beyond changes needed to enforce and surface handoff compatibility.
- Do not require every small UI-only change to run a full multi-process browser handoff test; define the required scope precisely.

## Acceptance Boundary

- Given a sibling worktree server is healthy by project path but exposes an incompatible protocol/capability set, handoff readiness rejects it before navigation instead of loading a broken UI.
- Given a sibling worktree server exposes the required protocol/capabilities, handoff still succeeds and preserves the current route/search/hash.
- Given runtime config omits `notifications`, `NotificationProvider` renders with defaults and does not crash.
- Given `notifications.subscribe` is unavailable, the notification atom degrades to an empty notification list only when the runtime has already been classified as compatible enough for the current UI shell or test intentionally exercises legacy tolerance.
- Given future feature development changes server router capabilities, config schema, bundled CLI startup, or Web runtime subscriptions, the local verification checklist includes a worktree handoff scenario through the shared test harness.
- Given this change is implemented, focused BDD tests cover compatible handoff, incompatible handoff, stale dist/old-server simulation, notification config fallback, and route preservation.
