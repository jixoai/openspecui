/**
 * jixoai defaults tool (registry/files/lib/defaults.svelte.ts,
 * context-defaults-economy task 1.1, 2026-09-03).
 *
 * The TOOL layer of the Defaults seam — the organization layer around
 * context reads, not a new foundation (design.md 定位). Compose's
 * CardDefaults translated to Svelte 5: each component family ships ONE
 * `defineComponentDefaults({ ...slots })` contract object; a slot is a
 * branded callable resolving `explicit ?? ambient ?? own` when the
 * consumer's `$derived` window evaluates `XxxDefaults.resolve({...})`.
 *
 * Orthogonal intents:
 *   1. brand — a module-private unique symbol (declare-const type twin
 *      + Symbol value twin, the kernel BRAND idiom): only this
 *      module's factories construct a DefaultsSlot
 *   2. dual guard — the type brand PLUS a factory-product WeakSet: a
 *      reflection copy carries the brand but misses the registration,
 *      so defineComponentDefaults rejects cast-forged and
 *      marker-copied slots at contract construction. The runtime half
 *      runs IN DEV ONLY (`import.meta.env?.DEV`, D3-B): the type
 *      brand is the production contract, and vitest runs under vite
 *      with DEV=true so the guard stays test-observed
 *   3. the ONE construction entry — defineAxisSlot(name, resolve):
 *      the axis factories (definePaintSlot/densitySlot, task 1.2) and
 *      the literal family factories below all route through it; the AST
 *      gate pins the identifier to registry/files/lib/** (this
 *      canonical tree — apps/www/src/lib is its byte mirror)
 *   4. the literal family, slot-values-first (D1) —
 *      defineLiteralSlot(values, own) / defineOpenSlot<T>(own) /
 *      absentSlot<T>() (absent IS the state; the output carries
 *      undefined). The values tuple is the TYPE SOURCE (OneOf): const
 *      generic inference replaces the explicit type argument —
 *      omitting either parameter, or a default outside the tuple, is
 *      a compile error (真·强制 by construction; the NoInfer/= never
 *      discipline is RETIRED for this factory). defineOpenSlot serves
 *      the open scalar domains (no closed union to enumerate) and
 *      keeps the absentSlot discipline: NoInfer + `= never` (TS ≥
 *      5.4) — the explicit type argument is the ONLY enforcement face.
 *
 * 惰性律: this module reads ZERO context and imports NOTHING —
 * construction captures only `own`; the ambient supply is the axis
 * module's closure-held getter, lazily evaluated at resolve time
 * inside the consumer's component window, never a snapshot and never
 * a module-level read here. The window is a HARD CONTRACT (D3-C):
 * outside component initialisation Svelte's own
 * lifecycle_outside_component propagates — never caught, never
 * normalized, never message-matched. The byte mirror installs whole,
 * zero burden.
 */

declare const jxSlot: unique symbol;
const SLOT_BRAND = Symbol('jx-defaults-slot') as typeof jxSlot;

/**
 * A Defaults slot: `(explicit) => resolved`. Constructible only by the
 * factories in this module and the axis modules — the brand field is
 * unnameable outside (the type-level half of the guard); the WeakSet
 * below is the runtime half.
 */
export interface DefaultsSlot<T> {
  (explicit: T | undefined): T;
  readonly [jxSlot]: 'defaults-slot';
}

/**
 * The runtime half of the dual guard: every defineAxisSlot product
 * registers here exactly once, at construction. Registration is
 * identity-based, not copyable — a marker-copied or cast-forged slot
 * misses the set even when the brand marker is present. The check
 * runs in dev only (D3-B); the type brand carries production.
 */
const SLOT_REGISTRY = new WeakSet<object>();

/**
 * The ONE construction entry — the cross-module construction protocol
 * (design X3-1/X4-1, signature frozen): every slot (the axis module
 * factories of task 1.2 and the literal family factories below) is
 * built, branded and WeakSet-registered here, once, at axis module
 * load.
 *
 * Resolver protocol: `ambient` is the axis module's closure-held
 * getter — lazy and getter-endorsed, so reads land in the consumer's
 * $derived dependency graph. This module itself reads no context
 * (惰性律), so the getter it hands the resolver is the permanently
 * silent one; an axis wanting real ambient supply closes its own
 * context-reading getter over the resolver. The window is a hard
 * contract (D3-C): outside component initialisation the axis getter's
 * lifecycle error propagates out of the slot call — never caught,
 * never re-entered, never normalized.
 *
 * NOT a public API — the AST gate asserts this identifier appears only
 * under registry/files/lib/**. `name` is the diagnostic identity error
 * messages and the gate report cite from one source (it rides the
 * product's function name).
 */
export function defineAxisSlot<T>(
  name: string,
  resolve: (explicit: T | undefined, ambient: () => T | undefined) => T,
): DefaultsSlot<T> {
  const silentAmbient = (): T | undefined => undefined;
  const slot = (explicit: T | undefined): T => resolve(explicit, silentAmbient);
  // (site patch, 2026-09-06): TS 5.9 widens the computed unique-symbol key
  // inside Object.assign's inferred type AND rejects every carrier cast to
  // the branded shape (specific symbol prop vs symbol index signature), so
  // the brand lands through Object.defineProperty — same runtime result,
  // no cast (openspecui website svelte-check gate).
  const branded = slot as DefaultsSlot<T>;
  Object.defineProperty(branded, SLOT_BRAND, { value: 'defaults-slot' });
  Object.defineProperty(branded, 'name', { value: name });
  SLOT_REGISTRY.add(branded);
  return branded;
}

/**
 * The element union of a values tuple — values IS the type source
 * (slot-values-first D1): `defineLiteralSlot(['tonal', 'outline'],
 * 'tonal')` declares the family union with no separate type
 * declaration. Scalar three-state domain: string / number / boolean
 * (booleans are a closed domain and take the values form —
 * `defineLiteralSlot([false, true], false)`).
 */
export type OneOf<T extends readonly (string | number | boolean)[]> = T[number];

/**
 * The literal family, closed-domain form (slot-values-first D1,
 * replacing the retired literalSlot(own) form): the values tuple is
 * the type source — const generic inference recovers the union
 * (`ReturnType<typeof slot>` for the family's one declaration
 * source), and `defaultValue: OneOf<T>` locks default ∈ values at
 * COMPILE time. NoInfer + `= never` enforcement is retired here:
 * omission of either parameter cannot compile, so no explicit type
 * argument exists to demand. `values` is the type/gate carrier ONLY
 * — the runtime ignores it (the D3-A 法 extension: no runtime
 * value-domain guard exists), so the resolver is byte-identical to
 * the retired literalSlot's `explicit ?? own`. Ambient capability is
 * pending a future axis, so the slot NEVER reads context. Output
 * carries NO undefined: defineLiteralSlot(['solid', 'auto'], 'auto')
 * resolves the element union.
 */
export function defineLiteralSlot<const T extends readonly (string | number | boolean)[]>(
  values: T,
  defaultValue: OneOf<T>,
): DefaultsSlot<OneOf<T>> {
  return defineAxisSlot('literal', (explicit) => explicit ?? defaultValue);
}

/**
 * The literal family, open-domain form ([B1]: no closed union to
 * enumerate — sheet size is a free CSS length, chart size /
 * navigation-menu inset are free numbers): same `explicit ?? own`
 * resolve and the same 'literal' axis name, but the value domain
 * cannot ride a values tuple, so the explicit type argument is the
 * ONLY enforcement face — NoInfer + `= never` true enforcement, the
 * absentSlot discipline (TS ≥ 5.4: omitting the type argument leaves
 * T at never and the call is a compile error, never a fallback; the
 * constraint rejects nullish owns — undefined is the ONLY sentinel).
 * The day an open axis closes its union it migrates back to the
 * values form.
 */
export function defineOpenSlot<T extends string | number | boolean = never>(
  own: NoInfer<T>,
): DefaultsSlot<T> {
  return defineAxisSlot('literal', (explicit) => explicit ?? own);
}

/**
 * The literal family, absent-meaningful form: absence IS the state
 * (native/unset rendering) — no own, and the resolved value may BE
 * undefined so the component renders its absent-state path. No
 * parameters → no NoInfer leverage; the explicit type argument is
 * enforced by the AST gate (typeArguments.length > 0). Output carries
 * undefined: `absentSlot<SurfaceVariant>()` resolves
 * `SurfaceVariant | undefined`.
 */
export function absentSlot<T extends {}>(): DefaultsSlot<T | undefined> {
  return defineAxisSlot('absent', (explicit) => explicit);
}

/**
 * The never-args constraint (design X-1 — no `any`): any branded slot
 * satisfies it structurally while bare functions and bare literals
 * fail the brand.
 */
type AnyBrandedSlot = ((...args: never[]) => unknown) & { readonly [jxSlot]: string };

/**
 * Build a family's Defaults contract — the family's SINGLE declared
 * ambient contract (one `*Defaults` object per family). `resolve`
 * takes a Partial over the slots' explicit parameters and returns a
 * FRESH plain object of the resolved values, never frozen (consumers
 * destructure per slot — the whole object never amplifies derived
 * recomputation); `slots` is the shallow-frozen contract surface a
 * reviewer audits (exactly the key set, split by slot kind).
 *
 * Runtime guard (dev-only, D3-B): every slot must be a factory
 * product (the WeakSet) — a miss throws the fixed message below, so
 * cast-forged and marker-copied slots die HERE, at contract
 * construction, never inside a component's resolve window. In
 * production the type brand alone carries the contract (the
 * optional chain keeps non-vite environments load-safe).
 */
export function defineComponentDefaults<S extends Record<string, AnyBrandedSlot>>(
  slots: S,
): {
  resolve(partial: { [K in keyof S]?: Parameters<S[K]>[0] }): { [K in keyof S]: ReturnType<S[K]> };
  readonly slots: S;
} {
  if (import.meta.env?.DEV) {
    for (const key of Object.keys(slots) as (keyof S & string)[]) {
      if (!SLOT_REGISTRY.has(slots[key])) {
        throw new Error('[defaults] slots accept factory products only');
      }
    }
  }
  return {
    resolve(partial) {
      const resolved = {} as { [K in keyof S]: ReturnType<S[K]> };
      for (const key of Object.keys(slots) as (keyof S & string)[]) {
        // (site patch, 2026-09-06): double cast — the slot's contravariant
        // parameter fails TS 5.9's single-assertion overlap check
        const slot = slots[key] as unknown as (explicit: unknown) => unknown;
        resolved[key] = slot(partial[key]) as {
          [K in keyof S]: ReturnType<S[K]>;
        }[keyof S & string];
      }
      return resolved;
    },
    slots: Object.freeze(slots),
  };
}
