## Implementation State

Implemented the notifications platform across core, server, and web:

- Core added `@openspecui/core/notifications` with notification schemas, grouping helpers, settings schema, sound options, and compatibility exports for terminal notification parsing.
- Core added `@openspecui/core/terminal-control` as the terminal control semantic layer for BEL, OSC 9 / 777 notification intents, OSC 9;4 progress, OSC 0/1/2 title, OSC 7 / 9;9 / 633 / 1337 current directory, and OSC 133 / 633 prompt state.
- Core added `@openspecui/core/terminal-audio` with a separate terminal bell sound schema and default `bell` preset.
- Server added `NotificationService` as the backend memory authority, a tRPC `notifications` router, `/api/notifications`, and PTY producer integration.
- PTY notification producer stores terminal display title as backend-owned parsed state. OSC title targets remain inside the PTY session, the resolved display title follows `OSC title || process.title || command`, and new notification records use that resolved title at publish time.
- Web added `NotificationProvider`, notification subscription hook, action resolver, sound engine, rolling `window.Notification` bridge, `/notifications` PopArea panel, status-bar bell, terminal unread indicators, Settings notification controls, and Settings ToC.
- Follow-up fixes merged NotificationsPanel controls into the PopArea header, added core-level duplicate notification aggregation, normalized macOS plain / Option / Command arrow input before it reaches the PTY, fixed custom Select trigger sizing for Git auto-refresh controls, and assigned NotificationsPanel the same PopArea view-transition semantics as SearchPanel.
- Terminal bell was split out of web-notifications: PTY BEL now emits a typed `bell` server message, plays the configured terminal bell sound, and renders a primary-color ripple on the TerminalTab status indicator without creating unread notifications.
- OpenSpec deltas and checkpoints are synchronized with the implementation.

## Decisions Taken

- Backend memory is the only notification authority; frontend state is a subscription mirror.
- Browser notifications are window-scoped and represented as one rolling native notification.
- The server preserves every notification event as the backend authority; grouping and duplicate counting are view-model aggregation laws in core/web.
- Notification actions are typed data and resolved in the frontend against existing controllers.
- OSC sequences are notification producers. Terminal bell is a terminal-local cue and SHALL NOT publish through the shared notification service.
- Terminal keyboard compatibility is owned by the terminal controller as an input normalization law, not by the notification producer.
- PTY foreground process title and resolved display title are separate protocol messages. The backend owns `OSC title || process.title || command`; the frontend only applies an optional user custom title over the backend-resolved display title.
- Settings uses existing `Toc` / `TocSection` primitives instead of a second navigation component.
- Sound uses bundled sound files from `packages/web/public/sounds`, first-gesture unlock, silent mode, and per-project sound settings.

## Divergence Notes

- The initial plan allowed bundled notification sound assets if available. Implementation uses the provided project sound assets under `packages/web/public/sounds`.
- The initial implementation adapted BEL as a fallback notification. The updated manager decision makes BEL terminal-local only because ordinary shell editing can emit frequent bells that are not notification intents.
- The verification strategy suggested web component tests where practical. This pass added focused core/server/web tests plus package typechecks and a Playwright screenshot smoke check of `/notifications`.

## Loopback Triggers

- None.
