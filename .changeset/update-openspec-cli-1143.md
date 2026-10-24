---
'openspecui': patch
'@openspecui/core': patch
'@openspecui/server': patch
'@openspecui/web': patch
---

Rotate the pinned OpenSpec CLI fixture to 1.14.3 inside the unchanged v14 window (`>=1.14.0 <1.15.0`): the `openspec-cli-114` npm alias, every pin guard constant, and the reference submodule gitlink move to `v1.14.3` (`c794978f`). Zero production changes — the full executable proof matrix (brace depth, `x-` extension keys, unapplied-content findings, workflow contracts, boundary negatives, cold-start root context) is re-verified green against the 1.14.3 binary with no assertion relaxations. Upstream swapped the artifact-glob engine from `fast-glob` to `tinyglobby` (dropping the `braces` dependency), but the 16-level `assertBraceNesting` depth guard is retained and a new 1024-expansion budget guard is added — both live in the CLI's expansion step that OpenSpecUI never performs, so the recognition mirrors and fixtures keep their exact semantics (recorded as evidence-layer provenance, not behavior). The fixed-group changeset propagates this patch bump to the whole release group (search/translators move with it, per `.changeset/config.json`).
