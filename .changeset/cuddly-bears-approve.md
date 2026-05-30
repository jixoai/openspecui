---
'openspecui': patch
'@openspecui/core': patch
'@openspecui/server': patch
'@openspecui/web': patch
---

Fix translation reliability around managed local engines and markdown rendering.

- preserve translation config writes without overwriting sibling defaults
- honor global-first translation settings with project overrides
- keep managed local engine readiness and selected download groups in sync
- translate markdown table cells in bilingual/direct rendering
- refine inline markdown code styling
