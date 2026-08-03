<!--
Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
1. Track every approved implementation slice through fixed red, green, mutation, review, and delivery evidence.
2. Preserve exact production ownership and prevent broad gates from hiding focused failures.
3. Separate agent automation evidence from owner-only final browser acceptance and release decisions.

Original request (2026-08-01): create the complete Change files, then begin the OpenSpecUI 7 adaptation.
Owner acceptance (2026-08-03): all final production walkthrough cases passed after the owner's fixes; proceed with Change closure.
-->

## 1. Research and Planning

- [x] 1.1 Pin `references/openspec` to released OpenSpec `v1.7.0` commit
      `4e16790d90d8f54d4773ad9a5e71a57cd9f1e86b`.
- [x] 1.2 Record black-box 1.6/1.7 protocol evidence in `references/openspec-1.7.0-report.md`.
- [x] 1.3 Capture compatibility, session-bypass, `defaultStore`, complete Agent migration, and full-protocol scope.
- [x] 1.4 Complete Config workbench, Agent owner, raw YAML, adaptive Guide, and Init Alert interviews.
- [x] 1.5 Record approved execution slices, risks, fixed evidence strategy, and owner walkthrough boundary.
- [x] 1.6 Create synchronized implementation ledger and formal delta specs before Apply.
- [x] 1.7 Keep `GOAL.md` synchronized with the current authorized slice and exact evidence boundary.

## 2. Version Line and Admission Bypass

Production owner: `packages/core/src/openspec-compat.ts` plus the Web CLI admission/mismatch Dialog owner.

### Red Evidence

- [x] 2.1 Add checked Core evidence that OpenSpecUI 7 rejects CLI 1.6.x and 1.8.x but accepts 1.7.x.
- [x] 2.2 Add checked Web evidence that an available incompatible CLI opens the blocking mismatch Dialog.
- [x] 2.3 Add checked evidence that `Skip version check` admits the current page runtime without rewriting the
      detected version or compatibility result.
- [x] 2.4 Prove page reconstruction clears the bypass and opens the mismatch Dialog again.
- [x] 2.5 Mutation check: removing the page-runtime bypass guard makes 2.3 fail; persisting the bypass makes 2.4 fail.

### Green Implementation

- [x] 2.6 Change the supported range to `>=1.7.0 <1.8.0` and remove the 6.1 legacy bridge from v7 product claims.
- [x] 2.7 Add explicit `Skip version check` action only when an incompatible executable is available.
- [x] 2.8 Keep bypass state out of localStorage, sessionStorage, IndexedDB, Workspace state, Server state, and config.
- [x] 2.9 Keep downstream CLI contract/exit failures visible after bypass.
- [x] 2.10 Update public types, diagnostics, copy, and package-level checked fixtures.
- [x] 2.11 Focused review passes before starting workflow-contract implementation.

## 3. Workflow and Operation Contracts

Production owner: `packages/core/src/cli-contracts/workflow.ts`, typed executor facade, OPSX Kernel, Server Router.

### Red Evidence

- [x] 3.1 Add the official 1.7 `skip_specs` Status fixture and prove current parsing rejects `status: skipped`.
- [x] 3.2 Add dependency evidence showing skipped artifacts satisfy `requires` without owning a physical file.
- [x] 3.3 Add Apply Instructions evidence for `context` and `operationGuidance` at the typed public boundary.
- [x] 3.4 Add Archive Instructions evidence for `openspec instructions archive --change <id> --json`.
- [x] 3.5 Prove current Archive action lacks the new selected-Root input rather than manually invoking a handler.
- [x] 3.6 Mutation checks remove skipped satisfaction, Apply inputs, and Archive command wiring independently.

### Green Implementation

- [x] 3.7 Extend artifact status and dependency contracts with `skipped` and `requires`.
- [x] 3.8 Keep dependency satisfaction, task completion, and physical artifact existence as separate facts.
- [x] 3.9 Type and preserve Apply `context`/`operationGuidance` through Core, Server, and Web action composition.
- [x] 3.10 Add typed Archive Instructions executor, projection, Router, caching/invalidation, and UI action input.
- [x] 3.11 Preserve Root/Store selector and complete command evidence for Apply and Archive instructions.
- [x] 3.12 Keep operation guidance distinct from artifact `rules` in types, UI labels, and command composition.
- [x] 3.13 Add failure, stale retained data, reconnect, and retired-generation evidence where projections are reactive.
- [x] 3.14 Focused review passes before nested Spec work.

## 4. Nested Spec Identity

Production owner: `packages/core/src/spec-catalog.ts` plus live/static route, search, export, and file lookup owners.

### Red Evidence

- [x] 4.1 Add official nested Spec fixture `platform/auth` with requirement content.
- [x] 4.2 Prove owned live route round-trip currently loses or misaddresses recursive identity where applicable.
- [x] 4.3 Prove referenced Store, search result, export snapshot, SSG manifest, and detail lookup preserve all segments.
- [x] 4.4 Prove traversal attempts remain rejected without flattening valid ids.
- [x] 4.5 Mutation check: flattening to the first or last path segment breaks the same public tests.

### Green Implementation

- [x] 4.6 Treat Spec ids as opaque recursive identities in transport and catalog keys.
- [x] 4.7 Encode/decode complete ids in owned and referenced TanStack Router routes.
- [x] 4.8 Update Server lookup, search identity, export types, exporter, static provider, and SSG route generation.
- [x] 4.9 Share live/static display mapping and document-lookup guards.
- [x] 4.10 Run clean static build and real export-path evidence for nested ids.
- [x] 4.11 Focused review passes before Environment work.

## 5. Environment `defaultStore` and Root Evidence

Production owner: Environment Global projection/file mutation owner plus Root Context.

### Red Evidence

- [x] 5.1 Add typed projection evidence that current Environment data drops or does not structure `defaultStore`.
- [x] 5.2 Add configured, absent, stale, invalid, unresolved, and effective-fallback fixtures.
- [x] 5.3 Prove Project Binding cannot read/write `defaultStore` as a project `store:` declaration.
- [x] 5.4 Prove saving an id does not fabricate effective Root success before CLI convergence.
- [x] 5.5 Mutation check: mirroring `defaultStore` into Project Binding or bypassing Root Context makes tests fail.

### Green Implementation

- [x] 5.6 Add `defaultStore` to typed global config projection and file mutation contracts.
- [x] 5.7 Add Store suggestion, freeform id, explicit clear, loading, stale, error, and pending-lock states.
- [x] 5.8 Preserve unknown environment-global fields while removing duplicate Agent structured controls.
- [x] 5.9 Refresh Root Context after settlement and display exact fallback source/diagnostics there.
- [x] 5.10 Keep static Context publication redacted under the existing policy.
- [x] 5.11 Focused review passes before Agent Delivery work.

## 6. Agent Delivery Protocol

Production owner: new Core Agent delivery registry/projection modules and `/config/agents`.

### Red Evidence

- [x] 6.1 Add completeness fixture for the official OpenSpec 1.7 tool registry.
- [x] 6.2 Prove current metadata lacks CodeArts Agent, Hermes, ZCode, Qwen Markdown command details, and Devin aliasing.
- [x] 6.3 Prove Codex command/prompt assumptions conflict with 1.7 skills-only delivery.
- [x] 6.4 Add physical-state fixtures for configured, partial, stale version, cleanup-needed, migration, and unavailable.
- [x] 6.5 Prove Settings and Environment currently provide duplicate mutation owners.
- [x] 6.6 Mutation checks remove one tool, capability, detection path, alias, cleanup path, or physical artifact mapping.

### Green Implementation

- [x] 6.7 Introduce one typed registry preserving tool id, label, capability, skills/command roots, detection paths,
      invocation, aliases, and physical artifact formats.
- [x] 6.8 Add Codex skills-only delivery and objective legacy OpenSpec-managed prompt cleanup evidence.
- [x] 6.9 Add Windsurf → Devin migration without deleting user-owned artifacts.
- [x] 6.10 Add Qwen Markdown commands, CodeArts Agent, Hermes, and ZCode.
- [x] 6.11 Project installed workflows, generated version, partial state, migration state, and cleanup requirements.
- [x] 6.12 Move `profile`, `delivery`, `workflows`, inventory, Init/Update/repair, cancel, and Terminal evidence to
      `/config/agents`.
- [x] 6.13 Replace Settings mutation UI with a read-only status summary and Manage link.
- [x] 6.14 Remove structured Agent policy mutation from Environment while preserving source evidence.
- [x] 6.15 Add checked Router/service/component fixtures for every public Agent boundary.
- [x] 6.16 Focused review passes before Config route replacement.

## 7. Config Workbench Routes

Production owner: Web route tree, Config overview shell, and focused secondary route modules.

### Red Evidence

- [x] 7.1 Lock the current mixed fixed-owner/dynamic-Schema tab behavior as the failing information architecture.
- [x] 7.2 Add route registration expectations for `/config/project`, `/config/root`, `/config/environment`,
      `/config/agents`, `/config/schemas`, and `/config/schemas/$schemaId`.
- [x] 7.3 Add narrow component fixture proving no horizontal page overflow and self-describing local navigation.
- [x] 7.4 Prove `/config/context` remains canonical in live and static route manifests.
- [x] 7.5 Mutation check: restoring dynamic Schema tabs to the fixed owner strip breaks route/layout evidence.

### Green Implementation

- [x] 7.6 Extract Config overview, local navigation, readiness summaries, and direct failures.
- [x] 7.7 Move Project Binding, Active Root, Environment, Agents, and Schema catalog/detail into route modules.
- [x] 7.8 Keep Context and Guide actions in the overview title/action plane.
- [x] 7.9 Use mobile-first container-responsive local navigation and one page-level scroll owner.
- [x] 7.10 Preserve loading/revalidating/refresh-error states inside real page geometry.
- [x] 7.11 Update static route tree/manifest only for read-only publishable surfaces.
- [x] 7.12 Focused review passes before Active Root mutation work.

## 8. Structured and Raw Active Root

Production owner: Planning Config typed mutation service and `/config/root`.

### Red Evidence

- [x] 8.1 Add fixture containing official fields, comments, `store`, `references`, and custom team keys.
- [x] 8.2 Prove current whole-file structured flow can overwrite unrelated nodes.
- [x] 8.3 Add 1.7 `operations.apply/archive.guidance` projection and edit expectations.
- [x] 8.4 Add two-editor revision conflict fixture and external physical edit fixture.
- [x] 8.5 Prove raw valid custom YAML is accepted and syntax-invalid YAML is rejected before write.
- [x] 8.6 Mutation checks remove node preservation, revision guard, atomic reactive settlement, or dependent refresh.

### Green Implementation

- [x] 8.7 Add structured schema/context/rules/operations projection with exact owner/file/revision evidence.
- [x] 8.8 Patch official YAML nodes while preserving comments, ordering, binding nodes, and unknown keys.
- [x] 8.9 Add raw YAML whole-document mode and explicit ownership notice.
- [x] 8.10 Add revision-aware conflict result and latest-source recovery path.
- [x] 8.11 Settle writes reactively before success and invalidate Project Binding, Root Context, Schema, and readiness.
- [x] 8.12 Preserve stale display but lock mutation during loading, refresh, transport error, CLI error, or Root change.
- [x] 8.13 Add focused component tests for structured/raw switching, dirty state, conflict, retry, and shared Store notice.
- [x] 8.14 Focused review passes before Init Alert work.
- [x] 8.15 Remove Active Root's JS viewport-height owner, extra card shell, and internal Structured scroll owner.

## 9. Initialize Project Alert

Production owner: one Launch Project initialization service, global Alert owner, and Config overview action.

### Red Evidence

- [x] 9.1 Add Launch Project fixture with no local `openspec/` and a separately usable external Store Root.
- [x] 9.2 Prove local initialization state and Root readiness remain independent.
- [x] 9.3 Add exact command-plan evidence for `openspec init <launch-project> --tools=none`.
- [x] 9.4 Prove opening the Alert never executes a mutation before explicit confirmation.
- [x] 9.5 Add running, cancel, failure/retry, success, `[Ok]`, and `[Start Guide]` state evidence.
- [x] 9.6 Prove closing suppresses automatic reopening only in the current page runtime while Config Init stays visible.
- [x] 9.7 Mutation checks auto-run Init, change cwd, omit `--tools=none`, expose success early, or persist dismissal.

### Green Implementation

- [x] 9.8 Add reactive Launch Project local-initialization projection.
- [x] 9.9 Add one checked Server/CLI execution owner with exact fixed arguments and streaming cancellation.
- [x] 9.10 Add global Alert auto-open coordinator and Config Init action using the same owner.
- [x] 9.11 Show exact command, output, final exit, and objective errors without credentials/private fragments.
- [x] 9.12 Refresh Config/Root/Agent projections after successful settlement.
- [x] 9.13 Remove the Settings Init executor and retain only Agent summary navigation.
- [x] 9.14 Focused review passes before Guide work.

## 10. Adaptive Config Guide

Production owner: typed Guide reducer/orchestrator plus React-owned Base UI Popover and OpenSpecUI Spotlight.

### Red Evidence

- [x] 10.1 Add reducer fixtures for ready, required, warning, stale, blocked, failed, active-edit, and complete stages.
- [x] 10.2 Prove only objectively ready stages permit progression.
- [x] 10.3 Add route transition/focus-anchor fixture and missing-target failure behavior.
- [x] 10.4 Prove completion requires current usable Resolved Context.
- [x] 10.5 Mutation check: letting Driver callbacks own readiness or skipping warnings makes reducer tests fail.

### Green Implementation

- [x] 10.6 Add lazy-loaded Driver.js dependency and narrow adapter.
- [x] 10.7 Register semantic Guide anchors in Config overview and secondary pages.
- [x] 10.8 Navigate, await route/anchor readiness, focus, and return state through the typed orchestrator.
- [x] 10.9 Pause for user edits/mutations and resume only from replacement projection data.
- [x] 10.10 Support keyboard navigation, focus restoration, reduced motion, cancel, and restart.
- [x] 10.11 Add basic component-browser preparation evidence for desktop and narrow viewport.
- [x] 10.12 Prepare owner walkthrough cases; do not claim final Guide acceptance.
- [x] 10.13 Reproduce unchanged-stage presentation re-entry and late async cleanup as precise failing Provider tests.
- [x] 10.14 Make observations idempotent, anchor registration stable, and presentation settlement generation-safe.
- [x] 10.15 Prove real Driver.js keeps exactly one overlay/popover and removes both on cancellation in Chromium.
- [x] 10.16 Add red evidence that `highlight()` clears global controls and completion loses both its anchor and dismissal.
- [x] 10.17 Put controls on the exact step popover, theme it, and anchor completion to mounted Resolved Context.
- [x] 10.18 Prove real Chromium exposes Done and removes both overlay/popover after completion dismissal.
- [x] 10.19 Prove React can overwrite Driver's target class while its overlay/popover remain, disabling target interaction.
- [x] 10.20 Audit headless Tour, Popover, mask, routing, focus, and controlled-state ecosystem boundaries.
- [x] 10.21 Replace Driver with lazy Base UI Popover plus an OpenSpecUI-owned four-region Spotlight.
- [x] 10.22 Keep navigation stable across presentation renders and remove Driver dependency/global CSS/DOM mutation.
- [x] 10.23 Pass three consecutive real Chromium runs for desktop, narrow, completion, controls, and cleanup.
- [x] 10.24 Reproduce a fully ready Guide auto-completing without interaction in reducer and Provider tests.
- [x] 10.25 Require explicit Continue for every ready stage and prove observations alone never advance or complete.
- [x] 10.26 Replace four mask regions with one SVG even-odd bevel path and prove hole/outside pointer hit testing.
- [x] 10.27 Theme the SVG veil independently for light and dark surfaces and prove computed mask colors diverge in Chromium.
- [x] 10.28 Replace the Config card grid with a stable top NavBar that becomes icon-only by container width.
- [x] 10.29 Classify every `/config/**` route as Config detail and snapshot only the owner header/content during transitions.
- [x] 10.30 Remove obsolete and failure-generated Config browser screenshots; no screenshot assertion owns these attachments.
- [x] 10.31 Restyle the Config NavBar as one thin-line table row with foreground/background-only selection and no shadow.
- [x] 10.32 Remove the default Back-to-Config action while preserving explicit nested-catalog return actions.
- [x] 10.33 Remove the NavBar top rule; keep the full border color only on the bottom and use subdued internal dividers.

## 11. Static, Documentation, and Release Preparation

- [x] 11.1 Update static route trees/manifests and shared mappings for nested Specs and Config Context only.
- [x] 11.2 Prove static output does not expose Agent inventory, environment paths, Init/Guide mutation, or raw authority.
- [x] 11.3 Clean and rebuild SSG; run the real CLI export path after clean Server/Web builds.
- [x] 11.4 Update README, adaptation docs, screenshots/copy where applicable, and public version claims.
- [x] 11.5 Add a major Changeset for every affected publishable package.
- [x] 11.6 Keep `AGENTS.md`, `CLAUDE.md`, `i18n.zh.md`, Change artifacts, and `GOAL.md` synchronized.

## 12. PR, Merge, Release, and Archive Gates

- [x] 12.1 Every changed TS/TSX file has an accurate timestamped orthogonal-intent/original-request header.
- [x] 12.2 All focused reviews pass before full gates.
- [x] 12.3 `pnpm format:check` passes.
- [x] 12.4 `pnpm lint:ci` passes.
- [x] 12.5 `pnpm typecheck` passes.
- [x] 12.6 `pnpm test:ci` passes.
- [x] 12.7 `pnpm test:browser:ci` passes.
- [x] 12.8 `pnpm --filter @openspecui/web build:ssg` passes from clean output.
- [x] 12.9 `git diff --check` passes.
- [x] 12.10 Numbered owner walkthrough document records exact head, setup, trigger, PASS/FAIL observations, and restore.
- [ ] 12.11 Open/update PR only after local gates pass; include Changeset and exact evidence notes.
- [ ] 12.12 Required PR checks pass; Manager-mode merge decision is satisfied.
- [ ] 12.13 Ask manager whether to release after merge; do not publish from the feature branch.
- [ ] 12.14 If authorized, complete version PR, release workflow, npm dist-tag, remote tags, and GitHub Release evidence.
- [ ] 12.15 Archive the OpenSpec Change only after implementation, verification, merge, and explicit archive boundary.
