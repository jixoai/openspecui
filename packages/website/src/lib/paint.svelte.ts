/**
 * jixoai paint axis (registry/files/lib/paint.svelte.ts,
 * context-defaults-economy task 1.2, 2026-09-03).
 *
 * The paint AXIS of the Defaults seam — the variant ladder's ambient
 * channel on ONE key (Owner 2026-09-04: pre-adoption, the single-key
 * law — no release ever shipped a second paint key to be compatible
 * WITH, so no compatibility lane exists): PAINT_ZONE_KEY carries
 * paint VALUES only (never layout — orientation/separator/overflow
 * stay on BUTTON_GROUP_KEY, the button-group family's own layout
 * key, which carries no variant since the retirement).
 *
 * Orthogonal intents:
 *   1. the value domain — PaintVariant (the ladder + link; the union
 *      belongs to the AXIS: press-button's PressButtonVariant is a
 *      re-exported alias, so lib never imports ui [F3]) and
 *      ZonePaintVariant (link excluded — link is PressButton's
 *      interaction exception, not a paint hierarchy level, so a zone
 *      defaulting to link is meaningless; the exclusion closes
 *      Badge-under-link by construction [X4-新发现])
 *   2. providePaintZone / getPaintZone — the lib-neutral write and
 *      the consumer-side read (getter-endorsed payload
 *      `{ get variant() }`, so a parent variant flip re-derives
 *      consumers in the same frame; inherit-then-provide families
 *      capture the parent zone eagerly, the getDensityContext
 *      precedent)
 *   3. definePaintSlot — the axis slot `explicit ?? ambient ?? own`;
 *      the ambient domain is provider-narrowed (ZonePaintVariant) and
 *      the values tuple additionally gates the AMBIENT lane at
 *      runtime (B4, 2026-09-05: a zone value outside the family's
 *      availability falls back to own — narrow unions like Badge's
 *      fill/tonal/outline must never receive ghost)
 *   4. the 惰性律 — construction captures own only (values is a
 *      type/gate carrier the runtime never touches); the
 *      ambient read is this module's closure-held getter, lazily
 *      evaluated at resolve time inside the consumer's window (the
 *      hard window contract, D3-C: outside component initialisation
 *      Svelte's own lifecycle error propagates — never caught)
 */

import { getContext, setContext } from 'svelte';
import { defineAxisSlot, type DefaultsSlot, type OneOf } from './defaults.svelte';

/**
 * The ladder + the one interaction exception — the whole paint value
 * domain, owned by the axis (the family unions are its subsets;
 * link is PressButton-only per the frozen availability table).
 */
export type PaintVariant = 'fill' | 'tonal' | 'outline' | 'ghost' | 'link';

/**
 * The zone's value domain: link EXCLUDED — link is PressButton's
 * interaction exception (living spec), not a paint hierarchy level;
 * a zone defaulting to link is meaningless [X4-新发现]. The
 * PAINT_ZONE_KEY payload type is exactly this, so a provider passing
 * 'link' is a compile error (the ambient value domain closes by
 * construction; the family slots' static narrow unions remain the
 * second line of defense — no runtime clamp on this key).
 */
export type ZonePaintVariant = Exclude<PaintVariant, 'link'>;

/**
 * The axis-level zone key — global symbol registry (independent
 * registry items must agree without imports), distinct from every
 * family-state context key (BUTTON_GROUP_KEY carries layout +
 * policy; this key carries paint values only).
 */
export const PAINT_ZONE_KEY = Symbol.for('jx-paint-zone');

/** the zone payload: getter-endorsed (reads land in the consumer's
 *  $derived dependency graph — never a snapshot) */
interface PaintZonePayload {
  readonly variant: ZonePaintVariant | undefined;
}

/**
 * The ambient read — this axis module's closure-held getter, lazily
 * evaluated at resolve time inside the consumer's window (惰性律 —
 * the hard window contract, D3-C: outside component initialisation
 * Svelte's own lifecycle error propagates, never caught). ONE key,
 * no compatibility lanes (pre-adoption, Owner 2026-09-04: no release
 * has ever shipped a second key to be compatible WITH). A throwing
 * provider getter propagates.
 */
function readAmbientVariant(): ZonePaintVariant | undefined {
  return getContext<PaintZonePayload | undefined>(PAINT_ZONE_KEY)?.variant;
}

/**
 * The consumer-side zone read — the provider-facing twin of the slot's
 * ambient lane (the getDensityContext precedent): inherit-then-provide
 * families capture the PARENT zone object eagerly (argument position,
 * before their own providePaintZone write) and read its getter.
 * Returns undefined outside any zone (no opinion).
 */
export function getPaintZone(): PaintZonePayload | undefined {
  return getContext<PaintZonePayload | undefined>(PAINT_ZONE_KEY);
}

/**
 * Write the one paint key (the shared helper is lib-neutral).
 * The payload is getter-backed, so `providePaintZone(() =>
 * effectiveVariant)` keeps a parent flip re-deriving every consumer
 * in the same frame. The domain is ZonePaintVariant end to end —
 * link never had a zone lane to keep.
 */
export function providePaintZone(variant: () => ZonePaintVariant | undefined): void {
  setContext(PAINT_ZONE_KEY, {
    get variant() {
      return variant();
    },
  });
}

/**
 * The paint axis slot (slot-values-first D1, replacing the retired
 * paintSlot(own, values) form): `explicit ?? ambient ?? own`, ambient =
 * the zone key. The values tuple is FIRST and is the family union's
 * SOURCE: `const T extends readonly PaintVariant[]` locks values ⊆
 * the axis domain at compile time, `own: OneOf<T>` locks own ∈
 * values, and const generic inference replaces the explicit type
 * argument (NoInfer/= never enforcement retired — omission of either
 * parameter cannot compile). Construction captures own only (惰性
 * 律); `values` is the type/gate carrier ONLY for the EXPLICIT lane —
 * the ambient lane gates on it at runtime (B4, codex r1 2026-09-05):
 * a zone value outside the family's availability tuple falls back to
 * own instead of leaking into the family's class map as undefined
 * (ghost under Badge/Kbd/InlineCode was the live crash vector).
 */
export function definePaintSlot<const T extends readonly PaintVariant[]>(
  values: T,
  own: OneOf<T>,
): DefaultsSlot<OneOf<T>> {
  return defineAxisSlot<OneOf<T>>('paint', (explicit) => {
    if (explicit !== undefined) return explicit;
    const ambient = readAmbientVariant();
    if (ambient === undefined) return own; // no opinion — the zone's silence
    // B4: the provider narrows to ZonePaintVariant, but a NARROW family
    // (badge/kbd/inline-code lack ghost) can receive a value it cannot
    // paint — availability gates the ambient lane; not-a-member → own
    return (values as readonly PaintVariant[]).includes(ambient) ? (ambient as OneOf<T>) : own;
  });
}
