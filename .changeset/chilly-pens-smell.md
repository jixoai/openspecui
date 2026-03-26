---
'@openspecui/web': patch
---

Improve Git detail panel ergonomics and scrollbar styling in Safari.

- Keep the updated wide-mode file tree viewport spacing from local UI tweaks.
- Make `scrollbar-track-transparent` render with an actually transparent track in Safari via `::-webkit-scrollbar*` rules.
- Keep the workspace toolchain on Vite v8 by removing remaining Vitest v2 chains from workspace packages.
