---
'openspecui': patch
'@openspecui/web': patch
---

Fix the shared tabs chrome so the default underline indicator stays within the tab strip, restore the terminal tab active state so it visually joins the terminal content, and correct tab view-transition direction handling. Document the preferred local workflow of running `pnpm dev` first and using `pnpm openspecui` only to verify bundled CLI-served behavior.
