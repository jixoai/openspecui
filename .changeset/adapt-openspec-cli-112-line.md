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

OpenSpecUI 12: adapt the OpenSpec CLI 1.12 line.

- Compatibility window: OpenSpec CLI `>=1.12.0 <1.13.0` (single-series; stable 1.12.x current and
  recommended). CLI `1.10.x`/`1.11.x` (the OpenSpecUI 11 window) and older lines are blocked by default;
  prereleases and `>=1.13.0` remain blocked.
- `validate --report findings` is a new capability-gated typed contract and validation evidence surface:
  findings-only items with preserved full-run totals and exit codes; `invalid_validation_report_request`
  request errors flow through the shared diagnostic envelope.
- Merge-conflict advisory findings (`Archive would refuse this delta` / `Could not check archive merge
  conflicts`) render as a first-class informational (INFO) class without changing validity evidence.
- Agent delivery adds SourceCraft Code Assistant (`.codeassistant`, natural-language skill references,
  commands at `.codeassistant/commands/opsx-<id>.md`, no IDE restart, no migration) for 1.12 sessions;
  generator staleness rotates to the 1.12.0 baseline.
- Pinned executable fixtures: `openspec-cli-112` proves the new contracts; the retained
  `openspec-cli-111` proves capability-boundary rejections.
