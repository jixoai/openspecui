/**
 * jixoai theme-toggle family Defaults
 * (registry/files/ui/theme-toggle/theme-toggle-defaults.svelte.ts,
 * context-defaults-economy task 3.4 / W4, 2026-09-03).
 *
 * The theme-toggle family's SINGLE declared ambient contract
 * (design.md Defaults 定位): one `ThemeToggleDefaults` object whose
 * slots cover every vocabulary-hit style prop —
 *   - variant: the LITERAL family (own 'compact'), deliberately NOT
 *     a paint axis slot: full/compact/icon/text is a STRUCTURAL
 *     selector (how much of the mode UI to render), not a paint rung
 *     — theme-toggle is absent from the variant grammar's frozen
 *     availability table, and a paint family must be frozen before
 *     it ships a paint slot. Resolves `explicit ?? own`, never reads
 *     context; a future table freeze promotes this slot the kbd
 *     convention (table row → definePaintSlot).
 *
 * No density slot: the toggle carries no density prop — its type
 * scale rides the bezel utilities fixed, nothing to cover.
 *
 * 惰性律: construction captures own only; this literal slot never
 * reads context at all. This file is a member of the registry:ui
 * item (installs with the family, byte mirrored, zero kernel
 * imports).
 */
import { defineComponentDefaults, defineLiteralSlot } from '$lib/defaults.svelte';

export const themeToggleVariantSlot = defineLiteralSlot(['full', 'compact', 'icon', 'text'], 'compact');

/** the structural selector — how much of the mode UI renders;
 *  ReturnType 反查 — the values tuple above is the union's source */
export type ThemeToggleVariant = ReturnType<typeof themeToggleVariantSlot>;

export const ThemeToggleDefaults = defineComponentDefaults({
  variant: themeToggleVariantSlot,
});
