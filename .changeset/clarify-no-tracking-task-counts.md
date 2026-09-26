---
'@openspecui/web': patch
---

Clarify no-tracking task counts after the Owner walkthrough of the 1.13.2 rotation: the Change Detail apply badge keeps the CLI-owned 0/0 numbers while lowering visual weight and appending the "schema tracks no tasks" qualification to its accessible name and tooltip (strictly on `taskTrackingConfigured === false`, never for absent members), and Changes rows with the CLI `no-tasks` status and zero totals render a muted "No tasks" whose tooltip keeps the upstream ambiguity (unconfigured `apply.tracks` vs an empty tracked list) instead of a bare `Tasks 0/0`. Board cards intentionally stay unchanged.
