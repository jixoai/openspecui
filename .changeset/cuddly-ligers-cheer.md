---
'@openspecui/core': patch
'@openspecui/server': patch
'@openspecui/web': patch
'openspecui': patch
---

Fix Windows CLI runner resolution failing with ENOENT on npm-global extension-less shims.

On Windows, `where openspec` returns the npm-global extension-less Unix shim first, but Node
`spawn({ shell: false })` cannot execute it, so every CLI probe failed with `ENOENT` and
OpenSpecUI could not start (#209). Replace `node:child_process` `spawn` with `cross-spawn`, which
resolves `PATHEXT` (`openspec.cmd`) while keeping `shell:false` and the existing security model.
Also prefer the `PATHEXT`-matching entry in `where` output so the resolved path is the real
executable. Fixes #209.
