---
'@openspecui/web': patch
---

Remove the Stores panel Refresh button. The panel already auto-updates via the
server-pushed subscription, so the manual control was redundant (and its
refresh-key re-mount was unnecessary complexity).
