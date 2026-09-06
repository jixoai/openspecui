/**
 * jixoai separator family Defaults
 * (registry/files/ui/separator/separator-defaults.svelte.ts,
 * context-defaults-economy task 3.2, 2026-09-03).
 *
 * The separator family's SINGLE declared ambient contract (design.md
 * Defaults 定位): one `SeparatorDefaults` object whose slots cover
 * every vocabulary-hit style prop —
 *   - variant: the LITERAL family (own 'line'), deliberately NOT a
 *     paint axis slot: the vocabulary names the INK GEOMETRY (masks
 *     over the contrast ghost — dashed/dense/dotted/wavy — or the
 *     blend engine for fade), never a prominence rung; it can never
 *     join the paint ladder's frozen table, so the slot stays a
 *     defineLiteralSlot forever (the kbd mode's terminal form: no
 *     upgrade path exists because none is meaningful).
 *   - density: the no-opinion axis slot. The separator carries NO
 *     density own: no provider and no explicit prop resolve
 *     undefined, stamp nothing, and the ambient css scope channel
 *     keeps flowing (fleet law).
 *
 * 惰性律: construction captures own only; context reads happen at
 * resolve time inside the consumer's $derived window. This file is a
 * member of the registry:ui item (installs with the family, byte
 * mirrored, zero kernel imports).
 */
import { defineComponentDefaults, defineLiteralSlot } from '$lib/defaults.svelte';
import { densitySlot } from '$lib/density.svelte';

export const separatorVariantSlot = defineLiteralSlot(
  ['line', 'dashed', 'dense', 'dotted', 'wavy', 'fade'],
  'line',
);

/**
 * The ink geometry — masks over the contrast ghost (dashed/dense/
 * dotted/wavy) or the blend engine (fade); length stays the
 * consumer's job. ReturnType 反查 — the slot's values tuple is the
 * union's source.
 */
export type SeparatorVariant = ReturnType<typeof separatorVariantSlot>;

export const SeparatorDefaults = defineComponentDefaults({
  variant: separatorVariantSlot,
  density: densitySlot(),
});
