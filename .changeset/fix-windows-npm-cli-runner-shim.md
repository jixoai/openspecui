---
'@openspecui/core': patch
'@openspecui/server': patch
'@openspecui/web': patch
'openspecui': patch
---

Fix the Windows "No available OpenSpec CLI runner." failure with a global npm OpenSpec CLI (issue #258): resolve modern npm `cmd-shim` output (`SET dp0=%~dp0` + `"%dp0%\...\bin\openspec.js"`) onto `node.exe + entry` under hardened containment (real file inside the shim directory or its `node_modules/.bin` parent; drive-letter, UNC, NUL, and unexpanded-variable tokens rejected), mirror the same extraction in the release smoke/diagnostic scripts, pin the npx/bunx/deno/pnpm/yarn auto-fallback runners and the Settings global install action to the supported CLI series instead of an out-of-range `@latest`, and probe the global CLI through the spawn-safe boundary so resolved `.cmd` shims execute instead of failing EINVAL.
