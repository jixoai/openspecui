---
'openspecui': patch
'@openspecui/core': patch
'@openspecui/server': patch
'@openspecui/web': patch
---

Fix hosted app refresh and update reliability across deployed builds.

- register the hosted app service worker as a module so versioned iframe routes stay on the correct channel shell after refresh
- distinguish deployed app manifests and prewarm new hosted caches before prompting for reload
- improve hosted app shell refresh/loading behavior and align website entry copy for the app mode
