---
'openspecui': patch
'@openspecui/core': patch
'@openspecui/server': patch
'@openspecui/web': patch
---

Rotate the pinned OpenSpec CLI fixture to 1.14.2 inside the unchanged v14 window (`>=1.14.0 <1.15.0`): the `openspec-cli-114` npm alias, every pin guard constant, and the reference submodule gitlink move to `v1.14.2` (`f80d860f`). The 1.14.2 patch facts join the executable proof matrix as pinned fixtures — a well-formed `x-` extension key in `.openspec.yaml` (`x-tracker`) no longer reports as an unknown key in Status/Instructions while a malformed `X-Foo` key keeps the advisory, which now carries the `x-` prefix hint (the verbatim warning strings in the web projection tests are re-captured from the 1.14.2 executable so the captured-from-pinned-CLI claim stays true); a schema artifact pattern nesting brace expansions deeper than 16 levels is rejected through the typed `change_error` envelope before the pattern reaches the braces parser; and delta text outside requirement blocks emits the advisory unapplied-content WARNING (item stays valid) in `validate --report findings`. No production code changes: status warnings and validate findings decode and render as verbatim strings by design, and the brace-depth guard lives entirely in the CLI's expansion step.
