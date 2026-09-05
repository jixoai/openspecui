/**
 * jixoai llms-txt — build-time llms.txt / llms-full.txt / per-page .md
 * generator for the jixoai website scaffold.
 *
 * Original need (2026-08-22, user): the scaffold must natively export
 * llms.txt / llms-full.txt (llmstxt.org proposal v2) because jixoai sites
 * are AI-friendly by design; the user explicitly prefers a build plugin
 * over a routing takeover. Converged design (ZCode + Codex review,
 * 2026-08-22): scan the FINAL static dist, never the routing layer.
 *
 * Intents (orthogonal, ≤5 — single-file compromise: registry distribution
 * ships ONE file to vite-plugins/llms-txt.mjs; a later core/adapter split
 * must keep the item name and this public contract unchanged):
 *   1. tokenizer + whitelist HTML→Markdown converter (stack-based, no regex chains)
 *   2. page extraction (main→body fallback, metadata, chrome stripping)
 *   3. dist scan + URL mapping + config resolution (locales, sections)
 *   4. index/full composition + staged all-or-nothing, byte-deterministic writes
 *   5. vite plugin adapter (SSR closeBundle only — SvelteKit runs the
 *      adapter in its own sequential closeBundle before post plugins)
 *
 * Laws (Codex review, binding):
 *   - only touch DECLARED outputs (llms.txt, llms-full.txt, <page>.md for
 *     included pages); never delete anything, never rewrite robots/sitemap
 *   - absolute URLs by default (relative paths are the ecosystem's most
 *     common llms.txt defect); root-relative is an explicit opt-in
 *   - every generated .md starts with a provenance marker; a hand-written
 *     .md at a target path is a hard conflict, never overwritten
 *   - llms-full.txt has a size cap; exceeding it fails loudly (no silent
 *     truncation). It is a community extension, not part of the proposal.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

/* --------------------------------------------------------------------------
 * 1. tokenizer + tree builder
 * ------------------------------------------------------------------------ */

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/** Elements whose entire subtree is UI chrome, payloads, or non-text media. */
/** Elements whose entire subtree is UI chrome, payloads, or non-text media.
 * `button` is chrome too: interactive control labels ("copy usage", "Code",
 * playground toggles) are noise for LLM consumption — the same semantics
 * live in the surrounding prose and usage code. */
const STRIP_ELEMENTS = new Set([
  'script', 'style', 'nav', 'header', 'footer', 'aside', 'form',
  'svg', 'noscript', 'template', 'iframe', 'canvas', 'video',
  'audio', 'picture', 'object', 'embed', 'select', 'textarea', 'input',
  'button',
]);

/** Attribute-level chrome: decorative-by-contract (aria-hidden) and
 * inert-by-contract (collapsed panels like the code drawer — their content
 * duplicates what the page shows in its open sections). */
function isChromeElement(node) {
  return (
    node.type === 'element' &&
    (STRIP_ELEMENTS.has(node.name) ||
      node.attrs['aria-hidden'] === 'true' ||
      node.attrs['inert'] !== undefined)
  );
}

const NAMED_ENTITIES = {
  amp: '&', lt: '<', le: '≤', gt: '>', ge: '≥', quot: '"', apos: "'",
  nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»',
  larr: '←', rarr: '→', uarr: '↑', darr: '↓', copy: '©', reg: '®',
  trade: '™', deg: '°', middot: '·', bull: '•', times: '×', divide: '÷',
  plusmn: '±', sup2: '²', sup3: '³', frac12: '½', frac14: '¼',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', eacute: 'é',
  egrave: 'è', agrave: 'à', ccedil: 'ç', uuml: 'ü', ouml: 'ö', auml: 'ä',
  szlig: 'ß', ntilde: 'ñ', sect: '§', para: '¶', dagger: '†', prime: '′',
  ensp: ' ', emsp: ' ', thinsp: ' ', zwj: '‍', zwnj: '‌',
};

export function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (whole, name) =>
      Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name.toLowerCase())
        ? NAMED_ENTITIES[name.toLowerCase()]
        : whole,
    );
}

function safeCodePoint(code) {
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff
    ? String.fromCodePoint(code)
    : '';
}

/** Find the '>' that closes a tag, honoring quoted attribute values. */
function findTagEnd(html, from) {
  let quote = '';
  for (let i = from; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return i;
    }
  }
  return -1;
}

function parseAttrs(source) {
  const attrs = {};
  const pattern = /([:a-zA-Z_][-:a-zA-Z0-9_]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attrs;
}

/**
 * Linear tokenizer: yields {type:'text'|'open'|'close', ...} events.
 * Malformed markup degrades to text or ignored stray closes — the
 * converter is a whitelist, so unknown shapes can never leak raw HTML.
 */
export function* tokenizeHtml(html) {
  const n = html.length;
  let i = 0;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      if (i < n) yield { type: 'text', text: html.slice(i) };
      return;
    }
    if (lt > i) yield { type: 'text', text: html.slice(i, lt) };
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (html.startsWith('<!', lt) || html.startsWith('<?', lt)) {
      const end = html.indexOf('>', lt);
      i = end === -1 ? n : end + 1;
      continue;
    }
    if (html.startsWith('</', lt)) {
      const gt = html.indexOf('>', lt);
      const name = html.slice(lt + 2, gt === -1 ? n : gt).trim().toLowerCase();
      i = gt === -1 ? n : gt + 1;
      if (/^[a-z][^\s/>]*$/.test(name)) yield { type: 'close', name };
      continue;
    }
    const nameMatch = /^<([a-zA-Z][^\s/>]*)/.exec(html.slice(lt, lt + 80));
    if (!nameMatch) {
      yield { type: 'text', text: '<' };
      i = lt + 1;
      continue;
    }
    const gt = findTagEnd(html, lt);
    if (gt === -1) {
      i = n;
      continue;
    }
    const inner = html.slice(lt + 1 + nameMatch[1].length, gt);
    const name = nameMatch[1].toLowerCase();
    yield {
      type: 'open',
      name,
      attrs: parseAttrs(inner.replace(/\/\s*$/, '')),
      selfClosing: /\/\s*$/.test(inner) || VOID_ELEMENTS.has(name),
    };
    i = gt + 1;
  }
}

/**
 * Build a light element tree from tokenizer events. Unmatched closes pop
 * to the nearest matching open; unclosed tags close at the end. A
 * forgiving stack builder, not a validator.
 */
export function parseFragment(html) {
  const root = { type: 'root', children: [] };
  const stack = [root];
  for (const token of tokenizeHtml(html)) {
    const top = stack[stack.length - 1];
    if (token.type === 'text') {
      top.children.push({ type: 'text', text: token.text });
    } else if (token.type === 'open') {
      const node = { type: 'element', name: token.name, attrs: token.attrs, children: [] };
      top.children.push(node);
      if (!token.selfClosing) stack.push(node);
    } else {
      let depth = -1;
      for (let s = stack.length - 1; s > 0; s--) {
        if (stack[s].name === token.name) {
          depth = s;
          break;
        }
      }
      if (depth > 0) stack.length = depth;
    }
  }
  return root;
}

/* --------------------------------------------------------------------------
 * 2. whitelist HTML→Markdown converter
 * ------------------------------------------------------------------------ */

/** Safe link protocols / forms; everything else is dropped to plain text. */
function safeHref(href, baseUrl) {
  const value = href?.trim();
  if (!value) return null;
  if (value.startsWith('//')) return null; // protocol-relative: scheme-less off-site
  if (/^(https?:|mailto:)/i.test(value)) return value;
  if (value.startsWith('/') || value.startsWith('#')) return value;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return null; // javascript:, data:, vbscript:, …
  if (baseUrl) {
    try {
      return new URL(value, baseUrl).href;
    } catch {
      return null;
    }
  }
  return value;
}

/** Minimal escaping: structure-breaking characters only. LLM readability
 * beats full GFM escaping — stray emphasis markers are harmless noise. */
function escapeText(text, inTable) {
  let out = text.replace(/\\/g, '\\\\');
  if (inTable) out = out.replace(/\|/g, '\\|');
  return out;
}

function collapseInline(text) {
  return decodeEntities(text).replace(/[ \t\r\n]+/g, ' ');
}

/** Verbatim text of a subtree (code blocks): keeps whitespace, decodes
 * entities. Shiki line spans are line boundaries: adjacent `.line` spans
 * the markup did not separate with a real newline get one, so code never
 * collapses into a single line. */
function textOf(nodes) {
  let out = '';
  let afterLineSpan = false;
  for (const node of nodes) {
    if (node.type === 'text') {
      out += decodeEntities(node.text);
      afterLineSpan = false;
    } else if (node.name === 'br') {
      out += '\n';
      afterLineSpan = false;
    } else {
      const isLine = /(?:^|\s)line(?:\s|$)/.test(node.attrs['class'] || '');
      if (afterLineSpan && isLine && !out.endsWith('\n')) out += '\n';
      out += textOf(node.children);
      afterLineSpan = isLine;
    }
  }
  return out;
}

function detectLanguage(node) {
  const candidates = [node, ...node.children.filter((c) => c.type === 'element')];
  for (const candidate of candidates) {
    const direct = candidate.attrs['data-lang'] || candidate.attrs['lang'];
    if (direct) return direct;
    const klass = candidate.attrs['class'] || '';
    const match = /(?:^|\s)(?:language|lang)-([^\s]+)/.exec(klass);
    if (match) return match[1];
  }
  return '';
}

function codeFence(raw) {
  const longest = Math.max(3, ...(raw.match(/`+/g) || []).map((run) => run.length + 1));
  return '`'.repeat(longest);
}

/** Convert an inline run (headings, cells, link text) to a single line. */
function inlineOf(nodes, ctx) {
  let out = '';
  for (const node of nodes) {
    if (node.type === 'text') {
      out += escapeText(collapseInline(node.text), ctx.inTable);
      continue;
    }
    const { name, attrs, children } = node;
    if (isChromeElement(node)) continue;
    if (name === 'br') {
      out += ' ';
    } else if (name === 'a') {
      const href = safeHref(attrs['href'], ctx.baseUrl);
      const label = inlineOf(children, ctx).trim();
      out += href && label ? `[${label}](${href})` : label;
    } else if (name === 'img') {
      const alt = collapseInline(attrs['alt'] || '').trim();
      const src = safeHref(attrs['src'], ctx.baseUrl);
      // data: URIs are unverifiable inline blobs — the alt text is the content.
      out += src ? `![${alt}](${src})` : alt;
    } else if (name === 'code') {
      const raw = textOf(children).replace(/\n+$/, '');
      const tick = raw.includes('`') ? '``' : '`';
      out += `${tick}${raw}${tick}`;
    } else if (name === 'strong' || name === 'b') {
      const label = inlineOf(children, ctx).trim();
      out += label ? `**${label}**` : '';
    } else if (name === 'em' || name === 'i') {
      const label = inlineOf(children, ctx).trim();
      out += label ? `_${label}_` : '';
    } else if (name === 'del' || name === 's') {
      const label = inlineOf(children, ctx).trim();
      out += label ? `~~${label}~~` : '';
    } else {
      out += inlineOf(children, ctx);
    }
  }
  return out.replace(/ {2,}/g, ' ');
}

function convertList(node, ctx, depth) {
  const indent = '  '.repeat(depth);
  const ordered = node.name === 'ol';
  let index = parseInt(node.attrs['start'] || '1', 10) || 1;
  const items = [];
  for (const child of node.children) {
    if (child.type !== 'element') continue;
    if (child.name === 'li') {
      // Tight lists: a nested list or paragraph inside an item stays on
      // the item's own line chain (no blank lines inside a list).
      const raw = childrenToMarkdown(child.children, { ...ctx, inTable: false })
        .trim()
        .replace(/\n{2,}/g, '\n');
      const marker = ordered ? `${index++}. ` : '- ';
      const body = raw
        .split('\n')
        .map((line, lineIndex) =>
          lineIndex === 0 || line === '' ? line : ' '.repeat(marker.length) + line,
        )
        .join('\n');
      items.push(indent + marker + body);
    } else if (child.name === 'ul' || child.name === 'ol') {
      items.push(convertList(child, ctx, depth + 1).trim());
    }
  }
  return `\n\n${items.join('\n')}\n`;
}

function convertTable(node, ctx) {
  const rows = [];
  let irregular = false;
  const collect = (tr) => {
    const cells = [];
    for (const cell of tr.children) {
      if (cell.type !== 'element' || (cell.name !== 'td' && cell.name !== 'th')) continue;
      if (cell.attrs['colspan'] || cell.attrs['rowspan']) irregular = true;
      cells.push(inlineOf(cell.children, { ...ctx, inTable: true }).trim());
    }
    if (cells.length) rows.push(cells);
  };
  const walk = (element) => {
    for (const child of element.children) {
      if (child.type !== 'element') continue;
      if (child.name === 'tr') collect(child);
      else if (child.name !== 'td' && child.name !== 'th') walk(child);
    }
  };
  walk(node);
  if (!rows.length) return '\n';
  if (irregular) {
    // Colspan/rowspan tables cannot become correct GFM: degrade to one
    // bullet per row instead of emitting a wrong grid.
    const lines = rows.map((cells) => `- ${cells.map((c) => c || '·').join(' — ')}`);
    return `\n\n${lines.join('\n')}\n`;
  }
  const width = Math.max(...rows.map((cells) => cells.length));
  const padded = rows.map((cells) => {
    const copy = [...cells];
    while (copy.length < width) copy.push('');
    return copy;
  });
  const [header, ...body] = padded;
  const line = (cells) => `| ${cells.join(' | ')} |`;
  return `\n\n${line(header)}\n${line(Array.from({ length: width }, () => '---'))}\n${body.map(line).join('\n')}\n`;
}

/** Convert the children of one node into block markdown. */
function childrenToMarkdown(nodes, ctx) {
  let out = '';
  for (const node of nodes) {
    out += nodeToMarkdown(node, ctx);
  }
  return out;
}

function nodeToMarkdown(node, ctx) {
  if (node.type === 'text') {
    const collapsed = collapseInline(node.text);
    return collapsed === ' ' ? '\n' : escapeText(collapsed, ctx.inTable);
  }
  const { name, attrs, children } = node;
  if (isChromeElement(node)) return '';

  if (name === 'pre') {
    // Raw fidelity: leading/trailing newlines and indentation survive
    // verbatim (only the fence separators are added); the closing fence
    // needs exactly one preceding newline.
    const raw = textOf(children);
    const body = raw.endsWith('\n') ? raw : `${raw}\n`;
    const fence = codeFence(raw);
    return `\n\n${fence}${detectLanguage(node)}\n${body}${fence}\n`;
  }
  if (name === 'code') {
    return inlineOf([node], ctx); // bare <code> outside <pre>: inline code
  }

  switch (name) {
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
      const label = inlineOf(children, ctx).trim();
      return label ? `\n\n${'#'.repeat(Number(name[1]))} ${label}\n` : '';
    }
    case 'p': {
      const label = inlineOf(children, ctx).trim();
      return label ? `\n\n${label}\n` : '\n';
    }
    case 'hr':
      return '\n\n---\n';
    case 'br':
      return '\n';
    case 'blockquote': {
      const inner = childrenToMarkdown(children, ctx).trim().replace(/\n{2,}/g, '\n\n');
      return inner
        ? `\n\n${inner.split('\n').map((line) => `> ${line}`.trimEnd()).join('\n')}\n`
        : '';
    }
    case 'ul': case 'ol':
      return convertList(node, ctx, 0);
    case 'table':
      return convertTable(node, ctx);
    case 'dt': {
      const label = inlineOf(children, ctx).trim();
      return label ? `\n\n**${label}**\n` : '';
    }
    case 'dd': {
      const label = inlineOf(children, ctx).trim();
      return label ? `${label}\n` : '';
    }
    case 'summary': {
      const label = inlineOf(children, ctx).trim();
      return label ? `\n\n**${label}**\n` : '';
    }
    default:
      // Inline-level elements stay inline; block containers (div/section/
      // main/figure/details/…) and unknown custom elements are transparent
      // but keep block separation so sibling containers never merge lines.
      return `\n${childrenToMarkdown(children, ctx)}\n`;
  }
}

/** Public converter: fragment → deterministic markdown (UTF-8, LF, one trailing newline). */
export function htmlToMarkdown(rootNode, options = {}) {
  const ctx = { baseUrl: options.baseUrl || '', inTable: false };
  const raw = childrenToMarkdown(rootNode.children ?? rootNode, ctx);
  // Blank-line runs collapse to one blank line — but never inside fenced
  // code blocks, whose raw newline layout is preserved verbatim.
  const fences = [];
  const sheltered = raw.replace(
    /(^|\n)(`{3,}[^\n]*\n[\s\S]*?\n`{3,})(?=\n|$)/g,
    (whole, lead, block) => {
      fences.push(block);
      return `${lead}\u0000llms-fence-${fences.length - 1}\u0000`;
    },
  );
  const normalized = sheltered
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\u0000llms-fence-(\d+)\u0000/g, (_, index) => fences[Number(index)])
    .trim();
  return normalized ? `${normalized}\n` : '';
}

/* --------------------------------------------------------------------------
 * 3. page extraction + dist scan + URL mapping
 * ------------------------------------------------------------------------ */

function findFirst(node, name) {
  for (const child of node.children ?? []) {
    if (child.type === 'element') {
      if (child.name === name) return child;
      const found = findFirst(child, name);
      if (found) return found;
    }
  }
  return null;
}

function collectMetas(node, into = []) {
  for (const child of node.children ?? []) {
    if (child.type === 'element') {
      if (child.name === 'meta') into.push(child.attrs);
      collectMetas(child, into);
    }
  }
  return into;
}

/** Strip chrome subtrees in place: STRIP_ELEMENTS plus aria-hidden /
 * inert regions (chrome, payloads, media, decorative spans, collapsed
 * panels). */
function stripChrome(node) {
  node.children = (node.children ?? []).filter((child) => {
    if (child.type === 'element') {
      if (isChromeElement(child)) return false;
      stripChrome(child);
    }
    return true;
  });
  return node;
}

/**
 * Extract the LLM-relevant page: content root is <main> (fallback
 * <body>), metadata from <title>/<meta description>/<h1>. Pages marked
 * noindex are flagged so the generator can skip them.
 */
export function extractPage(html) {
  const tree = parseFragment(html);
  const titleEl = findFirst(tree, 'title');
  const metas = collectMetas(tree);
  const description = metas
    .find((attrs) => (attrs['name'] || '').toLowerCase() === 'description');
  const robots = metas
    .find((attrs) => (attrs['name'] || '').toLowerCase() === 'robots');
  let content = findFirst(tree, 'main') ?? findFirst(tree, 'body') ?? tree;
  content = stripChrome(content);
  const h1 = findFirst(content, 'h1');
  return {
    title: titleEl ? collapseInline(textOf(titleEl.children)).trim() : '',
    description: description ? collapseInline(description['content'] || '').trim() : '',
    noindex: robots ? /noindex/i.test(robots['content'] || '') : false,
    h1: h1 ? inlineOf(h1.children, { baseUrl: '', inTable: false }).trim() : '',
    contentNode: content,
  };
}

/** index.html → '/', docs/index.html → '/docs/', a/b.html → '/a/b' */
export function pageUrlFromRel(rel) {
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel.replace(/\.html?$/i, '')}`;
}

function mdRelFromRel(rel) {
  return rel.replace(/\.html?$/i, '.md');
}

/** Minimal glob → anchored RegExp: `**` spans separators, `*`/`?` do not. */
export function globToRegExp(glob) {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        source += '.*';
        i++;
        if (glob[i + 1] === '/') i++; // '**/' also swallows the slash
      } else {
        source += '[^/]*';
      }
    } else if (ch === '?') {
      source += '[^/]';
    } else {
      source += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

function matchAny(rel, globs) {
  return globs.some((glob) => globToRegExp(glob).test(rel));
}

/** Recursively list *.html files under dir as POSIX paths relative to it. */
function listHtmlFiles(dir, prefix = '') {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (error) {
    throw new Error(`[llms-txt] cannot read dist directory: ${dir} (${error.message})`);
  }
  for (const entry of entries.sort()) {
    const full = path.join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(full).isDirectory()) {
      out.push(...listHtmlFiles(full, rel));
    } else if (/\.html?$/i.test(entry)) {
      out.push(rel);
    }
  }
  return out;
}

/* --------------------------------------------------------------------------
 * 4. composition + staged all-or-nothing deterministic writes
 * ------------------------------------------------------------------------ */

const MD_MARKER_PREFIX = '<!-- generated by jixoai llms-txt · do not edit';

function mdMarker(sourceUrl) {
  return `${MD_MARKER_PREFIX} · source: ${sourceUrl} -->\n\n`;
}

function truncateDescription(text, max = 200) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space > max * 0.6 ? space : max).trimEnd()}…`;
}

function joinUrl(siteUrl, pagePath) {
  return `${siteUrl.replace(/\/+$/, '')}${pagePath}`;
}

function composeIndexBody(config, sections) {
  const lines = [`# ${config.title}`, '', `> ${config.summary}`, ''];
  for (const section of sections) {
    if (!section.entries.length) continue;
    lines.push(`## ${section.title}`, '');
    for (const entry of section.entries) {
      lines.push(
        entry.description
          ? `- [${entry.title}](${entry.link}): ${entry.description}`
          : `- [${entry.title}](${entry.link})`,
      );
    }
    lines.push('');
  }
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

/**
 * Generate llms.txt (+ per-locale variants), per-page .md mirrors and
 * llms-full.txt from a FINAL static dist directory.
 *
 * @param {string} distDir - absolute or cwd-relative path to the built site
 * @param {object} config - schema: skills/jixoai-website/references/llms-txt.md
 * @returns {{pages: number, files: {path: string, bytes: number}[], skipped: string[]}}
 */
export function generateLlmsTxt(distDir, config) {
  if (!config || typeof config !== 'object') {
    throw new Error('[llms-txt] config object is required');
  }
  let siteUrl;
  try {
    siteUrl = new URL(config.siteUrl).href.replace(/\/+$/, '');
  } catch {
    throw new Error(`[llms-txt] config.siteUrl must be an absolute URL (got: ${config.siteUrl})`);
  }
  const rootDir = path.resolve(distDir);
  if (!existsSync(rootDir)) {
    throw new Error(`[llms-txt] dist directory does not exist: ${rootDir}`);
  }

  const include = config.include ?? ['**/*.html'];
  const exclude = config.exclude ?? ['404.html'];
  const linkStyle = config.linkStyle ?? 'absolute';
  const perPageMarkdown = config.perPageMarkdown ?? true;
  const full = { enabled: true, maxBytes: 10_000_000, ...(config.full ?? {}) };
  const locale = config.locale ?? null;

  // ---- scan + extract ------------------------------------------------------
  const skipped = [];
  const pages = listHtmlFiles(rootDir)
    .filter((rel) => matchAny(rel, include) && !matchAny(rel, exclude))
    .map((rel) => {
      const page = extractPage(readFileSync(path.join(rootDir, ...rel.split('/')), 'utf8'));
      if (page.noindex) skipped.push(rel);
      const pageUrl = pageUrlFromRel(rel);
      // The .md link derives from the MIRROR path (mdRelFromRel), never
      // from the canonical page URL: a directory index (docs/index.html
      // → /docs/) would otherwise link /docs/.md while the mirror lands
      // at docs/index.md.
      const mdUrl = `/${mdRelFromRel(rel)}`;
      return {
        rel,
        pageUrl,
        link: linkStyle === 'absolute' ? joinUrl(siteUrl, mdUrl) : mdUrl,
        sourceUrl: joinUrl(siteUrl, pageUrl),
        baseUrl: joinUrl(siteUrl, pageUrl === '/' ? '/' : pageUrl),
        title: page.h1 || page.title || pageUrl,
        description: truncateDescription(page.description),
        noindex: page.noindex,
        body: '',
        contentNode: page.contentNode,
      };
    })
    .filter((page) => !page.noindex);

  // ---- section assignment (first matching section wins) --------------------
  const sectionDefs = config.sections ?? null;
  const fallbackTitle = sectionDefs ? 'Pages' : 'Docs';
  const buckets = new Map();
  const bucketFor = (page) => {
    if (!sectionDefs) return fallbackTitle;
    for (const section of sectionDefs) {
      if (matchAny(page.rel, section.include ?? [])) return section.title;
    }
    return fallbackTitle;
  };
  for (const page of pages) {
    const title = bucketFor(page);
    if (!buckets.has(title)) buckets.set(title, []);
    buckets.get(title).push(page);
  }
  const sectionOrder = [
    ...(sectionDefs?.map((section) => section.title) ?? []),
    fallbackTitle,
  ].filter((title, index, all) => all.indexOf(title) === index && buckets.has(title));

  // ---- additional entries (e.g. machine-readable registry) -----------------
  for (const entry of config.additionalEntries ?? []) {
    // Config URLs pass the same safety gate as page links, restricted to
    // absolute http(s)/mailto or root-relative site paths.
    const safe = safeHref(entry.url, null);
    const valid = safe && (/^https?:/i.test(safe) || safe.startsWith('mailto:') || safe.startsWith('/'));
    if (!valid) {
      throw new Error(
        `[llms-txt] additionalEntries url must be absolute http(s)/mailto or root-relative` +
          ` (got: ${entry.url} for "${entry.name}")`,
      );
    }
    // Off-site http(s)/mailto URLs are used verbatim in both link styles;
    // only root-relative site paths join against siteUrl.
    const isOffsite = /^https?:/i.test(safe) || safe.startsWith('mailto:');
    const link = isOffsite ? safe : linkStyle === 'absolute' ? joinUrl(siteUrl, safe) : safe;
    const title = entry.optional ? 'Optional' : entry.section || 'Optional';
    if (!buckets.has(title)) {
      buckets.set(title, []);
      sectionOrder.push(title);
    }
    buckets.get(title).push({
      isStatic: true,
      title: entry.name,
      link,
      description: entry.description ?? '',
    });
  }

  const buildSections = (pageList) => {
    const inList = new Set(pageList);
    return sectionOrder
      .map((title) => ({
        title,
        entries: (buckets.get(title) ?? []).filter(
          (entry) => entry.isStatic || inList.has(entry),
        ),
      }))
      .filter((section) => section.entries.length > 0);
  };

  // ---- convert bodies --------------------------------------------------------
  for (const page of pages) {
    page.body = htmlToMarkdown(page.contentNode, { baseUrl: page.baseUrl });
  }

  // ---- compose outputs ---------------------------------------------------------
  const outputs = []; // {rel, content}
  let fullPages = pages;

  if (!locale) {
    outputs.push({ rel: 'llms.txt', content: composeIndexBody(config, buildSections(pages)) });
  } else {
    const segments = locale.segments;
    const grouped = Object.fromEntries(segments.map((segment) => [segment, []]));
    const unsegmented = [];
    for (const page of pages) {
      const segment = segments.find(
        (seg) => page.rel === `${seg}.html` || page.rel.startsWith(`${seg}/`),
      );
      (segment ? grouped[segment] : unsegmented).push(page);
    }
    // Every locale gets its own stable index URL; the root index repeats
    // the default locale and links the others.
    for (const segment of segments) {
      outputs.push({
        rel: `${segment}/llms.txt`,
        content: composeIndexBody(config, buildSections(grouped[segment])),
      });
    }
    const defaultPages = [...(grouped[locale.default] ?? []), ...unsegmented];
    const defaultSections = buildSections(defaultPages);
    const others = segments
      .filter((segment) => segment !== locale.default)
      .map((segment) => ({
        isStatic: true,
        title: `llms.txt (${segment})`,
        link: joinUrl(siteUrl, `/${segment}/llms.txt`),
        description: `The ${segment} edition of this index.`,
      }));
    if (others.length) defaultSections.push({ title: 'Other languages', entries: others });
    outputs.push({ rel: 'llms.txt', content: composeIndexBody(config, defaultSections) });
    // llms-full.txt follows the default locale only (a mixed-language dump
    // defeats retrieval); every locale still gets its per-page .md mirrors.
    fullPages = defaultPages;
  }

  if (perPageMarkdown) {
    for (const page of pages) {
      outputs.push({
        rel: mdRelFromRel(page.rel),
        content: `${mdMarker(page.sourceUrl)}${page.body}`,
      });
    }
  }

  if (full.enabled) {
    const indexText = outputs.find((output) => output.rel === 'llms.txt').content;
    const parts = [indexText];
    for (const page of fullPages) {
      parts.push(`\n---\n\n# ${page.title}\n\n${page.sourceUrl}\n\n${page.body}`);
    }
    outputs.push({ rel: 'llms-full.txt', content: parts.join('') });
  }

  // ---- guards BEFORE any write --------------------------------------------------
  // A run is all-or-nothing: duplicate targets, hand-written .md conflicts,
  // unwritable declared outputs, and size-cap violations all abort while
  // the dist is still untouched.
  const duplicateIssues = [];
  const seenPageUrls = new Map();
  const seenMdRels = new Map();
  for (const page of pages) {
    if (seenPageUrls.has(page.pageUrl)) {
      duplicateIssues.push(
        `${page.rel} and ${seenPageUrls.get(page.pageUrl)} both map to ${page.pageUrl}`,
      );
    } else {
      seenPageUrls.set(page.pageUrl, page.rel);
    }
    if (perPageMarkdown) {
      const mdRel = mdRelFromRel(page.rel);
      if (seenMdRels.has(mdRel)) {
        duplicateIssues.push(`${page.rel} and ${seenMdRels.get(mdRel)} both write ${mdRel}`);
      } else {
        seenMdRels.set(mdRel, page.rel);
      }
    }
  }
  if (duplicateIssues.length) {
    throw new Error(`[llms-txt] duplicate page/mirror targets: ${duplicateIssues.join('; ')}`);
  }

  const isDirectory = (file) => {
    try {
      return statSync(file).isDirectory();
    } catch {
      return false;
    }
  };
  const conflicts = [];
  for (const output of outputs) {
    const file = path.join(rootDir, ...output.rel.split('/'));
    if (!existsSync(file)) continue;
    if (isDirectory(file)) {
      conflicts.push(`${output.rel} (a directory occupies the output path)`);
      continue;
    }
    if (output.rel.endsWith('.md') && !readFileSync(file, 'utf8').startsWith(MD_MARKER_PREFIX)) {
      conflicts.push(`${output.rel} (hand-written markdown)`);
    }
  }
  if (conflicts.length) {
    throw new Error(
      `[llms-txt] refusing to touch conflicting outputs: ${conflicts.join(', ')}` +
        ' (move the file or adjust include/exclude)',
    );
  }
  const fullOutput = outputs.find((output) => output.rel === 'llms-full.txt');
  if (fullOutput) {
    const bytes = Buffer.byteLength(fullOutput.content, 'utf8');
    if (bytes > full.maxBytes) {
      throw new Error(
        `[llms-txt] llms-full.txt is ${bytes}B, over the ${full.maxBytes}B cap — exclude` +
          ' playground pages, disable full.enabled, or raise full.maxBytes',
      );
    }
  }

  // ---- staged commit: all-or-nothing ------------------------------------------------
  // Every output is written into a run-unique staging directory first;
  // the commit backs up existing targets, renames staged files into place,
  // and rolls everything back if any step fails — a failed run never
  // leaves half a documentation set behind.
  const runId = `${process.pid.toString(36)}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const stagingDir = path.join(rootDir, `.llms-txt-staging-${runId}`);
  const report = { pages: pages.length, files: [], skipped };
  try {
    mkdirSync(stagingDir, { recursive: true });
    for (const output of outputs) {
      const staged = path.join(stagingDir, ...output.rel.split('/'));
      mkdirSync(path.dirname(staged), { recursive: true });
      writeFileSync(staged, output.content, 'utf8');
    }
    const backups = [];
    const created = [];
    const createdDirs = [];
    try {
      outputs.forEach((output, outputIndex) => {
        const target = path.join(rootDir, ...output.rel.split('/'));
        // Test seam (NOT a public config field — never set by real builds;
        // tests only): fail the commit after N successful target renames,
        // so the rollback path stays covered by automated fixtures instead
        // of only by manual fault injection.
        if (config.__testFailCommitAfter !== undefined && outputIndex > config.__testFailCommitAfter) {
          throw new Error(`injected commit failure after target ${config.__testFailCommitAfter}`);
        }
        const parent = path.dirname(target);
        if (!existsSync(parent)) {
          mkdirSync(parent, { recursive: true });
          createdDirs.push(parent);
        }
        if (existsSync(target)) {
          const backup = path.join(stagingDir, '.backup', ...output.rel.split('/'));
          mkdirSync(path.dirname(backup), { recursive: true });
          renameSync(target, backup);
          backups.push([target, backup]);
        } else {
          created.push(target);
        }
        renameSync(path.join(stagingDir, ...output.rel.split('/')), target);
      });
    } catch (error) {
      const rollbackErrors = [];
      for (const [target, backup] of backups) {
        try {
          renameSync(backup, target);
        } catch (restoreError) {
          rollbackErrors.push(`restore ${target}: ${restoreError.message}`);
        }
      }
      for (const target of created) {
        try {
          rmSync(target, { force: true });
        } catch (removeError) {
          rollbackErrors.push(`remove ${target}: ${removeError.message}`);
        }
      }
      // deepest-first, so an aborted run leaves no empty directory shell
      for (const dir of createdDirs.sort((a, b) => b.length - a.length)) {
        try {
          rmdirSync(dir); // throws if missing or non-empty — both fine here
        } catch {
          /* non-empty or already gone — nothing we created remains inside */
        }
      }
      const suffix = rollbackErrors.length
        ? ` (ROLLBACK INCOMPLETE: ${rollbackErrors.join('; ')})`
        : '';
      throw new Error(`[llms-txt] commit failed and was rolled back: ${error.message}${suffix}`);
    }
    for (const output of outputs) {
      report.files.push({ path: output.rel, bytes: Buffer.byteLength(output.content, 'utf8') });
    }
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
  }
  report.files.sort((a, b) => (a.path < b.path ? -1 : 1));
  return report;
}

/* --------------------------------------------------------------------------
 * 5. vite plugin adapter
 * ------------------------------------------------------------------------ */

/**
 * Vite adapter for plain `vite build` sites (e.g. openspecui website).
 * Runs generateLlmsTxt in the SSR build's closeBundle — after SvelteKit's
 * adapter (enforce 'pre', sequential closeBundle) has written the final
 * dist. Orchestrated sites (unipty-style build scripts) should call
 * generateLlmsTxt directly as their LAST step instead of using this
 * plugin: post-build artifact injection means vite never owns the final dist.
 *
 * @param {object & {distDir?: string}} options - generateLlmsTxt config plus
 *        distDir, resolved against the vite root (default 'dist').
 */
export function llmsTxt(options = {}) {
  let resolved = null;
  return {
    name: 'jixoai:llms-txt',
    enforce: 'post',
    configResolved(config) {
      resolved = config;
    },
    closeBundle() {
      if (!resolved || resolved.command !== 'build' || !resolved.build.ssr) return;
      const { distDir, ...generatorConfig } = options;
      const report = generateLlmsTxt(path.resolve(resolved.root, distDir ?? 'dist'), generatorConfig);
      const total = report.files.reduce((sum, file) => sum + file.bytes, 0);
      console.log(
        `[llms-txt] ${report.pages} pages → ${report.files.length} files (${total}B)` +
          (report.skipped.length ? `, skipped noindex: ${report.skipped.join(', ')}` : ''),
      );
    },
  };
}
