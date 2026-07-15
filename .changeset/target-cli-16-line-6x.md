---
'@openspecui/core': major
'@openspecui/server': major
'@openspecui/web': major
openspecui: major
---

Target the OpenSpec CLI 1.6.x line with OpenSpecUI 6.x.

OpenSpecUI keeps the strict major-to-minor version law: OpenSpecUI 6.x targets
OpenSpec CLI 1.6.x, accepts 1.5.x as the immediately previous legacy-compatible
line, and rejects older or forward CLI lines by default.

- Preserve typed CLI JSON, stdout, stderr, diagnostics, resolved root provenance,
  and exit status for workflow, Store, Context, Doctor, validate, and archive
  commands.
- Complete the 1.6 workflow/tool contract with `update`, the 1.4 `sync` baseline,
  Oh My Pi, and Trae command delivery.
- Follow strict validate/archive failures without implicit validation bypass or
  synthesized scenario merges.
- Preserve empty healthy Stores and multiline Requirement bodies according to
  the pinned OpenSpec 1.6 contracts.
