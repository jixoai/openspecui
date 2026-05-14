## User Input

The manager wants OpenSpecUI to implement GitHub issue #100, "Support for browser notifications when a terminal bell is fired", as a durable web-notifications platform rather than a terminal-only patch.

- Render web-notifications in TopLayer/PopArea, with a bell entry in the bottom status bar near `Watching for changes`.
- Move the old `Watching for changes` explanatory text behind a hover popover on `Live`.
- Subscribe to backend notifications and render structured messages with typed actions that can navigate or focus the relevant frontend surface.
- Trigger browser-notifications as a single rolling native `Notification`; clicking it should call `window.focus()`, open the NotificationsPanel, and highlight the relevant target.
- Treat browser-notifications only as an optional native outlet; web-notifications are the reliable platform capability.
- Store notification state in backend memory, not frontend storage, so read/delete operations synchronize across clients.
- Support clear-all, group delete, smooth list insertion/removal animations, and grouped notifications by typed metadata.
- Keep web-notifications focused on OSC 9 / OSC 777 style notifications; terminal bell remains a terminal-local cue rather than a web-notification producer.
- Add Settings controls for notification sound and system notification enablement.
- Add ToC navigation to Settings as the page grows.
- Handle browser audio autoplay by unlocking audio from the first user gesture.
- Disable notification jump actions when the target instance has already disappeared.

## User Input Update

The manager later narrowed terminal bell semantics:

- Do not create web-notifications for terminal bell anymore.
- Add a dedicated terminal bell sound setting, separate from `Notification Sound`, defaulting to a bell sound.
- When a terminal bell fires, play the configured bell sound and render a primary-color ripple on the TerminalTab status indicator.

## Objective Scope

- Add a platform-level notification protocol, backend memory service, subscriptions, actions, grouping, and local publish API.
- Add PTY output parsing for terminal bell and OSC terminal notification sequences.
- Add web UI surfaces for notification entry, panel, grouping, removal animation, native notification bridge, sound settings, and terminal action focusing.
- Keep producers and consumers orthogonal: OSC terminal notifications, future OpenSpecChange, and future HooksPlugin producers publish through the same notification law; terminal bell remains a terminal-local cue.

## Non-Goals

- Do not implement Service Worker notifications in this change.
- Do not persist notifications to project files or frontend storage.
- Do not create page-local terminal notification state as a second source of truth.
- Do not publish terminal bell as a web-notification.
- Do not introduce a generic plugin bus.
- Do not copy closed or unclearly licensed operating-system sound assets.

## Acceptance Boundary

- Supported OSC notification sequences create backend notifications and all connected web clients receive them.
- A PTY bell creates only a terminal-local bell cue: configured sound plus TerminalTab primary-color ripple.
- The status-bar bell displays unread count and opens the NotificationsPanel.
- The NotificationsPanel groups notifications, expands groups, deletes single notifications/groups/all notifications with grid-based animation, and disables unavailable actions.
- Clicking a terminal notification focuses the relevant terminal tab and burns the notification.
- The rolling browser notification is updated for new web-notifications, suppressed while the panel is open, and opens the panel after calling `window.focus()`.
- Settings exposes system notification permission and notification sound controls.
- Static mode degrades without live notifications.
