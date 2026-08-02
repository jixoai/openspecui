---
'openspecui': minor
'@openspecui/core': minor
---

Sync the App theme preference to embedded Workspace windows. The App is the single theme master: when its theme changes, every open Workspace iframe is force-synced via postMessage, new child windows inherit the theme via the launch URL, and child-side theme changes never echo back. The App-pushed theme takes priority over backend config.theme so reconnection cannot revert it.
