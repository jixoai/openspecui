---
'@openspecui/web': patch
---

Walkthrough UX fixes for the 1.13.1 acceptance instance: Board and Dashboard compact Kanban cards (and the Apply/Archive launchers) no longer show the generic scaffold heading "Proposal" — every Kanban surface now applies the shared change-display-title fallback; Search result cards for change/archive hits do the same; and the markdown reading view renders task lines with the CLI 1.13.1 widened semantics (single-token/padded/whitespace-only checkbox markers under any list marker, indented sub-tasks) so the Change Detail tasks view shows exactly the checkboxes the CLI counts, with multi-token labels and link bullets staying plain text.
