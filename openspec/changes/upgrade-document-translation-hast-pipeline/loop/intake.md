## User Input

- BUG: If source Markdown contains `### 1. Research and Planning`, document translation currently translates `1. Research and Planning`, then re-parses it as Markdown/HTML and turns it into `ol > li > Research and Planning`.
- The translation pipeline should be reconsidered as `rawMd -> [mdAstProcess] -> md -> md2html -> rawHtml -> [htmlAstProcess] -> html`, with the translation plugin working in `htmlAstProcess`.
- Prefer the architecture path that upgrades the platform law instead of local escaping or page-level patches.
- The discussion itself is part of the design process, and this OpenSpec change must be written while the architecture discussion continues.
- The intended placeholder protocol can serialize inline HTML structure for Translator input, for example mapping `I <b ...attrs>love</b> you` into `I <i1>love</i1> you`, using ordered synthetic tags that the Translator API preserves.
- Attribute values with user-visible semantics, such as `title` and `alt`, should be translatable. One candidate protocol is mapping attributes into synthetic attributes, for example `i <x1 a1=" forever ">love</x1> you`, allowing Translator output such as `我 <x1 a1=" 永远">爱</x1>你`.
- `a` text should not be special-cased away from normal inline translation; link text can be translated through the same placeholder protocol while protected attributes such as `href` remain outside translator control.
- `code`, `kbd`, and `samp` should still be translated, but their display policy should differ from normal prose: direct translated mode may show source by default and translated text on hover, while bilingual mode may append translated text because source is already visible.
- Abnormal translator output and structural recovery fallback are important design requirements.
- Translation cache should prefer backend SQLite. Use `better-sqlite3` on Node and `bun:sqlite` on Bun because their APIs are similar enough for a shared adapter layer.
- Translation cache database should live in the user cache directory and be shared by all projects.
- Cache capacity and related cache settings should be global settings stored in `~/.openspecui/settings.json`.
- Cache enablement remains project-managed: enabling translation cache in project A must not enable it in project B, but if multiple projects enable it they should use the same shared cache database.

## Objective Scope

- Redesign document translation as a HAST/HTML-AST-stage projection instead of re-parsing translated Markdown snippets.
- Define a typed Markdown rendering pipeline with distinct Markdown AST processing, HAST processing, and React rendering stages.
- Define a placeholder fragment protocol for translating HAST phrasing content while preserving original inline structure, attributes, source mapping, and rendering policy.
- Preserve inline semantic structure inside headings, links, emphasis, code-like nodes, and other phrasing content without allowing translated text to create new Markdown block structure.
- Keep translation as a browser-side projection and preserve source Markdown as the single document truth.
- Add or use a real global settings structure for OpenSpecUI user-level settings if one does not already exist.
- Separate global cache policy from project-level cache enablement.

## Non-Goals

- Do not implement a page-local escape rule for ordered lists, headings, bullets, or other Markdown syntax.
- Do not persist translated content as a second source document.
- Do not allow Translator output to directly introduce untrusted HTML tags, event handlers, URLs, or arbitrary attributes.
- Do not treat `rawHtml` string generation as the new source of truth for rendering; raw HTML may only be an internal, validated fragment representation if needed by the translation protocol.
- Do not change unrelated archive, Vite, release, or static-export behavior in this loop.
- Do not store the shared translation cache database or global cache settings in source-controlled project directories.

## Acceptance Boundary

- A heading such as `### 1. Research and Planning` remains a heading after translation; translated content must not create `ol > li`.
- A heading containing inline structure, such as `### **1. Research** and `Planning``, preserves the heading and inline semantic nodes through translation projection.
- Link text is translated through the same inline placeholder protocol as other phrasing content, while non-translatable link attributes such as `href` remain protected.
- User-visible attributes such as `title` and `alt` have a defined translation path and restoration rule.
- `code`, `kbd`, and `samp` have explicit translation and display policies for direct and bilingual modes.
- Translator output is validated before restoration; malformed, mismatched, unknown, or unsafe placeholder output falls back without corrupting the document surface.
- Project-level settings control whether a project uses translation cache.
- Global settings control shared cache capacity and cache management defaults.
