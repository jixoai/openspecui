---
'@openspecui/web': minor
---

Complete the three ownership-specific Config surfaces.

- Keep Project Binding limited to launch-project Store and Reference declarations, with pending locks and dirty-draft retention after failures.
- Make Active Root Config use explicit file presence so an existing empty config remains editable, while preserving Planning-root provenance and static read-only behavior.
- Keep Environment Global Config environment-scoped, preserve unknown JSON fields and raw CLI evidence, and run Update only through the dedicated typed Planning-root transport.
