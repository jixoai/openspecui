---
'openspecui': minor
'@openspecui/core': minor
---

Sync the App theme preference to embedded Workspace windows. The App is the single theme master: when its theme changes, every open Workspace iframe is force-synced via postMessage, new child windows inherit the theme on first load via postMessage, and child-side theme changes never echo back. The iframe URL stays stable so theme changes never reload the iframe. The App-pushed theme takes priority over backend config.theme so reconnection cannot revert it.
