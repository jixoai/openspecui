---
'openspecui': patch
---

Fix SSG export package resolution by dynamically reading `@openspecui/web` from nearest `package.json` and treating local package protocols (`workspace:`, `file:`, `link:`) as local/dev mode.
