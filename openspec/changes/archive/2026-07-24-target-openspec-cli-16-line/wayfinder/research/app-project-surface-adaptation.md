<!--
Orthogonal intents (created 2026-07-15 Asia/Shanghai):
1. Fix the product boundary between App and the single-project WebUI.
2. Specify the OpenSpec 1.6 adaptation of every existing project page.
3. Specify App-native onboarding, environment, Store, and settings surfaces.
4. Record the delivery order and the settled experimental Store Manager boundary.

Original request (2026-07-15): "你直接给我一份合理的，符合openspec团队设计哲学与预期的效果：你直接跟我说哪个子页面要怎么改，要加什么东西。不用画图。"
Original request (2026-07-15): "我们可以在 cli 上新增一个 --auth 或者 --password。"
Original request (2026-07-15): "统计信息仍然有一定的间接价值。"
-->

# App and project surface adaptation

## Recommended product boundary

OpenSpecUI should have two deliberately different products in one distribution:

- **App** is the persistent multi-project shell. It owns project-backend connections, tabs, online state, OpenSpec runtime environments, and environment-scoped Store administration.
- **Project workspace** is the WebUI served by one project backend. It owns one launch project, the one writable planning root selected by the OpenSpec CLI, and the read-only References available to that root.

One App tab must continue to mean one project backend. A tab must not become a Store browser or a multi-root editor. This preserves the upstream rule that every workflow command has exactly one selected writable root, while References only add read-only specs to the Agent's context.

The CLI remains authoritative for root selection, Store health, Reference resolution, workflow paths, task progress, validation, and archive outcomes. OpenSpecUI may project those results but must not recreate the rules independently.

## App-native pages

### Home / Connections

Replace the current empty shell with the first usable App page.

- Show every persisted project backend with project name, connection URL, online/checking/offline state, CLI version, and last successful connection.
- Make add, reconnect, open, remove, and reorder first-class actions. Opening a connection creates or activates its project tab.
- For a gated backend, accept its Bearer credential as transient connection state. Never persist it with the backend URL or project tab.
- Turn first-run onboarding into an actionable empty state: connect the backend just launched by `openspecui --app`, or enter another backend URL. Do not create a separate marketing/tutorial page.
- Preserve offline connections so a temporarily stopped project does not disappear. Let the user remove them explicitly.
- Show per-project health and unread indicators without merging notification records from different backends.

### Environment Center

Add an App-native page that groups connected backends by OpenSpec runtime environment rather than by URL.

- Show `envUri`, CLI version, OpenSpecUI server version, effective OpenSpec data scope diagnostic, connected projects, and Store/Workset capabilities.
- Treat `envUri` as a backend-issued opaque identity contract. App must not infer it from the API URL or assume all localhost backends share one registry.
- Make degraded environments visible: unsupported CLI, unavailable backend, unresolved planning root, or Store registry diagnostics.
- Use this page as the selection boundary for every environment-scoped operation.

The hosted health protocol therefore needs a stable `envUri`, CLI and capability summary, and a compact root/context summary before App-native Store mutation is safe.

### Store Manager

Add Store Manager as an App-native environment page, not as a project page.

- Require the user to select an online OpenSpec runtime environment.
- List Stores and doctor results from that environment's CLI.
- Provide CLI-backed `setup`, `register`, `unregister`, `remove`, and `doctor` actions. Preserve upstream validation, canonical paths, conflict detection, locking, diagnostics, and exit status.
- Mark `remove` as destructive because it deletes Store files; keep `unregister` as the non-destructive way to forget a checkout.
- Show which connected project contexts currently reference or resolve through each Store when that information is available.
- Never implement Git clone, pull, push, or synchronization implicitly. Upstream intentionally leaves Store sharing to Git and explicit user actions.
- Never present a Store registered in one remote environment as available in another environment.

### App Settings

Keep App settings limited to shell-wide concerns:

- PWA install/update and release information.
- Connection retention and backend reachability diagnostics.
- Runtime-environment protocol diagnostics.
- Backend Access Gate connection diagnostics, without user, role, or permission settings.
- Theme or other truly App-wide presentation preferences.

Project OpenSpec configuration, workflow preferences, terminals, and Git preferences remain inside the project workspace.

## Project workspace shell

Introduce one reactive Root Context contract consumed by every page. It must contain:

- launch-project identity and absolute path;
- resolved planning-root path, source, and optional Store id;
- CLI version and root-selection health;
- resolved Reference count and diagnostics;
- read-only effective OpenSpec data-scope diagnostic.

Show the active planning-root identity compactly in the global shell and expose full details on demand. When the root is external, never call it "the current project". A compatible CLI version is not sufficient health: root selection and Reference resolution must also complete before root-dependent actions become available.

## Project page changes

### Dashboard

- Derive change, spec, workflow, and progress metrics from the resolved planning root.
- Show the launch project and active planning root as distinct identities when they differ.
- Add a compact context-health summary: root source, Store id, Reference count, and unresolved Reference warnings.
- Label the existing Git snapshot as code-project Git. If the planning root lives in a different repository, show its status separately rather than combining histories.

### Changes

- List only changes owned by the active writable planning root. Referenced Stores do not contribute changes.
- Identify the root and root source in the page header.
- Replace aggregate checkbox progress with the canonical OpenSpec 1.6 tracked-artifact progress for workflow status. Retain document-wide checklist counts as explicitly secondary analytics with a different label; they remain useful for planning inspection but never drive readiness.
- Ensure New and Propose target the resolved root and retain Store selection across follow-up commands.

### Change detail

- Preserve CLI-provided `changeRoot`, `artifactPaths`, `existingOutputPaths`, `actionContext`, `references`, and root provenance throughout the page.
- Add `Update` beside Continue, Fast-forward, Apply, Verify, Sync, and Archive where the schema/workflow permits it.
- Add a Reference context panel showing which Store specs are available to the Agent and which References are unhealthy.
- Open and edit CLI-resolved absolute artifact paths. Do not reconstruct paths from the launch project.
- Use CLI JSON and exit status as the truth for validate and archive. Preserve stricter 1.6 diagnostics instead of translating failures into apparent success.
- Replace "current project" error copy with "active planning root" when the root or change cannot be resolved.

### Specs

- Make **Owned** the default view: specs in the active writable root.
- Add a **Referenced** view grouped by Store id. It contains only specs exposed through declared References.
- Mark every referenced spec read-only and retain its owner, Store id, and absolute source path in the data contract.
- Never flatten owned and referenced specs into one unlabeled list.

### Spec detail

- Show owner, planning root, and read-only state.
- Disable editing and root-mutating actions for referenced specs while keeping navigation, search, translation, and copy operations available.
- Return to the correct Owned or Referenced list scope.

### Archive

- List archives from the active writable root only and show its identity.
- Preserve upstream 1.6 validation and scenario-loss diagnostics exactly.
- Never retry automatically with `--no-validate`; bypassing validation remains an explicit user decision.

### Config

Split the page by ownership rather than exposing one ambiguous YAML editor:

- **Project Binding** edits the launch project's `store:` pointer and `references:` declarations and previews the resulting root selection and Reference health.
- **Active Root Config** edits schema, context, and rules for the resolved writable root. When that root is an external Store, state clearly that the change affects every project using that Store.
- **Environment Global Config** shows profile, delivery, and workflow configuration as machine/environment-scoped state.

The page must not add an `XDG_DATA_HOME` editor or imply that the Store registry is project-local.

### Context (replace Stores)

Rename the current project route from **Stores** to **Context**, matching upstream `openspec context`.

- Show the active root, root source, Store identity, declared References, Reference health, and effective runtime environment.
- Keep the registered Store inventory and doctor output read-only in this project page.
- Link to the App Store Manager for setup/register/unregister/remove once that page exists.
- Provide direct fixes for missing registrations and unhealthy References using upstream CLI diagnostics, but execute registry mutations only through the selected environment boundary.

### Search

- Search the active root by default.
- Add an explicit Referenced Specs scope.
- Show Store owner and read-only state on every referenced result.
- Do not search referenced changes because OpenSpec References expose specs as context, not another change workspace.

### Git

- Keep **Code repository** as the default scope.
- When the planning root belongs to a different Git repository, add a **Planning repository** scope.
- Make the selected scope explicit for status, history, worktrees, and every mutation so no Git command silently targets the wrong repository.
- Do not add automatic Store synchronization; the page only exposes the repositories already present.

### Terminal

- Add a terminal target choice: **Launch project cwd** or **Planning root cwd**.
- Display the selected cwd/root identity in the terminal tab label and spawn dialog.
- Preserve the same inherited `XDG_DATA_HOME` for both targets and for Agent-invoked OpenSpec commands.

### Settings

- Update the compatibility contract to the OpenSpecUI 6.x / OpenSpec CLI 1.6 line.
- Add `update` and the previously missed `sync` workflow to profile and initialization views.
- Add Oh My Pi support and Trae command-delivery completeness.
- Show CLI, root-selection, runtime-environment, and OpenSpec data-scope diagnostics read-only.
- Keep App connection settings and Store registry mutations out of this page.

### OPSX actions

- Show the target planning root before New, Propose, Compose, Verify, and the new Update action dispatches.
- Preserve CLI-provided Store flags, action context, References, and resolved paths across terminal or direct invocation.
- Generate Agent prompts from CLI-resolved paths; never assume `<launch-project>/openspec`.

### Notifications

- Keep notification records scoped to the current project backend.
- Add root/context health events without merging events from other App tabs.
- Let App aggregate only unread counts and backend health indicators.

### Static export

- Export the resolved planning root rather than an assumed project-local `openspec/` directory.
- Include root provenance in snapshot metadata.
- Keep live and static Specs on one source-aware Spec Catalog, compound identity, route, search, and read-only presentation contract.
- Add `--references=include|omit`. If the resolved root declares References and the flag is absent, stop instead of silently publishing or silently discarding cross-repository content.
- `include` materializes only direct, declared, successfully resolved Reference Specs through OpenSpec CLI `list --specs --store` and `show --store`; it never exports every registered Store or follows transitive References.
- `omit` publishes owned Specs and an explicit omission state, not a false "no References" state.
- Remove absolute paths, registry/data-home paths, remote URLs, backend identity, and path-bearing raw diagnostics from static snapshots.

The complete identity, terminal behavior, redaction, and work split are recorded in [Referenced-spec static export policy](referenced-spec-static-export-policy.md).

## Package and entry recommendation

Keep the existing package boundary for the first adaptation:

- Add App-native routing and pages inside `packages/app`.
- Keep the backend-owned project workspace in `packages/web`.
- Do not add alternative HTML entries to `packages/web`; they would couple environment-scoped pages to a project backend and duplicate bootstrap/state ownership.
- Do not create a new package yet. Extract an environment or Store client package only after App and another consumer demonstrably share the same stable protocol module.

## Delivery order

1. Establish the Root Context contract and make all server services operate on the CLI-resolved planning root.
2. Adapt every project page for root provenance, References, canonical task progress, and the OpenSpec 1.6 workflow/tool contract.
3. Upgrade App Home/Connections and extend the hosted protocol with stable runtime-environment identity and capabilities.
4. Add Environment Center, then implement Store Manager against a selected environment.

The first two steps are the OpenSpecUI 6.0 correctness baseline. App Home and the environment protocol should enter the 6.0 plan so `--app` becomes a real product surface.

## Resolved experimental boundary

Decision (2026-07-15): `--app` remains explicitly experimental and Store Manager is not a mandatory OpenSpecUI 6.0 release gate. Store Manager still closes the multi-project product story, so its full information and operation surface must be prototyped before formal OpenSpec artifacts converge.

The eventual production surface belongs in `packages/app`, not a new package and not the single-project `packages/web`. The throwaway [Store Manager UI prototype](../prototypes/store-manager/README.md) presents registry-table, Store-inspector, and project-context-matrix variants while simulating every mutation in memory.

## Selected Store Manager composition

Decision (2026-07-15): use the Store Inspector (`B`) as the primary Store Manager interaction, expose the Context Matrix (`C`) as a sibling Context view, and retain the Registry Table (`A`) as a wide-screen Inventory view.

The inspector owns Store identity, Doctor results, and all setup/register/unregister/remove actions. The Context view owns project-to-Store Root and Reference relationships. Inventory provides dense environment-wide scanning without becoming the only navigation model.
