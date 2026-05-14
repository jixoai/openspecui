## Research Findings

- The current terminal transport is a dedicated `/ws/pty` WebSocket. Platform notifications should not be hidden inside the PTY protocol; OSC terminal notification sequences should be producers of a shared `NotificationService`, while BEL remains a terminal-local cue.
- The web app already has a PopArea route system used by Search. Notifications should join this system as `/notifications` instead of creating an unrelated overlay mechanism.
- The status bar currently renders `Live` and `Watching for changes` separately. This is the right location for the notification bell entry and a hover popover for watcher details.
- The terminal controller already has a central snapshot store and `focusSession(id)`, so terminal actions can be implemented as a frontend action resolver without coupling NotificationService to TerminalPanel internals.
- Browser native notifications support permission-gated `Notification`, `onclick`, and `tag`; the app should still close/recreate the single rolling native notification to avoid depending only on `tag` compatibility.
- Browser custom notification sounds are not a standard `Notification` capability. Notification sound must be played by the web app.
- The provided `.chat/grid-list-animation.html` demonstrates the intended list animation law: outer grid row transition, middle clipping wrapper, inner content with padding/border/opacity/transform.

## Decision & Plan

Implement one notification platform law:

1. Add shared core notification schemas and helpers under `@openspecui/core/notifications`.
2. Add a server `NotificationService` with memory state, EventEmitter subscription, mark-read clear semantics, grouped publish support, and local API publishing.
3. Wire PTY sessions through a stateful terminal notification parser that detects plain bell, OSC 9, and OSC 777 notification sequences without corrupting terminal output.
4. Add a tRPC `notifications` router for list/subscribe/publish/read/clear operations.
5. Add a PopArea `/notifications` route, status-bar bell entry, provider, action registry, browser notification bridge, sound engine, and settings UI.
6. Use backend state as the only notification truth; frontend state is a mirror of the subscription payload.
7. Use typed frontend action resolvers for availability and execution. Terminal focus is the first resolver.
8. Route BEL through a typed PTY bell event for local terminal sound and tab status ripple instead of publishing it as a web-notification.

## Risks and Mitigations

- Risk: The notification platform becomes a second router/navigation system.
  Mitigation: Notification actions resolve to existing `navController` and `terminalController` behavior through typed resolvers.
- Risk: PTY parser incorrectly strips terminal output.
  Mitigation: Parser extracts control sequences but preserves printable output; tests cover split chunks and plain bell.
- Risk: Local publish API becomes an unsafe public remote endpoint.
  Mitigation: Keep it loopback/server-local by deployment context and validate with the same strict Zod schema as tRPC.
- Risk: Browser notification permissions create noisy UX.
  Mitigation: Only request permission from explicit Settings action and expose current permission state.
- Risk: Settings becomes too long.
  Mitigation: Add Settings ToC using existing `Toc`/`TocSection` primitives instead of a new navigation widget.

## Verification Strategy

- Unit-test notification schema/group helpers and terminal parser.
- Unit-test server `NotificationService` publish/read/clear/subscribe.
- Unit-test or component-test notification provider/panel action availability and terminal controller integration.
- Unit-test that BEL emits terminal-local feedback without publishing a notification.
- Component-test Settings notification controls where practical.
- Run scoped package tests plus typecheck for touched packages.
