## Research Findings

- Current web rendering uses `react-markdown` with `remark-gfm` in `packages/web/src/components/markdown-content.tsx`.
- `react-markdown` already runs a unified pipeline: Markdown parse, remark/mdast plugins, `remark-rehype`, rehype/HAST plugins, then HAST-to-React rendering.
- Current OpenSpecUI platform only exposes a narrow render processor surface through `MarkdownRenderProcessor`, mostly heading transforms plus inline/block annotations.
- Current translation projection injects translated targets back through `MarkdownInlineContent`, so translated text is parsed as Markdown again. This causes `1. Research and Planning` to become an ordered-list structure.
- `@openspecui/core` already has Markdown fact extraction with `mdast-util-from-markdown`, GFM extensions, source ranges, and OpenSpec projections, but this is separate from the web renderer's HAST stage.
- The architecture gap is not lack of parser libraries. The gap is that OpenSpecUI does not own a first-class Markdown pipeline contract with separate mdast, hast, translation projection, and React rendering stages.
- Current server dependencies do not include SQLite. Adding backend cache storage requires selecting and integrating a SQLite driver, schema, and lifecycle location.
- Browser Translator execution still belongs in the frontend. A backend cache can store and evict translated projection results, but it cannot replace the browser-side Translator API.
- The current implementation has a project-level `ConfigManager` for `openspec/.openspecui.json`; no dedicated `~/.openspecui/settings.json` global settings manager was found in the source search.
- Existing specs mention global settings as a concept, but translation cache requires a concrete global settings persistence layer.

## Decision & Plan (For Approval)

- Upgrade the platform law from "MarkdownViewer exposes render processors" to "MarkdownViewer owns a staged Markdown pipeline".
- Use a structural pipeline:

```txt
rawMd
  -> mdast
  -> mdAstProcess
  -> hast
  -> hastProcess
  -> browser translation projection
  -> React render
```

- Treat the user's proposed `rawHtml` step as a temporary, validated translation-fragment representation, not as the global document truth.
- Implement translation as a HAST-stage browser projection:
  - Select translatable HAST phrasing groups from block owners such as heading, paragraph, list item, table cell, and blockquote.
  - Serialize each group into a placeholder fragment such as `I <x1>love</x1> you`.
  - Store real tag names, properties, source ranges, and display policies in a side table keyed by placeholder id.
  - Translate the placeholder fragment with the browser Translator API.
  - Parse the translated fragment with `DOMParser`.
  - Validate placeholder ids, nesting, closure, and allowed attributes.
  - Restore a trusted HAST fragment from the side table and translated text/attribute values.
- Do not special-case `a` text. Link text participates in normal phrasing translation. Protected structural attributes such as `href` remain side-table-owned. User-visible attributes such as `title` can enter a controlled attribute translation protocol.
- Define code-like translation policy:
  - `code`, `kbd`, and `samp` are translatable semantic nodes.
  - Direct translated mode may show source by default and translated content as preview/hover.
  - Bilingual mode may append translated content because source is already visible.
  - Display policy is separate from whether translation is computed.
- Define translation cache as an optional enhancement:
  - Cache is disabled by default.
  - Backend SQLite storage is the preferred cache authority when a live server is available.
  - Use `better-sqlite3` on Node and `bun:sqlite` on Bun behind a shared adapter because their interfaces are close enough to share most cache service logic.
  - Frontend translation must not block on cache writes; failed writes are allowed.
  - Static/SSG or serverless browser-only modes must keep translation functional without cache.
  - Cache enablement is project-level, while cache capacity and management settings are global user-level settings.

### Inline Semantic Node Model

- Inline semantic node means a HAST phrasing element whose tag changes reading semantics, interaction, or display policy while still living inside a block owner.
- Examples:
  - Text styling semantics: `strong`, `em`, `del`, `sub`, `sup`, `mark`.
  - Technical semantics: `code`, `kbd`, `samp`, `var`.
  - Navigation semantics: `a`.
  - Media/alternate text semantics: `img` and similar leaf nodes when rendered inline.
  - Projected annotation semantics: `span` nodes created by OpenSpecUI processors with known `data-*` contracts.
- Non-examples:
  - Block owners such as `h1`-`h6`, `p`, `li`, `blockquote`, `td`, `th`.
  - Layout containers that should not be moved inside translated phrasing output.
- Translation grouping rule:
  - Translate one block-owned phrasing group at a time, for example the children of one heading or one list item.
  - Preserve inline semantic nodes as movable placeholders inside that group.
  - Never let translated text create a new block owner.

### Placeholder Attribute Protocol

- Element placeholders:
  - A source inline element becomes a synthetic tag such as `<x1>...</x1>`.
  - The side table stores the original HAST tag name, properties, source metadata, and display policy.
- Attribute placeholders:
  - Translatable attributes become synthetic attributes such as `a1=" value "`.
  - The side table maps `a1` back to a specific original attribute such as `title` or `alt`.
  - Padding spaces around attribute values are allowed when needed to encourage Translator to treat the attribute as natural language.
- Protected attributes:
  - URL-bearing, event-like, identity, class, style, and structural attributes are never accepted from Translator output.
  - Protected attributes are restored only from the side table after placeholder validation.
- Restoration rule:
  - DOMParser output is treated as untrusted parse material.
  - Only known placeholders and known synthetic attributes can contribute translated text.
  - Restored HAST is built from the side table plus translated text, not from arbitrary parsed tags or attributes.

### Translation Cache Model

- Cache authority:
  - Prefer server-side SQLite for v1 because it can enforce entry counts, timestamps, and future size-based cleanup with deterministic queries.
  - Use a runtime adapter that selects `bun:sqlite` in Bun and `better-sqlite3` in Node.
  - IndexedDB remains a possible fallback for static/browser-only environments, but it is not the preferred platform law for live OpenSpecUI sessions.
- Cache configuration:
  - Translation cache is disabled by default.
  - Project config controls whether the current project uses translation cache.
  - Global settings stored at `~/.openspecui/settings.json` control shared cache capacity and cache management defaults.
  - Settings exposes cache controls only when cache is enabled for the current project.
  - Configurable entry limit is exposed as a global setting.
  - Settings provides "clean" and "clear" actions for the shared cache database.
- Cache location:
  - The SQLite database lives in the user cache directory, not in any project directory.
  - All projects share the same translation cache database.
  - Shared storage is intentional because translation cache is an experience enhancement, while enablement remains isolated per project.
- Cleanup policy:
  - Entry-count LRU is the v1 capacity model.
  - When stored entries reach 90% of the configured limit, cleanup starts.
  - Cleanup evicts least-recently-used entries until the cache is at or below 60% of the configured limit.
  - Cache write and cleanup are asynchronous enhancement operations and must not block translation rendering.
- Cache key:
  - The key includes source text, placeholder topology, translatable attribute topology, source language, target language, and node display policy version.
  - The key should be hashed before storage while retaining enough metadata for debugging and cleanup.
- Storage value:
  - Store validated translated projection payloads, not raw untrusted DOMParser output.
  - Store metadata such as created time, last accessed time, source language, target language, policy version, and validation status.

## Capability Impact

### New or Expanded Behavior

- Document translation preserves Markdown-rendered block structure because translated text is never parsed as block Markdown.
- Inline semantic nodes inside headings and prose survive translation projection.
- Translation can handle user-visible HTML attributes through a controlled placeholder attribute protocol.
- Translation display policy becomes node-aware, enabling code-like source-first behavior.
- HAST processors become a durable extension surface for future document projections.

### Modified Behavior

- Translation moves from Markdown-inline re-rendering to HAST-side structural projection.
- `MarkdownViewer` plugin contracts expand beyond heading transforms and annotation maps.
- ToC labels should derive from restored translated HAST text content, not from raw translated HTML strings.

## Risks and Mitigations

- Risk: Translator output may drop, rename, duplicate, or misnest placeholders.
  Mitigation: Validate placeholders before restoration and fail closed to source display or text-only translation.
- Risk: DOMParser may auto-correct malformed output and hide translator corruption.
  Mitigation: Validate the parsed fragment against the expected placeholder grammar and side table, not only against parser success.
- Risk: Attribute translation can become an injection path.
  Mitigation: Only restore attributes that existed in the side table, split translatable attributes from protected attributes, and sanitize URL-bearing attributes through existing URL policy.
- Risk: Translating text node by node loses context.
  Mitigation: Translate block-owned phrasing groups, not isolated text nodes, while preserving inline nodes through placeholders.
- Risk: Code-like nodes may produce noisy translations.
  Mitigation: Translate them for preview/bilingual use, but keep source-first display policy configurable by semantic node kind.
- Risk: Replacing `react-markdown` internals all at once could destabilize rendering.
  Mitigation: First expose a HAST processor slot compatible with current `react-markdown` rehype stage, then progressively consolidate MarkdownViewer around an owned pipeline.
- Risk: Backend cache stores source-derived and translated document content.
  Mitigation: Keep cache disabled by default, expose explicit Settings controls, and store cache in an application-managed location rather than as source-controlled project files.
- Risk: Backend cache is unavailable in static/SSG mode.
  Mitigation: Treat cache as optional enhancement; translation must run uncached when no live server cache endpoint exists.
- Risk: SQLite dependency and file lifecycle add platform complexity.
  Mitigation: isolate cache behind a translation-cache service contract and keep cache failure non-fatal.
- Risk: Global shared cache surprises users who expect project isolation.
  Mitigation: keep enablement project-level, keep the database in user cache, and make global cache management explicit in Settings.
- Risk: Bun and Node SQLite drivers diverge in subtle behavior.
  Mitigation: define a small internal adapter contract and test the cache service against that contract.

## Accepted Design Decisions

- V1 translates one block-owned phrasing group as a whole by default. Very long block chunking is deferred.
- V1 uses `xN` synthetic tags for inline element placeholders, for example `<x1>...</x1>`.
- V1 uses `aN` synthetic attributes for translatable attribute placeholders, for example `<x1 a1=" value ">...</x1>`.
- V1 translatable attribute allowlist is `title`, `alt`, and `aria-label`.
- Malformed placeholder output falls back to source-only display by default.
- `code`, `kbd`, and `samp` are translated by default, but direct-mode display remains source-first; translated content is exposed through preview/hover or bilingual append policy.
- Translation cache is disabled by default.
- V1 cache capacity is entry-count based rather than byte-size based.
- Cache cleanup starts at 90% of the configured entry limit and evicts to 60%.
- Cache writes are asynchronous and allowed to fail without blocking translation.
- Cache keys include `sourceLanguage` in addition to source text, placeholder topology, target language, and display policy.
- Node runtime uses `better-sqlite3`; Bun runtime uses `bun:sqlite`; cache service logic should share a small adapter contract.
- The SQLite translation cache database is shared by all projects and lives in the user cache directory.
- Global cache settings live in `~/.openspecui/settings.json`.
- Cache enablement remains project-level, so enabling cache in one project does not enable it in another project.
- Cache directory uses OS conventions:
  - macOS: `~/Library/Caches/openspecui/`
  - Linux: `${XDG_CACHE_HOME:-~/.cache}/openspecui/`
  - Windows: `%LOCALAPPDATA%/OpenSpecUI/Cache/`
- `~/.openspecui/settings.json` is introduced for translation cache global settings in this loop; migration of unrelated project-level settings is deferred.

## Recommendations

- Treat HAST translation as a projection protocol with its own types, not as a generic rehype plugin that mutates arbitrary trees.
- Start v1 with block-owned phrasing groups and a strict placeholder side table; defer cross-block translation context until there is evidence the browser Translator needs it.
- Use a narrow translatable-attribute allowlist at first: `title`, `alt`, and `aria-label`.
- Keep `href`, `src`, `id`, `className`, `style`, event handlers, and arbitrary `data-*` properties outside Translator output. Restore them only from the side table.
- Prefer fail-closed source display for structural validation failures, with a visible per-segment error state for debugging and tests.
- Add telemetry-free debug metadata in development/test builds so failed placeholder restoration can be diagnosed without exposing translated content to persistent storage.
- Prefer a server-side SQLite cache for live OpenSpecUI sessions, with a no-cache path for static/browser-only sessions.
- Keep cache controls under Translation Settings and reveal detailed cache configuration only when cache is enabled.
- Add Settings actions for cache clean and cache clear once the cache service exists.
- Add a global settings manager instead of overloading project `openspec/.openspecui.json` with user-level cache policy.
- Keep the shared cache database independent from project roots, git worktrees, and static export artifacts.

## Verification Strategy

- Add unit tests for translation projection of `### 1. Research and Planning`, asserting the output remains a heading and does not contain `ol` or `li`.
- Add unit tests for headings with inline semantic structure, including strong/em/code/link children.
- Add unit tests for link text translation with protected `href` and translatable `title`.
- Add unit tests for `alt` translation on image-like inline nodes if those nodes are supported in the document surface.
- Add unit tests for code-like direct and bilingual display policies.
- Add malformed-output tests for missing closing placeholders, mismatched ids, unknown ids, unknown attributes, and parser-repaired fragments.
- Add cache-key tests covering source language, target language, placeholder topology, translatable attributes, and display policy version.
- Add cache service tests for disabled cache, async write failure, 90% to 60% cleanup, clean action, and clear action.
- Add global settings tests for reading/writing `~/.openspecui/settings.json`, pruning defaults, and merging project-level enablement with global cache policy.
- Add adapter-contract tests for SQLite operations used by the cache service.
- Run scoped checks for web translation and Markdown rendering:
  - `pnpm --filter @openspecui/web test -- src/components/document-translation-action.test.tsx src/components/markdown-viewer.test.tsx`
  - Broaden to `pnpm --filter @openspecui/web test` once the pipeline contract changes.
