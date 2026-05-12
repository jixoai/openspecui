# Research Plan

## Research Findings

- OpenSpecUI currently reads source markdown through `OpenSpecAdapter` and exposes raw/parsed data through server routers.
- Search currently indexes raw markdown via `collectSearchDocuments`.
- Static export stores spec `content` from raw reads; static mode later uses that content for view and search.
- OPSX status and instructions are kernel-first and CLI-driven. `openspec status --json` and `openspec instructions --json` remain the facts.
- Current OPSX UI has multiple invocation paths: new change starts a CLI terminal, compose actions generate agent prompts or slash commands, verify runs CLI validation.
- `.openspecui.json` is a persisted static config file and must not hold executable hook logic.

## Decision & Plan

- Add a hooks platform layer with stable V1 types and a project hook loader.
- Add a document service that can return source or processed markdown.
- Keep source reads for validation and raw UI; use processed reads for view/search/export by default.
- Add a workflow invocation service that returns typed `agent-prompt`, `agent-command`, or `cli-command` payloads.
- Update OPSX UI to request workflow invocation payloads from the server rather than assembling every payload purely in browser helpers.

## Risks and Mitigations

- Hook code can throw or hang. Use abort signals, diagnostics, and fail-open fallback to default behavior.
- TypeScript hook loading can fail in production. Use `tsx` loader support and cover it with tests.
- Search/export parity can drift. Use a shared document service and tests for both live and static behavior.
- Workflow hooks could corrupt OPSX semantics. Keep CLI status/instructions/schema reads outside the hook and only hook the final invocation payload.

## Verification Strategy

- Unit test hook loader with missing file, TS file, invalid exports, and thrown errors.
- Unit test document service source vs processed behavior.
- Unit test search document collection using processed markdown.
- Unit test static export stores processed content and raw source content.
- Unit test workflow invocation default payloads and hook overrides.
