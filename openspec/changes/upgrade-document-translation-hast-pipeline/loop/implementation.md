## Implementation State

Implementation has not started. This artifact is the apply-ready construction baseline for the approved architecture.

The apply phase should execute in this order:

1. Introduce global settings infrastructure for `~/.openspecui/settings.json`.
2. Extend project-level document translation config with cache enablement only.
3. Add the translation cache service boundary and SQLite adapter layer.
4. Add the staged Markdown pipeline contract with explicit mdast and HAST processing stages.
5. Move document translation projection from Markdown-inline re-rendering to HAST-side placeholder translation.
6. Add Settings controls for project enablement plus global cache capacity, clean, and clear actions.
7. Update specs/checkpoints and run scoped verification continuously.

## Decisions Taken

- Translation projection must work at the HAST/HTML-AST stage, not by sending translated Markdown snippets back through Markdown parsing.
- `rawHtml` is allowed only as an internal, validated translation fragment representation. It is not a new source of truth.
- V1 translates one block-owned phrasing group as a whole.
- Inline element placeholders use `xN` tags.
- Translatable attribute placeholders use `aN` attributes.
- V1 translatable attributes are `title`, `alt`, and `aria-label`.
- Protected attributes are restored only from side tables, never from Translator output.
- `code`, `kbd`, and `samp` are translated by default, but direct mode displays source first.
- Malformed placeholder output falls back to source-only display.
- Translation cache is optional and disabled by default.
- Cache enablement is project-level.
- Cache policy is global and stored in `~/.openspecui/settings.json`.
- The shared SQLite cache database lives in the user cache directory and is shared by all projects.
- Node uses `better-sqlite3`; Bun uses `bun:sqlite`; both sit behind a small internal adapter.
- Cache writes and cleanup are async enhancement operations and must not block translation rendering.

## Divergence Notes

- The original user sketch included `md -> md2html -> rawHtml -> htmlAstProcess -> html`. The approved implementation should preserve that spirit but avoid making raw HTML a platform truth. The durable law is `rawMd -> mdast -> mdAstProcess -> hast -> hastProcess -> browser translation projection -> React render`.
- Cache initially considered frontend IndexedDB. The approved direction is backend SQLite for live sessions, with uncached operation for static/browser-only modes.
- Existing project-level `.openspecui.json` is not sufficient for cache policy. A global settings manager is required.

## Loopback Triggers

- Browser Translator does not reliably preserve `xN` tags or `aN` attributes under real Chrome acceptance tests.
- DOMParser or HAST restoration cannot validate malformed placeholder output without unsafe guessing.
- `react-markdown` cannot expose enough HAST control without replacing too much of the renderer in one step.
- `better-sqlite3` cannot be packaged safely for supported Node runtime targets.
- `bun:sqlite` and `better-sqlite3` diverge enough that the shared adapter becomes misleading.
- Shared cache storage introduces privacy or isolation concerns that require changing the project/global settings split.
