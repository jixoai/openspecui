---
"openspecui": patch
"@openspecui/core": patch
"@openspecui/server": patch
"@openspecui/web": patch
"@openspecui/website": patch
---

Re-release the 4.x line as 4.0.1.

`4.0.0` is permanently blocked on npm: it was published then unpublished on
2026-05-22 for `@openspecui/core`, `@openspecui/search`, and `openspecui`, and
npm forbids re-using a published-then-unpublished version. The fixed group moves
together, so the first installable 4.x release is `4.0.1`. No code changes beyond
the 4.0.0 CLI-1.4 line bump.
