/**
 * jixoai inline icon set — GENERATED, do not hand-edit
 * (registry/files/lib/icons.ts).
 *
 * Source of truth: the manifest in scripts/gen-icons.mjs serializing
 * lucide@^0.472.0 IconNode geometry. Regenerate: npm run gen:icons
 * (freshness gate: npm run verify:icons).
 *
 * Original request (2026-08-20): “把 → ▾ × ↗ ✓ 文本符号替换为内联 SVG
 * 图标” — one shared module so every component renders the SAME geometry
 * instead of private glyphs. SVG strings (not a component, not Snippets):
 * consumers print them with {@html icons.x} and own layout/sizing via CSS.
 *
 * Law:
 * - 24×24 viewBox, 16px baked, stroke currentColor, fill none, round
 *   caps/joins — lucide's stroke geometry.
 * - aria-hidden="true" baked in: these are ALWAYS decorative; meaning
 *   lives in the surrounding text or the control's aria-label.
 * - data-jx-icon for consumer targeting (`.foo svg` also works).
 * - Sizing and stroke-width overrides are CONSUMER CSS (a class rule or
 *   a Tailwind arbitrary variant like [&_svg]:stroke-[2.5] —
 *   presentation attributes yield to the cascade); never fork manifest
 *   variants for them.
 */

/** shared opening tag — every icon below only differs in its paths */
const svg = (paths: string): string =>
  `<svg data-jx-icon viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const arrowRight = svg('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>');
export const arrowLeft = svg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>');
export const rotateCcw = svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>');
export const copy = svg('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>');
export const chevronDown = svg('<path d="m6 9 6 6 6-6"/>');
export const chevronRight = svg('<path d="m9 18 6-6-6-6"/>');
export const x = svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>');
export const externalLink = svg(
  '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
);
export const check = svg('<path d="M20 6 9 17l-5-5"/>');

// tree-view extension set (2026-08-22, lucide 0.472 geometry): prefix
// icons, the plus/minus toggler variant and suffix action glyphs.
export const folder = svg(
  '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>'
);
export const folderOpen = svg(
  '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>'
);
export const file = svg(
  '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>'
);
export const fileCode = svg(
  '<path d="M10 12.5 8 15l2 2.5"/><path d="m14 12.5 2 2.5-2 2.5"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>'
);
export const fileText = svg(
  '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>'
);
export const braces = svg(
  '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>'
);
export const palette = svg(
  '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>'
);
export const plus = svg('<path d="M5 12h14"/><path d="M12 5v14"/>');
export const minus = svg('<path d="M5 12h14"/>');
export const ellipsis = svg(
  '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>'
);

// jx-pure Part A mirror set (2026-08-23, lucide 0.472 geometry): the glyphs
// the Tier-1 form sheet paints into UA pseudos via CSS mask. The path
// data below and the data-URIs in registry/files/theme/jx-pure.css (Part A)
// are the SAME geometry — edit both or neither (single-source law).
export const calendar = svg(
  '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'
);
export const clock = svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>');
export const pipette = svg(
  '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>'
);

// component-migration set (2026-08-29, lucide 0.472 geometry): the
// glyphs the registry components' hand inline SVGs retired in favor of
// (theme-toggle sun/moon/monitor, language-switcher, image fallback,
// file-input kinds + upload, date-picker nav).
export const sun = svg(
  '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'
);
export const moon = svg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>');
export const monitor = svg(
  '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>'
);
export const languages = svg(
  '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>'
);
export const image = svg(
  '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'
);
export const fileVideo = svg(
  '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 11 5 3-5 3v-6Z"/>'
);
export const fileAudio = svg(
  '<path d="M17.5 22h.5a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M2 19a2 2 0 1 1 4 0v1a2 2 0 1 1-4 0v-4a6 6 0 0 1 12 0v4a2 2 0 1 1-4 0v-1a2 2 0 1 1 4 0"/>'
);
export const upload = svg(
  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>'
);
export const chevronLeft = svg('<path d="m15 18-6-6 6-6"/>');

// input password-reveal set (2026-08-30, expand-form-family): the
// eye/eye-off pair the reveal toggle paints — eye while the value is
// hidden, eyeOff while revealed.
export const eye = svg(
  '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>'
);
export const eyeOff = svg(
  '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>'
);

// search entry set (2026-09-02, r9 acceptance): the magnifier the
// TerminalHeader trigger + the palette input carry (16px baked law;
// sizing stays consumer CSS).
export const search = svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>');

// input semantic-glyph set (2026-09-05, Owner: url/phone etc.
// default-support their glyph): link/phone/mail ride the Input
// shell's semantic-icon lane — search reuses the r9 entry above,
// text reuses the Type entry below.
export const link = svg(
  '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'
);
export const phone = svg(
  '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'
);
export const mail = svg(
  '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'
);

// the text glyph (2026-09-05, Owner: "给 type-text 也加上默认
// 图标") — the T marks the generic text lane in the same vocabulary.
export const type = svg(
  '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>'
);

/** named-access bag for {@html icons.<name>} consumption */
export const icons = {
  arrowRight,
  arrowLeft,
  rotateCcw,
  copy,
  chevronDown,
  chevronRight,
  x,
  externalLink,
  check,
  folder,
  folderOpen,
  file,
  fileCode,
  fileText,
  braces,
  palette,
  plus,
  minus,
  ellipsis,
  calendar,
  clock,
  pipette,
  sun,
  moon,
  monitor,
  languages,
  image,
  fileVideo,
  fileAudio,
  upload,
  chevronLeft,
  eye,
  eyeOff,
  search,
  link,
  phone,
  mail,
  type,
};
