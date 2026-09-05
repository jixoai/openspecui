/**
 * The ContextPlugin kernel (apps/www/src/lib/context-plugin.svelte.ts,
 * context-plugin-v2, 2026-09-03) — every jixoai-ui Context object
 * (density / hue / any future def) can be intervened on by PLUGINS:
 * pure, immutable value transformers composed as Svelte reactive
 * projections. Reference shapes: vite plugins (registration order +
 * `enforce` anchors) and WebComponent paired lifecycles (outer mount /
 * inner unmount); the core technique is Svelte 5 reactivity — the
 * pipeline is composed `$derived` segments over one writable raw value,
 * so recomputation scope is a property of the dependency graph (a
 * dependency-count test asserts it; nothing here claims a perf number).
 *
 * THE MODEL (design.md r3):
 *
 *   rawValue                     the provider's ONLY writable `$state`
 *   init(defaults)               environment-free, one-time, FULL-value
 *                                reducer chain applied at instance
 *                                creation (plugin order, later covers
 *                                earlier — no shallow merge, no veto)
 *   filter(def, env)             the REVERSIBLE eligibility gate: false
 *                                excludes the plugin from this context
 *                                instance while the context stays
 *                                mounted (medium-gated plugins survive
 *                                screen→print→screen round-trips)
 *   before(value, env)           entry side, onion outer→inner
 *   after(value, env)            projection side, onion inner→outer
 *
 *   exposed = $derived( after(…( before(…( raw )))) )   — read-only
 *
 * ONION ORDER (Owner ruling): plugins resolve into layers by
 * (enforce-anchored, stable) order; `before` walks outer→inner
 * (array order), `after` walks inner→outer (reverse array order) —
 * `raw → beforeA → beforeB → value → afterB → afterA → consumer`.
 * The before side refines inward (later registrations process outer
 * results); the after side lets the FIRST registration have the final
 * word (the outer layer closes over every inner projection). Nested
 * roots compose one flat chain parent-first — the same law with the
 * parent root in the outer layer.
 *
 * REGISTRATION is root-scoped and stacks: `provideContextPlugins`
 * provides at a component root (nearest root's interventions land
 * last / innermost); there is NO module-level singleton registry. The
 * plugin chain a context consumes is whatever was visible when the
 * context INSTANCE was created (provide time); the composed chain is
 * built once per root (sorted, deduped, frozen) — resolves and gets
 * never recompose it.
 *
 * DEFS ARE IDENTITY OBJECTS (D1): a plugin's `targets` tuple binds a
 * def OBJECT — matching is SameValueZero identity, never the key
 * string. `def.key` is diagnostic vocabulary only (error messages,
 * gates); two defs with the same key but different identities simply
 * never match (an equal-key impostor is a dead target, diagnosed by
 * its zero effect). The `ContextDef` type brand makes the classic
 * author mistake — an inline literal, a forgotten import — a COMPILE
 * error instead of a silent dead target.
 *
 * MEDIUM IS READ-ONLY: the medium context is environment truth, not an
 * opinion — `definePlugin` rejects a def carrying the read-only marker
 * (`ReadOnlyContextDef`) at the type level AND at runtime (the
 * READ_ONLY registry), and `provideContextPlugins` guards the same
 * registration path again (a cast-forged plugin cannot sneak in).
 *
 * SSR: no module-top-level window access. `env.root` is undefined and
 * `env.medium` is `'screen'` when no medium getter was injected (or
 * the injected getter returned undefined — the explicit server-side
 * initials; the kernel never touches window itself).
 *
 * DEPENDENCY LAW: zero npm dependencies (verification gate) — the only
 * import is svelte. The env's `MediumState` vocabulary lives HERE (the
 * kernel owns it); the medium PROVIDER is injected by the caller
 * (`PluginRootOptions.medium`), so this module imports no provider —
 * the lib item stays installable standalone.
 */

import { getContext, setContext } from 'svelte';

// ---- the type domain ---------------------------------------------------

/** The medium vocabulary — owned by the kernel (env is kernel surface). */
export type MediumState = 'screen' | 'sim' | 'print';

/**
 * A factory INPUT: a context's identity + default value contract,
 * brand-free (the author can construct it — the brand is stamped by
 * the factory, so an input can never pre-carry it).
 */
export interface ContextDefInit<K extends string, T> {
  /** diagnostic identity: 'density' | 'hue' | … (never used for matching) */
  readonly key: K;
  /** the value with no plugins and no provider */
  defaults(): T;
  /** the SSR / no-window value (the explicit server-side initial) */
  readonly ssrSafe: T;
}

/**
 * The type brand: only `defineContextDef` can construct a def — the
 * unique symbol is unnameable outside this module, so object literals
 * cannot forge the field. An inline def literal in `targets` (the
 * forgotten-import mistake) is therefore a COMPILE error, not the
 * silent dead target plain structural typing would allow.
 */
declare const defBrand: unique symbol;
/** the declared brand's value twin, module-private */
const DEF_BRAND: typeof defBrand = Symbol('jx-context-def') as unknown as typeof defBrand;

/** A context def — the identity object plugins target. */
export interface ContextDef<K extends string, T> extends ContextDefInit<K, T> {
  readonly [defBrand]: true;
}

/** Extract a def's value type — the ONLY source of hook value types. */
export type DefValue<D> = D extends ContextDef<string, infer T> ? T : never;

/**
 * A read-only domain def (medium): definable and shareable, but
 * `definePlugin`'s type lane rejects it as a target.
 */
export interface ReadOnlyContextDef<K extends string, T> extends ContextDef<K, T> {
  readonly readOnly: true;
}

/**
 * The read-only registry — identity membership, so a spread cannot
 * steal it and a forged literal cannot fake it. Kept alongside the
 * `readOnly` marker field (which can be spread-stolen — the safe
 * direction: a false rejection, never a false acceptance): the WeakSet
 * is the same identity vocabulary the slot guard uses, stronger than a
 * marker field alone.
 */
const READ_ONLY: WeakSet<object> = new WeakSet();

/**
 * The def factory: stamps the brand onto the caller's object, freezes
 * it, returns it — the SAME reference (identity matching requires a
 * def and its imports to be one object; the factory never copies).
 */
export function defineContextDef<K extends string, T>(def: ContextDefInit<K, T>): ContextDef<K, T> {
  // (site patch, 2026-09-06): brand through a MUTABLE carrier cast — TS 5.9
  // flags the direct assignment through the readonly branded interface
  // (openspecui website svelte-check gate).
  (def as { [DEF_BRAND]?: true })[DEF_BRAND] = true;
  return Object.freeze(def) as ContextDef<K, T>;
}

/** The read-only twin (see ReadOnlyContextDef / READ_ONLY above). */
export function defineReadOnlyContextDef<K extends string, T>(
  def: ContextDefInit<K, T>,
): ReadOnlyContextDef<K, T> {
  // (site patch, 2026-09-06): same readonly-assignment gate as above.
  (def as { readOnly?: true }).readOnly = true;
  READ_ONLY.add(def);
  return defineContextDef(def) as ReadOnlyContextDef<K, T>;
}

/**
 * The reactive environment a plugin's filter/before/after read —
 * getter-endorsed so reads inside `$derived` segments land in the
 * dependency graph ("only affected segments recompute").
 */
export interface ContextEnv {
  /** the injected medium provider's derived state; 'screen' without one */
  readonly medium: MediumState;
  /** the plugin root's host element (bind:this/action-supplied);
   *  undefined under SSR or when the root passed none */
  readonly root: HTMLElement | undefined;
}

/** `definePlugin`'s input — one def, hooks typed from it (DefValue). */
export interface PluginSpec<D extends ContextDef<string, unknown>> {
  readonly name: string;
  /** the single-element law: one plugin, one def target */
  readonly targets: readonly [D];
  readonly enforce?: 'pre' | 'post';
  init?(def: D): (defaults: DefValue<D>) => DefValue<D>;
  filter?(def: D, env: ContextEnv): boolean;
  before?(value: DefValue<D>, env: ContextEnv): DefValue<D>;
  after?(value: DefValue<D>, env: ContextEnv): DefValue<D>;
}

/** The private brand: only `definePlugin` can construct a plugin —
 *  the unique symbol is unnameable outside this module, so object
 *  literals cannot forge the field (the type-level half of the guard;
 *  `provideContextPlugins` re-checks it at runtime). The runtime token
 *  below is the declared symbol's value twin, module-private. */
declare const defined: unique symbol;
const BRAND: typeof defined = Symbol('jx-defined-plugin') as unknown as typeof defined;

/** `definePlugin`'s product — `targets` frozen to the single def,
 * constructor private (brand field): the only registration currency a
 * plugin root accepts. */
export interface DefinedPlugin<D extends ContextDef<string, unknown> = ContextDef<string, unknown>>
  extends Omit<PluginSpec<D>, 'targets'> {
  readonly targets: readonly [D];
  readonly [defined]: true;
}

/** the heterogeneous array element a root composes (structural view —
 *  runtime registration still demands the plugin brand) */
export type UnknownPlugin = {
  readonly targets: readonly ContextDef<string, unknown>[];
} & Record<string, unknown>;

/** the type-level read-only rejection message */
type MediumTargetRejected =
  'ERROR: the medium context is a read-only projection — plugins cannot target "medium"';

// ---- the registration entry --------------------------------------------

/**
 * Marker-or-identity read-only detection: the WeakSet carries the
 * identity of every defineReadOnlyContextDef product, while the
 * enumerable `readOnly: true` field catches spread COPIES (a copy
 * misses the set but carries the marker — rejected fail-closed;
 * impl-review S3). A forged marker on a non-read-only def is rejected
 * the same way: the safe direction.
 */
function isReadOnlyTarget(target: object): boolean {
  return (
    READ_ONLY.has(target) ||
    (target as { readOnly?: unknown }).readOnly === true
  );
}

/**
 * The ONLY way a plugin comes to exist. `targets` is a single-def
 * tuple (D enters the generic), so a density plugin's hooks are typed
 * by the density def — `(v: WrongType) => …` is a compile error, the
 * lie has no lane left. A def carrying the read-only marker is
 * rejected at compile time (the error literal above arms) and again
 * at runtime (marker-or-identity, above).
 */
export function definePlugin<const D extends ContextDef<string, unknown>>(
  spec: PluginSpec<D> &
    (D extends ReadOnlyContextDef<string, unknown>
      ? { readonly targets: MediumTargetRejected }
      : unknown),
): DefinedPlugin<D> {
  const targets = Object.freeze([...spec.targets]) as readonly [D];
  for (const target of targets) {
    if (isReadOnlyTarget(target)) {
      throw new Error(
        '[context-plugin] the medium context is a read-only projection — plugins cannot target "medium"',
      );
    }
  }
  const plugin: DefinedPlugin<D> = {
    name: spec.name,
    targets,
    ...(spec.enforce !== undefined ? { enforce: spec.enforce } : {}),
    ...(spec.init !== undefined ? { init: spec.init } : {}),
    ...(spec.filter !== undefined ? { filter: spec.filter } : {}),
    ...(spec.before !== undefined ? { before: spec.before } : {}),
    ...(spec.after !== undefined ? { after: spec.after } : {}),
    [BRAND]: true,
  };
  return Object.freeze(plugin);
}

// ---- sorting ------------------------------------------------------------

const ENFORCE_ANCHOR: Record<'pre' | 'post', number> = { pre: 0, post: 2 };

/**
 * Compose one root's plugin order: vite semantics — user array order
 * with stable 'pre'/'post' anchors (pre → unanchored → post, each
 * group keeping array order). Same-NAME plugins in one root collapse
 * to the LATER registration (warn); cross-root names never dedupe.
 * Pure: returns a new frozen array, input untouched.
 */
export function sortPlugins(plugins: readonly UnknownPlugin[]): readonly UnknownPlugin[] {
  const byName = new Map<string, UnknownPlugin>();
  for (const plugin of plugins) {
    const name = String(plugin.name);
    if (byName.has(name)) {
      console.warn(
        `[context-plugin] duplicate plugin name "${name}" in one root — the later registration wins`,
      );
    }
    // Map#set keeps the FIRST insertion slot with the LATER value: the
    // override lands where the name first stood in array order
    byName.set(name, plugin);
  }
  const anchored = [...byName.values()].map((plugin, index) => ({
    anchor:
      plugin.enforce === 'pre' || plugin.enforce === 'post'
        ? ENFORCE_ANCHOR[plugin.enforce]
        : 1,
    index,
    plugin,
  }));
  anchored.sort((a, b) => a.anchor - b.anchor || a.index - b.index);
  return Object.freeze(anchored.map((entry) => entry.plugin));
}

// ---- the scope (root-scoped registration + stacking) ---------------------

/**
 * The scope a plugin root provides: the composed chain (parent-first,
 * built once, frozen — the stable capture a context instance reads at
 * its creation) plus the shared env and the def-agnostic pure chain
 * application that brand-free context modules call through.
 */
export interface PluginScope {
  /** parent-first composed plugin order (this root's sorted plugins last) */
  readonly chain: readonly UnknownPlugin[];
  readonly env: ContextEnv;
  /** pure chain application for one context def — identity when the
   *  chain holds no plugin targeting THAT def object */
  apply<T>(def: ContextDef<string, unknown>, value: T): T;
}

/**
 * The context key of the plugin scope — module-private (a plain
 * Symbol, not a global one): the only way in is this module's
 * functions, so scope reads ride the import graph like every other
 * kernel surface. The scope itself lives in Svelte's per-root context
 * map: root-scoped, stacking, never a module-level singleton.
 */
const PLUGIN_SCOPE_KEY = Symbol('jx-context-plugins');

export interface PluginRootOptions {
  /** the providing component's host element (bind:this / action
   *  supplied). Omitted or SSR → env.root stays undefined. */
  root?: HTMLElement;
  /** The nearest medium provider's getter, injected by the CALLER
   *  (the kernel imports no provider module). Capture the provider's
   *  context object ONCE in your init window and read its `.medium`
   *  property here — do NOT call getContext per read. Missing getter,
   *  or one returning undefined → the explicit 'screen' initial. */
  medium?: () => MediumState | undefined;
}

/**
 * Provide a plugin root. Captures the nearest ancestor scope, appends
 * this root's sorted plugins (parent-first composition — the nearest
 * root's interventions land innermost/last), and freezes the result:
 * the composed chain is built ONCE here, never recomposed at resolve
 * or get time. The env carries the injected medium getter (absent →
 * 'screen', the explicit SSR initial — never a window access) and the
 * root element.
 */
export function provideContextPlugins(
  plugins: readonly UnknownPlugin[],
  options: PluginRootOptions = {},
): PluginScope {
  // runtime registration guards (the type-level halves live in
  // definePlugin / DefinedPlugin): only branded products, never a
  // read-only domain (marker-or-identity — a spread copy of the medium
  // def carries the marker and is rejected fail-closed; impl-review S3)
  for (const plugin of plugins) {
    if (plugin === null || typeof plugin !== 'object' || !(BRAND in plugin)) {
      throw new Error(
        '[context-plugin] registration accepts definePlugin() products only — forge one with definePlugin',
      );
    }
    for (const target of plugin.targets) {
      if (isReadOnlyTarget(target)) {
        throw new Error(
          `[context-plugin] plugin "${String(plugin.name)}" targets "${String(
            target.key,
          )}" — the medium context is a read-only projection`,
        );
      }
    }
  }

  const own = sortPlugins(plugins);
  const parent = getContextPlugins();
  const chain = Object.freeze(parent ? [...parent.chain, ...own] : [...own]);

  // env.medium: the INJECTED getter (the caller captured the medium
  // context object once, at its own init — this reads that object's
  // derived property, so every read lands in whichever derived reads
  // it). No getter / undefined → the explicit 'screen' initial.
  const env: ContextEnv = Object.freeze({
    get medium(): MediumState {
      return options.medium ? options.medium() ?? 'screen' : 'screen';
    },
    get root(): HTMLElement | undefined {
      return options.root;
    },
  });

  const scope: PluginScope = Object.freeze({
    chain,
    env,
    apply<T>(def: ContextDef<string, unknown>, value: T): T {
      return applyChain(def, value, chain, env);
    },
  });
  setContext(PLUGIN_SCOPE_KEY, scope);
  return scope;
}

/**
 * The nearest plugin root's scope — undefined inside a component
 * window with no root around (the identity path). THE WINDOW IS A
 * HARD CONTRACT (D3-C): outside component initialisation Svelte's own
 * `lifecycle_outside_component` propagates — never caught, never
 * normalized, never message-matched.
 */
export function getContextPlugins(): PluginScope | undefined {
  return getContext<PluginScope | undefined>(PLUGIN_SCOPE_KEY);
}

// ---- the pure chain ------------------------------------------------------

type AnyHooks = {
  init?(def: ContextDef<string, unknown>): (defaults: unknown) => unknown;
  filter?(def: ContextDef<string, unknown>, env: ContextEnv): boolean;
  before?(value: unknown, env: ContextEnv): unknown;
  after?(value: unknown, env: ContextEnv): unknown;
};

function hooksOf(plugin: UnknownPlugin): Partial<AnyHooks> {
  return plugin as Partial<AnyHooks>;
}

function eligible(
  plugin: UnknownPlugin,
  def: ContextDef<string, unknown>,
  env: ContextEnv,
): boolean {
  const filter = hooksOf(plugin).filter;
  return typeof filter === 'function' ? filter(def, env) !== false : true;
}

/**
 * The pure value pipeline for one context def — the kernel's whole
 * intervention semantics in one function (the $derived segments in
 * withPlugins and the seam-free callers both ride it):
 *
 *   value → before chain (array order, gated) → after chain
 *           (reverse array order, gated) → result
 *
 * Targeting is OBJECT IDENTITY (`plugin.targets.includes(def)`): zero
 * plugins holding THIS def → the IDENTITY fast path: the value returns
 * untouched and NO hook of any kind runs. Inputs are never mutated,
 * results never written back — plugins receive immutable values and
 * return new ones (their purity contract).
 */
export function applyChain<T>(
  def: ContextDef<string, unknown>,
  value: T,
  chain: readonly UnknownPlugin[],
  env: ContextEnv,
): T {
  const targeting: UnknownPlugin[] = [];
  for (const plugin of chain) {
    if (plugin.targets.includes(def)) targeting.push(plugin);
  }
  if (targeting.length === 0) return value; // identity fast path

  let current = value;
  // before: onion outer→inner (composed order)
  for (const plugin of targeting) {
    if (!eligible(plugin, def, env)) continue;
    const before = hooksOf(plugin).before;
    if (typeof before === 'function') current = before(current, env) as T;
  }
  // after: onion inner→outer (reverse order)
  for (let i = targeting.length - 1; i >= 0; i--) {
    const plugin = targeting[i];
    if (!eligible(plugin, def, env)) continue;
    const after = hooksOf(plugin).after;
    if (typeof after === 'function') current = after(current, env) as T;
  }
  return current;
}

// ---- the stateful pipeline (contexts with a raw owner) --------------------

/** The intervention machinery around one writable raw value. */
export interface PluginPipeline<T> {
  readonly def: ContextDef<string, unknown>;
  /** the plugins actually targeting this def, in composed order —
   *  EMPTY means the identity fast path armed (no chain built) */
  readonly targeting: readonly UnknownPlugin[];
  /** the ONLY writable value; chain results NEVER flow back here */
  readonly raw: T;
  setRaw(value: T): void;
  /** the read-only chained projection */
  readonly exposed: T;
}

const EMPTY_CHAIN: readonly UnknownPlugin[] = Object.freeze([]);

function applyInit<T>(
  def: ContextDef<string, unknown>,
  defaults: T,
  targeting: readonly UnknownPlugin[],
): T {
  let value = defaults;
  for (const plugin of targeting) {
    const init = hooksOf(plugin).init;
    if (typeof init === 'function') {
      value = (init as (d: ContextDef<string, unknown>) => (v: T) => T)(def)(value);
    }
  }
  return value;
}

/**
 * Build a context instance's pipeline: `init` reducers run ONCE over
 * the def's defaults (environment-free, plugin order), then the raw
 * `$state` feeds two `$derived` segments (before chain, after chain).
 * Zero plugins targeting THIS def → the identity fast path: NO derived
 * chain is built at all, exposed === raw by reference, and no hook
 * ever runs (the structural no-chain guarantee).
 *
 * The scope is the chain captured at the context instance's creation
 * (provide time) — pass `getContextPlugins()` from the providing
 * component; `undefined` arms the identity path.
 */
export function withPlugins<T>(
  def: ContextDef<string, T>,
  scope: PluginScope | undefined,
): PluginPipeline<T> {
  const chain = scope ? scope.chain : EMPTY_CHAIN;
  const targeting = chain.filter((plugin) => plugin.targets.includes(def));

  // the one-time init pass (environment-free full-value reducers).
  // $state.raw: the raw value is stored as-is — no deep proxy — so
  // reference identity survives (frozen inputs stay frozen, plugins
  // can never mutate through a proxy) and updates are wholesale
  // replacements, which is exactly the value-in-new-value-out contract.
  let raw = $state.raw(applyInit(def, def.defaults(), targeting));

  if (targeting.length === 0) {
    // identity fast path — no chain is built
    const identity: PluginPipeline<T> = {
      def,
      targeting,
      get raw() {
        return raw;
      },
      setRaw(value: T) {
        raw = value;
      },
      get exposed() {
        return raw;
      },
    };
    return identity;
  }

  const env = scope!.env;
  const projected = $derived.by(() => {
    let current = raw;
    for (const plugin of targeting) {
      if (!eligible(plugin, def, env)) continue;
      const before = hooksOf(plugin).before;
      if (typeof before === 'function') current = before(current, env) as T;
    }
    return current;
  });
  const exposed = $derived.by(() => {
    let current = projected;
    for (let i = targeting.length - 1; i >= 0; i--) {
      const plugin = targeting[i];
      if (!eligible(plugin, def, env)) continue;
      const after = hooksOf(plugin).after;
      if (typeof after === 'function') current = after(current, env) as T;
    }
    return current;
  });

  const pipeline: PluginPipeline<T> = {
    def,
    targeting,
    get raw() {
      return raw;
    },
    setRaw(value: T) {
      raw = value;
    },
    get exposed() {
      return exposed;
    },
  };
  return pipeline;
}
