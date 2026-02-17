---
'openspecui': patch
'@openspecui/core': patch
'@openspecui/server': patch
'@openspecui/web': patch
---

Improve CLI configuration initialization and developer workflow stability.

- Fix config persistence bootstrap by creating `openspec/` before writing `.openspecui.json`, so missing project config paths are no longer misreported as CLI-unavailable errors.
- Improve dev workflow with a Bun/OpenTUI multi-tab `pnpm dev` experience and terminal rendering pipeline upgrades for PTY-style output, color-preserving display, and more reliable task lifecycle handling.
- Fix Windows PTY startup defaults by resolving shell command from `ComSpec` (fallback to `cmd.exe`) instead of unix-only `/bin/sh`, and return structured `PTY_CREATE_FAILED` errors when PTY session creation fails.
