---
'openspecui': patch
'@openspecui/core': patch
'@openspecui/server': patch
'@openspecui/web': patch
---

Rotate the pinned OpenSpec CLI fixture to 1.14.1 inside the unchanged v14 window (`>=1.14.0 <1.15.0`): every pin guard (reference prepare script, contract regression, cold-start integration, web playwright probe) and the `openspec-cli-114` npm alias move to `v1.14.1` (`87c3595`), which also repairs the submodule gitlink that the 2026-10-02 release commit accidentally reverted to v1.13.0. The 1.14.1 patch facts join the executable proof matrix as two new pinned fixtures — apply `all_done` now reports tracked-task completion and asks for review before archiving (the retired `ready to be archived` phrasing never appears in the payload), and an overlength (>500 characters) requirement description, including ADDED requirements in a change, is a strict-failing WARNING. No production schema or projection changes: the new archive diagnostic code `archive_retirement_cleanup_failed` passes through the existing open-string diagnostic typing as verbatim evidence.
