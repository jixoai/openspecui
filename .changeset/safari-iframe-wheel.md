---
'@openspecui/web': patch
---

Hide inactive Tabs panels with `display:none` instead of `opacity:0` so Safari/WebKit stops routing mouse-wheel events to the topmost-painted iframe. In App mode only the newest Workspace tab scrolled; now every tab scrolls and React keeps each iframe's connection and state alive across the show/hide toggle.
