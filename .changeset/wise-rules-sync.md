---
'openspecui': major
'@openspecui/core': major
'@openspecui/server': major
'@openspecui/web': major
---

Release OpenSpecUI 3.0 aligned with OpenSpec CLI 1.3 workflows.

- Establish OpenSpecUI 3.x as the OpenSpec CLI 1.3.x target line while accepting 1.2.x as legacy-compatible.
- Block OpenSpec CLI versions outside `>=1.2.0 <1.4.0`.
- Normalize `openspec instructions apply --json` context files to artifact-to-path-array mappings, matching OpenSpec CLI 1.3 while preserving legacy single-path output.
- Sync AI tool metadata with OpenSpec CLI 1.3.1, including Bob Shell, ForgeCode, Junie, Lingma, Copilot detection paths, and OpenCode `.opencode/commands/`.
- Update documentation, specs, and reference checks for the OpenSpec CLI 1.3 line.
