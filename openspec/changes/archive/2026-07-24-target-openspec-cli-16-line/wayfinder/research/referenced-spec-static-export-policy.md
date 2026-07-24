<!--
Orthogonal intents (created 2026-07-15 Asia/Shanghai):
1. Keep live and static Specs on one source-aware catalog contract.
2. Bound which Reference content a static export may materialize.
3. Define collision-free Spec identity, navigation, and search behavior.
4. Require explicit export consent and remove machine-sensitive provenance.
5. Separate shared projection work from static-only export work.

Original request (2026-07-14): "openspec 1.6.0 已经放出，我们需要开始进行适配，目前我们的进度有点落后。"
Original request (2026-07-15): "理论上是要的，你觉得呢，工作难度大不大？这是额外的工作还是可以和 live 版本保持尽可能的一致？"
-->

# Referenced-spec static export policy

## Decision

Static export supports the direct Reference specs available to the active CLI-resolved planning root. Live and static modes must consume one Spec Catalog contract, one compound identity, one route model, one search projection, and the same read-only presentation rules.

Reference content is never exported implicitly. When the resolved root declares References, the export command requires `--references=include|omit`. Missing policy is an error, not a default.

```text
resolved planning root
        |
        +-- owned specs ----------------------+
        |                                    |
        `-- direct declared References        v
                 |                       Spec Catalog
                 +-- successfully resolved --> identity + source + content
                 `-- unresolved ------------> diagnostic / export failure
                                                  |
                         +------------------------+------------------------+
                         |                                                 |
                    live provider                                    static provider
                 reactive CLI projection                       consented snapshot hydration
                         |                                                 |
                         `---------------- shared routes/search/UI --------'
```

## Current mismatch

The existing implementation already has the right presentation seam but the wrong data identity:

- `packages/web/src/lib/use-subscription.ts` renders the same page hooks in live and static modes and swaps only the provider.
- `ExportSnapshot.specs` is a flat array keyed only by `id`; it carries no root, Store, or read-only provenance.
- `generateSnapshot(projectDir)` instantiates the adapter against the launch directory and assumes a project-local OpenSpec root.
- Both route trees use `/specs/$specId`; static hydration, search, dashboard links, and SSG route enumeration therefore treat `specId` as globally unique.

The adaptation is primarily a shared Spec-domain correction. Static export adds a bounded materialization and disclosure policy on top of that shared model.

## Shared Spec Catalog

Every Spec is addressed by a compound identity:

```text
SpecIdentity
  owned      = (scope = owned, specId)
  referenced = (scope = referenced, storeId, specId)
```

`specId` remains the upstream OpenSpec identifier. `storeId` is required only for referenced Specs. Source scope is part of identity, not display-only metadata, so these are distinct entries:

```text
(owned, billing)
(referenced, team-context, billing)
(referenced, product-context, billing)
```

The route contract mirrors that identity:

```text
/specs/owned/<specId>
/specs/referenced/<storeId>/<specId>
```

Lists, detail links, search results, view-transition cache keys, static route enumeration, and provider lookups must carry the complete identity. They must never recover a source by searching for the first matching `specId`.

The catalog can power separate **Owned** and **Referenced** views without flattening their meaning. Referenced entries are always read-only. Live and static pages expose the same navigation, translation, copy, search, and source labels; only live mode has reactive refresh and any mutation surface available to owned Specs.

## Authoritative materialization procedure

OpenSpec CLI owns Reference resolution and Store-root selection. OpenSpecUI must not read the Store registry or reconstruct referenced paths directly.

For every direct, successfully resolved Reference declared by the active planning root:

1. Enumerate its Specs through `openspec list --specs --store <storeId> --json`.
2. Materialize each body through `openspec show <specId> --type spec --store <storeId> --json` or the equivalent CLI JSON contract available in the supported 1.6 line.
3. Preserve CLI identifiers, structured diagnostics, and exit status.
4. Stop after this first level. Never follow the referenced Store's own `references:` declarations.

Owned Specs continue to come from the active resolved planning root. Reference acquisition never adds changes, archives, config, Git state, registry records, or arbitrary Store files to the snapshot.

```text
export set
  +-- active root owned Specs
  `-- direct declared Reference Specs

excluded
  +-- every other registered Store
  +-- referenced changes and archives
  +-- referenced config and Git data
  +-- Store registry and data-home files
  `-- transitive References
```

## Export consent and terminal behavior

```text
resolved root declares References?
        |
        +-- no  --> policy may be absent; snapshot records not-declared
        |
        `-- yes --> --references present?
                         |
                         +-- no      --> stop with actionable error
                         +-- omit    --> export owned Specs; record omitted
                         `-- include --> resolve and materialize direct References
                                             |
                                             +-- complete --> export
                                             `-- failure  --> stop; do not publish a partial catalog
```

- `--references=include` is explicit authorization to copy direct referenced Spec bodies into the output. All declared non-self References must resolve and all list/show operations must succeed; otherwise the exporter exits nonzero before publishing a new snapshot.
- `--references=omit` exports owned Specs only and records that Reference content was deliberately omitted. Static UI shows an omission state instead of pretending the project declared no References.
- With no effective References, an omitted flag is harmless but unnecessary; the snapshot records `not-declared`.
- Export writes should retain the existing atomicity expectation: a failed include attempt must not leave a newly generated partial `data.json` or partially refreshed site presented as complete.

## Snapshot provenance and redaction

The snapshot must retain enough provenance to render the objective projection:

- compound `SpecIdentity`;
- `storeId` for included referenced Specs;
- source scope (`owned` or `referenced`);
- `readOnly` state;
- snapshot generation time and Reference observation time;
- export policy state (`not-declared`, `included`, or `omitted`);
- sanitized structured resolution status needed to explain a static state.

The snapshot must not expose environment-specific or repository-sensitive values:

- absolute planning-root or Store paths;
- `meta.projectDir` as an absolute path;
- Store registry path or effective data-home path;
- Reference remote URLs;
- backend host identity or `envUri`;
- raw diagnostics, stdout, or stderr containing any of those values.

Static presentation uses display-safe root and Store identities. `omit` records the omission state and aggregate count without copying Store ids or Spec metadata that the operator chose not to publish.

## Work shape

This is moderate cross-cutting work, but it should not become a second static-only Spec product.

Shared work:

- source-aware Spec Catalog and compound identity;
- live CLI projection for owned and referenced Specs;
- routes, links, cache keys, search records, and page states;
- read-only rules and provenance presentation.

Static-only work:

- `--references=include|omit` parsing and consent gate;
- CLI-backed Reference materialization;
- snapshot provenance and redaction;
- static provider hydration and compound SSG route enumeration;
- include, omit, collision, unresolved, redaction, and live/static parity tests.

The difficult part is the shared identity migration, because `specId` currently crosses the router, cache, search, provider, and snapshot boundaries as if it were globally unique. Once that contract is corrected, static parity is a contained exporter/provider extension rather than an independent UI implementation.
