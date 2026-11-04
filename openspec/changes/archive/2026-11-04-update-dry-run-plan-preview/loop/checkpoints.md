<!--
Orthogonal intents (created 2026-10-29 Asia/Shanghai):
1. Actionable checklist for the focused loop.
-->

- [x] Core: capability + typed contract + executor method + tests
- [x] Server: preview transport + router lane
- [x] Web: dialog/route preview + browser lane
- [x] Fixtures: real-binary positive + source anchors + lane registration/repair
- [x] Gate: check-openspec-reference repaired to v1.15
- [x] Docs: changeset minor ×4 + AGENTS decision line + loop artifacts
- [x] CI green via workflow_dispatch; merged per Manager Mode (PR #316, `53d4ae24`).
- [ ] Spec coverage of the delivered `updateDryRun` capability: this change declared `skip_specs:
true`, so no capability spec states the `UpdatePlan` contract or the preview surface. The
      behavior shipped and is tested, but the specification library does not describe it. Recorded
      here as an open documentation gap for a follow-up change; it is not fixed by archiving.
