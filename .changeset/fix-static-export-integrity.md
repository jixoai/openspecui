---
'@openspecui/web': patch
'openspecui': patch
---

Repair four static-export defects from #319. Content containing `$'`, `` $` ``, `$&` or `$$` no longer corrupts an exported page: the template insertion step now passes replacer functions instead of replacement strings, so the bootstrap JSON is preserved byte-for-byte, and a template that loses a placeholder fails loudly instead of silently dropping content. `--base-path` now reaches emitted references — template attributes, rendered markup and Vite-emitted chunks/fonts — where previously only the router saw it; the rewrite is bounded so snapshot text that merely mentions an asset path is untouched. The SSG CLI loads its server entry through a `file:` URL, so Windows drive-letter paths no longer fail in the ESM loader. Client navigation normalizes a rendered link's href before navigating, so a sub-path deployment no longer doubles the base path (`/docs/docs/specs`).
