---
'@openspecui/app': major
'@openspecui/browser-translator': major
'@openspecui/core': major
'@openspecui/local-ct2-translator': major
'@openspecui/local-llama-translator': major
'@openspecui/local-translator': major
'@openspecui/openai-completion-translator': major
'@openspecui/search': major
'@openspecui/server': major
'@openspecui/web': major
'@openspecui/website': major
'openspecui': major
---

OpenSpecUI 11 adapts OpenSpec CLI 1.10 and 1.11 in one release line: stable `>=1.10.0 <1.12.0` is admitted with the 1.11 line current and recommended and the 1.10 line supported non-current, while CLI `<1.10.0` (including 1.9.x and older), every prerelease, `>=1.12.0`, and unparseable versions stay blocked by default behind the session-scoped version-bypass dialog. 1.11 sessions load the full change status list through one `openspec status --all --json` spawn behind a capability gate — 1.10 keeps the serial per-change path — with partial-failure batches preserved as per-change diagnostics instead of failing the whole status projection. Change Detail MODIFIED deltas render the CLI's own `openspec show --diff` unified diff body and exact upstream warnings as separate evidence without recomputing or backfilling the local delta projection, `openspec init --language` passes through on both admitted lines, and validate surfaces the Purpose-placeholder warning class. The Agent delivery registry is rebuilt from the pinned 1.11 inventory: Zed joins from 1.10 (skills-only at `.agents/skills`, shared-root owner candidate), Antigravity declares `.agents` current with `.agent` legacy/migration evidence from 1.11 only while 1.10 keeps `.agent` current, opencode command templates carry the `**Provided arguments**` passthrough, and per-tool IDE-restart guidance follows actually written artifacts. Pinned 1.10.0/1.11.0 executable fixtures prove every accepted contract plus both capability-boundary rejections, and the references/openspec pin advances to verified v1.11.

The 10.0.0 base version is consumed without a release so this major changeset publishes as OpenSpecUI 11.0.0: the v11 line deliberately skips a separate 1.10-only OpenSpecUI 10 release while still taking on every 1.10 protocol obligation.
