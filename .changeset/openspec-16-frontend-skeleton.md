---
'@openspecui/web': minor
---

Add OpenSpec CLI 1.6 frontend foundations: a live project Context view, compound Spec routes, and task/Spec-catalog type contracts.

This began as a frontend-first skeleton for the OpenSpecUI 6.x / OpenSpec CLI
1.6 line. The project Context view now consumes the shared Core/Server Root
Context subscription, and the three task projections have migrated to the
shared Core contract. The source-aware Spec Catalog now uses one Core identity
contract across Server, Web, Search, View Transitions, and static providers.

- **Project Context view** (`/context`, 6.9): replaces the project Stores panel as
  the root/Reference/registry read-only diagnostics surface. Uses neutral
  "observed references" / "no reference currently observed" copy — never claims
  machine-wide completeness.
- **Global Root Context identity** (6.1): desktop and mobile shells display the
  launch project and active planning root independently, preserve stale/error
  status, and link to on-demand Context members plus raw Doctor/Context command
  evidence without introducing a browser-owned root switcher.
- **Compound Spec identity & routes** (5.7–5.9): adds `/specs/owned/$specId` and
  `/specs/referenced/$storeId/$specId`. `specId` is no longer treated as globally
  unique; routes/cache/search preserve full identity. The legacy
  `/specs/$specId` route and bare-id RPC contracts are removed without aliases.
- **Source-aware catalog and detail** (5.8–5.11): combines planning-root Owned
  metadata with direct Root Context References, reads referenced detail through
  `openspec show --store`, preserves command evidence, and renders References as
  visibly read-only without synthesizing missing Requirement fields.
- **Task projection contracts** (5.1–5.6): uses Core `TrackedTaskProgress`
  (workflow truth, `0/0` → `no-tasks` never `complete`),
  `DocumentChecklistSummary` (secondary analytics, never drives readiness), and
  `ApplyInstructionProgress` (raw Apply result with visible divergence). No
  compatibility alias for the generic `progress` field.

Note: this web changeset covers the published package. The accompanying
`@openspecui/app` changes (App router, Home/Connections, Environment Center, and
the experimental Store Manager Inspector/Context-Matrix/Inventory skeleton) are
in the private `@openspecui/app` package and therefore do not require a
publishable changeset.
