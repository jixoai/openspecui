---
'@openspecui/web': patch
'openspecui': patch
---

Align dev dist output behavior and publish CLI patch alongside the web package update.

- Update `@openspecui/web` `dev:dist` to use `--emptyOutDir true` in watch mode.
- Publish a matching `openspecui` patch release so CLI consumers pick up the latest bundled web assets.
