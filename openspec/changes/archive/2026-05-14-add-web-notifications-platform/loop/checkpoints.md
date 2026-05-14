## Checklist

- [x] 1. Add OpenSpec delta requirements for the notifications platform and terminal notification producer.
- [x] 2. Add shared core notification schemas, sound options, grouping helpers, and terminal output parser tests.
- [x] 3. Add server `NotificationService`, tRPC router, Local API endpoint, and PTY producer integration.
- [x] 4. Add frontend notification provider, subscription hook, action registry, sound engine, and browser notification bridge.
- [x] 5. Add NotificationsPanel PopArea route with grouping, grid-based list animations, clear/read controls, and disabled action states.
- [x] 6. Add status-bar bell entry, watcher popover behavior, and terminal tab unread indicator/focus cleanup.
- [x] 7. Add Settings notification controls and ToC navigation.
- [x] 8. Add focused tests for core/server/web behavior.
- [x] 9. Run scoped verification gates and record results.
- [x] 10. Fix macOS terminal arrow input compatibility and merge NotificationsPanel controls into the PopArea header.
- [x] 11. Preserve duplicate notification records for aggregate display, fix custom Select trigger sizing, and give NotificationsPanel SearchPanel-equivalent PopArea VT semantics.
- [x] 12. Split terminal BEL from web-notifications, add dedicated Bell Sound setting, and render TerminalTab primary ripple feedback.

## Verification

- `pnpm --filter @openspecui/core typecheck`
- `pnpm --filter @openspecui/server typecheck`
- `pnpm --filter @openspecui/web typecheck`
- `pnpm --dir packages/core exec vitest run src/notifications.test.ts src/config.test.ts`
- `pnpm --filter @openspecui/server test -- src/notification-service.test.ts src/pty-websocket.test.ts`
- `pnpm --dir packages/server exec vitest run src/pty-websocket.test.ts`
- `pnpm --dir packages/core exec vitest run src/notifications.test.ts`
- `pnpm --dir packages/web exec vitest run --project unit src/lib/terminal-controller.test.ts src/components/dialog.test.tsx`
- `pnpm --dir packages/web exec vitest run --project unit src/lib/terminal-controller.test.ts src/components/terminal/terminal-panel.test.tsx`
- `pnpm --filter @openspecui/web test -- src/lib/nav-controller.test.ts src/components/terminal/terminal-panel.test.tsx`
- `pnpm --dir packages/web exec vitest run --project unit src/lib/view-transitions/route-semantics.test.ts src/components/select.test.tsx src/components/notifications/notifications-panel.test.tsx`
- `pnpm --dir packages/web exec vitest run --project unit src/components/notifications/notifications-panel.test.tsx src/components/notifications/notification-toast.test.tsx src/lib/notifications/context.test.tsx src/lib/notifications/visibility.test.ts src/components/layout/mobile-header.test.tsx src/components/terminal/terminal-panel.test.tsx`
- Playwright QA at `http://localhost:13003/dashboard` injected two notifications for the same terminal session with `source.title` snapshots `zsh` then `Claude Code`; the NotificationsPanel group title rendered `Claude Code`, no `zsh` group heading remained, and clearing unread notifications removed the toast. Screenshots: `/tmp/openspecui-notifications-qa/toast-desktop.png`, `/tmp/openspecui-notifications-qa/panel-desktop.png`.
- Playwright PTY sampling at `http://127.0.0.1:13013/dashboard` confirmed plain arrows send `ESC [ A/B/C/D`, Option arrows send `ESC [1;3A/B` and `ESC b/f`, and Command arrows send Ctrl-A/Ctrl-E.
- Playwright layout sampling at `http://127.0.0.1:13013/dashboard` confirmed the Git auto-refresh Select trigger has `paddingTop=0px`, `paddingBottom=0px`, and its custom trigger wrapper fills the 28px button height.
- `pnpm exec playwright screenshot --viewport-size=1556,646 http://127.0.0.1:13013/notifications /tmp/openspecui-notifications-panel.png` from `packages/web`
- `pnpm format:check`
- `pnpm lint:ci`
- `git diff --check`
- `pnpm exec openspec validate add-web-notifications-platform --type change --strict`

Note: `pnpm --filter @openspecui/core test -- src/notifications.test.ts src/config.test.ts` did not scope to only those files and also ran the existing `src/reactive-fs/reactive-fs.test.ts`, where `reactiveExists() > should update when file is deleted` timed out. The focused direct Vitest command above passed.
