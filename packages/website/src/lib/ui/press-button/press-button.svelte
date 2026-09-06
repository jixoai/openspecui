<!--
  jixoai press button (registry/files/ui/press-button/press-button.svelte).
  Press law (theme .jx-press): hover grows the shadow only — the body
  never moves; active presses the body +1px into the page while the
  box-shadow's offsets counter-shrink 1px (the theme's *-press poses)
  — the shadow paint stays anchored, no pseudo layer. Variants change
  paint, never physics: fill / tonal / outline / ghost are the
  prominence ladder of the variant grammar (openspec/changes/
  variant-grammar); link is the grammar's one interaction exception —
  no frame, no press shadow, primary text, hover underline. Semantic
  color is hue injection, never a variant: --jx-fill + --jx-fill-ink
  (always together, one class: jx-pair-destructive), --jx-tonal
  (jx-hue-* intent utilities), --jx-outline ride class utilities at
  the call site (arbitrary properties remain the escape hatch;
  destructive action = fill + jx-pair-destructive — the pair
  utility injects --jx-fill WITH --jx-fill-ink in one class; the
  copied transient is tonal + jx-hue-success — copied left the union
  with the semantic names).

  One opt-in effect loop per button, modeled on the animation-svelte
  reference (github.com/SikandarJODD/animations, 2026-08-23 user
  request): shimmer (a conic spark walks the perimeter, additive
  plus-lighter — Owner polish), pulse (sonar rings from the body's own
  silhouette), rainbow (a blended aurora wash on three prime
  timelines), ripple (ink from the activation point — WAAPI-driven,
  removed on animation.finished, round or bevel/diamond silhouette).
  Effects are typed builders exported from the module script:

    import PressButton, { shimmer, pulse, rainbow, ripple }
      from '@ui/press-button.svelte';
    <PressButton variant="fill" effect={shimmer({ speed: 4000 })}>
      deploy
    </PressButton>

  The ripple RUNTIME (spawn geometry, WAAPI lifecycle, reduced-motion
  gate) lives in ./ripple.svelte.ts — extracted verbatim (2026-08-26)
  when Chip needed the same loop; its visual halves stay in this
  folder's press-button.css.

  The async idiom (enhance-picker-feedback, 2026-08-30) — `loading`
  pose + `flash()` success, the two-step deploy pattern:

  - loading's ANCHOR CONTRACT: aria-disabled="true" (the element stays
    focusable — tab order unchanged — and stays opaque to WHY it is
    inert), pointer AND keyboard activation suppressed at the one seam
    every path funnels through (click — native buttons synthesize it
    from Enter/Space), and for `href` anchors the navigation itself is
    blocked (preventDefault). Never the disabled attribute: that would
    drop the button from the tab order and mute its semantics.
  - the spinner glyph takes the LEADING lane (before the label): the
    spin family's bracket cursor, inlined (registry items stay
    dependency-free) — keyframes in press-button.css (D1-exempt
    residue), reduced motion freezes on the static first frame.
  - the press law HOLDS in the loading pose: hover still grows only
    the shadow, active still presses +1px — loading is a SEMANTIC
    state, never a physics change.
  - success is a ONE-SHOT `flash()` helper (instance export via
    bind:this): the leading lane swaps to a ✓ check for 1.2s (default,
    ms overridable) with data-jx-press-state="success", then rests.
    ONE idiom, deliberately — declarative state toggles would invite
    half-wired two-step buttons.

  GROUP CONTEXT (r13, ButtonGroup upgrade; the Defaults read since
  context-defaults-economy 2.1): inside a ButtonGroup the button
  ADOPTS the group's variant when the consumer passes none —
  `explicit ?? ambient ?? 'outline'`, resolved through
  PressButtonDefaults (the family's single read point): the ambient
  lane reads the ONE paint zone key (the stamped-
  attribute law's consumer face: an explicit prop ALWAYS wins, the
  zone/group config is the inherited default, the own default never
  changes). The ladder itself is untouched — context selects a rung,
  never mints one.

  tw4 (2026-08-24): the button body was already utility-authored
  (variants + the --jx-press* pose wiring ride utilities — the press
  law's wiring is untouched); the effect loops move VERBATIM to
  press-button.css — keyframes, @property registrations, cqw math and
  ::after builds are all D1-exempt machinery, and splitting each
  layer's static half from its animated half would separate one
  logical unit across two sheets. Only the hosts' stacking pose
  (relative z-0) became utilities.
-->
<script module lang="ts">
  import type { pressButtonVariantSlot } from './press-button-defaults.svelte';

  /** the prominence ladder + the one interaction exception (link) —
   *  the variant grammar's whole button union. The VALUE DOMAIN
   *  belongs to the paint axis since context-defaults-economy 1.2
   *  (lib/paint.svelte owns the wide PaintVariant); since
   *  slot-values-first the alias points at the FAMILY slot's
   *  ReturnType — pressButtonVariantSlot's five-value tuple is the
   *  union's single declaration point (声明点唯一化), and
   *  pass-through consumers (icon-button) keep importing this —
   *  lib→ui stays a one-way street, ui→lib is the legal direction */
  export type PressButtonVariant = ReturnType<typeof pressButtonVariantSlot>;

  /** the zone texture context: a subtree-scoped default for the
   *  physics axis, written by ButtonVariantScope (the same zero-DOM
   *  boundary that scopes the variant) and by the joined ButtonGroup
   *  (its subtree rides flat while the root carries the one cluster
   *  shadow, Owner 2026-09-04) — a card/dialog FOOT zone sets
   *  raised=false so its buttons ride flat unless an explicit prop
   *  says otherwise. A SEPARATE key from the paint zone on purpose
   *  (the single-key law): PAINT_ZONE_KEY is paint policy a
   *  ButtonGroup inherit-then-provides — shadows it only when it
   *  declares a variant of its own — while the group takes PHYSICS
   *  over at its own boundary (the cluster-shadow law). The
   *  per-button law stands: paint never modulates poses, and an
   *  explicit prop still beats the zone */
  export interface PressTextureApi {
    /** the zone's raised default — consumed as explicit ?? zone ?? true */
    readonly raised: boolean | undefined;
  }
  /** context key — global symbol registry (independent registry items) */
  export const PRESS_TEXTURE_KEY = Symbol.for('jx-press-texture');

  /** the one opt-in effect loop — builders keep options typed and discoverable */
  export type PressEffect = ShimmerEffect | PulseEffect | RainbowEffect | RippleEffect;

  export interface ShimmerOptions {
    /** the spark color (any CSS color) */
    color?: string;
    /** the conic arc width of the spark */
    spread?: string;
    /** how far the spark bleeds inward from the border */
    cut?: string;
    /** one slide pass, in ms (the spin runs at 2×) */
    speed?: number;
  }
  export interface ShimmerEffect {
    readonly type: 'shimmer';
    color: string;
    spread: string;
    cut: string;
    speed: number;
  }
  export function shimmer({
    color = 'currentColor',
    spread = '90deg',
    cut = '0.06em',
    speed = 3000,
  }: ShimmerOptions = {}): ShimmerEffect {
    return { type: 'shimmer', color, spread, cut, speed };
  }

  export interface PulseOptions {
    /** the sonar ring color (any CSS color) */
    color?: string;
    /** one ring cycle, in ms */
    duration?: number;
    /** how far the ring expands */
    distance?: string;
    /** slow: expand-and-fade · ring: breathe out and back · ripple: eased expand-fade */
    variant?: 'slow' | 'ring' | 'ripple';
  }
  export interface PulseEffect {
    readonly type: 'pulse';
    color: string;
    duration: number;
    distance: string;
    variant: 'slow' | 'ring' | 'ripple';
  }
  export function pulse({
    color = 'var(--primary)',
    duration = 2500,
    distance = '0.7em',
    variant = 'slow',
  }: PulseOptions = {}): PulseEffect {
    return { type: 'pulse', color, duration, distance, variant };
  }

  export interface RainbowOptions {
    /** base pace — the three prime timelines run at 3s / 5s / 7s when speed is 2000 */
    speed?: number;
    /** the gradient stops, first-to-last around the conic wheel */
    colors?: [string, ...string[]];
  }
  export interface RainbowEffect {
    readonly type: 'rainbow';
    speed: number;
    colors: [string, ...string[]];
  }
  export function rainbow({
    speed = 2000,
    colors = [
      'hsl(0 100% 63%)',
      'hsl(270 100% 63%)',
      'hsl(210 100% 63%)',
      'hsl(195 100% 63%)',
      'hsl(90 100% 63%)',
    ],
  }: RainbowOptions = {}): RainbowEffect {
    return { type: 'rainbow', speed, colors };
  }

  export interface RippleOptions {
    /** the ink color (any CSS color) */
    color?: string;
    /** one ink expansion, in ms */
    duration?: number;
    /** the ink silhouette — round pins against the site-wide bevel law;
     *  bevel cuts the corners into a diamond (a 45° square where
     *  corner-shape is unsupported — the same shape to the eye) */
    shape?: 'round' | 'bevel';
  }
  export interface RippleEffect {
    readonly type: 'ripple';
    color: string;
    duration: number;
    shape: 'round' | 'bevel';
  }
  export function ripple({
    color = 'currentColor',
    duration = 600,
    shape = 'round',
  }: RippleOptions = {}): RippleEffect {
    return { type: 'ripple', color, duration, shape };
  }

  // corner-shape gates the bevel ink's fast path; where it's missing the
  // flat fallback turns a square 45° — the same diamond to the eye
  const bevelInk =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('corner-shape', 'bevel');
</script>

<script lang="ts">
  import { getContext, onDestroy } from 'svelte';
  import type { Snippet } from 'svelte';
  import { icons } from '$lib/icons';
  import type { Density } from '$lib/density.svelte';
  import { PressButtonDefaults } from './press-button-defaults.svelte';
  import { createRipple } from './ripple.svelte';
  import './press-button.css';

  interface Props {
    /** DENSITY override: explicit ?? ambient ?? no-opinion — resolved
     *  through PressButtonDefaults (the family contract); undefined
     *  stamps nothing and the ambient css scope channel flows */
    density?: Density;
    /** the ladder rung; semantic hue is injected through the grammar
     *  tokens (--jx-fill/--jx-fill-ink, --jx-tonal, --jx-outline) at
     *  the call site, never a variant. Ambient-manageable: an absent
     *  prop adopts the paint zone's rung (a ButtonGroup or variant
     *  scope), else the frozen own 'outline' — explicit always wins */
    variant?: PressButtonVariant;
    /** built by shimmer() / pulse() / rainbow() / ripple() — one loop per button */
    effect?: PressEffect;
    href?: string;
    /** Opens non-internal hrefs (not starting with "/") in a new tab. */
    external?: boolean;
    /** the ASYNC pose (enhance-picker-feedback): aria-disabled="true",
     *  focusable, pointer AND keyboard activation suppressed, href
     *  navigation blocked, spinner glyph in the leading lane — the
     *  press law (hover shadow / active +1px) holds unchanged. Pair
     *  with the one-shot flash() on settle. */
    loading?: boolean;
    onclick?: () => void;
    type?: 'button' | 'submit';
    /** the native popover invoker association (button-only; anchors
     *  cannot invoke popovers) — composers like ButtonGroup's overflow
     *  trigger drive a popover panel's open/close through the platform
     *  path with zero component listeners. Set aria-haspopup through
     *  the composing family (it names the panel's role, not this
     *  button's) */
    popovertarget?: string;
    ariaLabel?: string;
    /** square pose: a size-10.5 (42px) frame with no padding — the
     *  icon/toolbar idiom, level with the text button's own band;
     *  press law and every variant ride unchanged */
    square?: boolean;
    /** THE PHYSICS AXIS (Owner 2026-09-03), orthogonal to the paint
     *  ladder: raised=true (default) keeps the convex law byte-identical;
     *  raised=false is the FLAT texture — no rest/hover shadow, the
     *  body never moves on press, and an engrave-tier INSET alone
     *  creates the pushed-into-the-plane illusion. All through the
     *  pose customs (press law, jixoai.css); the 1px border frame
     *  stays (an inset is never the sole affordance, r14-12). The
     *  link rung carries no jx-press — this prop is inert there.
     *  No static default: a zone (ButtonVariantScope, or the joined
     *  ButtonGroup itself — its subtree rides flat while the root
     *  carries the cluster shadow, Owner 2026-09-04) may scope the
     *  default to false — resolution is explicit ?? zone ?? true */
    raised?: boolean;
    /** appended to the composed classes (same-family overrides need
     *  the consumer's `!` — same-property utility order is not
     *  consumer-guaranteed) */
    class?: string;
    children: Snippet;
  }

  let {
    density,
    variant = undefined,
    effect = undefined,
    href,
    external = undefined,
    loading = false,
    onclick,
    type = 'button',
    popovertarget = undefined,
    ariaLabel,
    square = false,
    raised = undefined,
    class: className = '',
    children,
  }: Props = $props();

  // THE single read point (context-defaults-economy 2.1): the family
  // Defaults resolves every style prop in one $derived window — the
  // paint slot's ambient lane reads the zone key → the legacy
  // ButtonGroup fallback inside THIS component's dependency graph
  // (getter-endorsed: a parent variant flip re-derives the stamp in
  // the same frame), the density slot wraps resolveDensity's full
  // semantics (plugin chain included, no-opinion stays undefined).
  // explicit prop → ambient → the frozen own 'outline': the
  // stamped-attribute law's consumer face (explicit ALWAYS wins)
  const d = $derived(PressButtonDefaults.resolve({ variant, density }));
  // the flat-pose block reads the resolved variant through this alias —
  // same value as d.variant, named beside resolvedRaised for the
  // pose-vs-texture pairing
  const resolvedVariant = $derived(d.variant);

  // the zone texture context — same read-once pattern, its own key
  // (the joined ButtonGroup writes it flat — the cluster-shadow law,
  // see the module comment).
  // Resolution mirrors the variant's: explicit prop → the zone's
  // default → the own convex default; the ladder of defaults never
  // changes the LAWS — a zone scopes which texture a bare button
  // adopts, never mints physics of its own
  const texture = getContext<PressTextureApi | undefined>(PRESS_TEXTURE_KEY);
  const resolvedRaised = $derived(raised ?? texture?.raised ?? true);
  // the flat STAMP (Owner ruling, 2026-09-04): the kernel's corner-tint
  // border keys on it — the pressed face is one carved light model,
  // not an inset beside a static frame. Same gate as the pose block
  // (flat × non-link; link carries no jx-press at all).
  // (site patch, 2026-09-06): moved below resolvedRaised — $derived bodies
  // evaluate lazily so the reorder is semantics-neutral; TS 5.9 flags the
  // forward reference (openspecui website svelte-check gate)
  const flat = $derived(!resolvedRaised && resolvedVariant !== 'link');

  // ---- the one-shot success flash (the async idiom's second step) -----
  // ONE idiom, component-owned: flash() paints the ✓ glyph +
  // data-jx-press-state="success" for 1.2s (ms overridable), then the
  // button rests. No declarative success prop — half-wired two-step
  // buttons are exactly the drift this closes.
  let flashState = $state<'idle' | 'success'>('idle');
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  /** the second step of the async two-step: call when the promise
   *  resolves — a one-shot ✓ check flash (default 1.2s), then rest */
  export function flash(ms = 1200): void {
    if (flashTimer !== undefined) clearTimeout(flashTimer);
    flashState = 'success';
    flashTimer = setTimeout(() => {
      flashState = 'idle';
      flashTimer = undefined;
    }, ms);
  }

  onDestroy(() => {
    if (flashTimer !== undefined) clearTimeout(flashTimer);
  });

  // the square swaps ONLY geometry: one band (42px, the text button's
  // own height) with the glyph centered — paint, physics and effects
  // are identical to the text pose. The forced-colors trio pins the
  // focus law for every rung: 2px Highlight, offset 2, never removed
  // (design §6 — the site ring var does not survive forced colors).
  const focusForced = 'forced-colors:outline-2 forced-colors:outline-offset-2 forced-colors:[outline-color:Highlight]';
  const base = $derived(
    square
      ? `inline-flex min-h-[var(--jx-hit)] min-w-[var(--jx-hit)] items-center justify-center text-[length:var(--jx-text)] leading-[var(--jx-line)] font-medium ${focusForced}`
      : `inline-flex min-h-[var(--jx-hit)] items-center gap-[var(--jx-gap)] px-[var(--jx-inset)] text-[length:var(--jx-text)] leading-[var(--jx-line)] font-medium ${focusForced}`,
  );
  // the bordered, shadow-bearing body (link opts out entirely). The
  // frame contributes width + physics ONLY: every rung below supplies
  // all three paint channels itself, so no two same-property utilities
  // ever meet in one class list — named border-color utilities sort
  // AFTER arbitrary ones in the sheet, and same-family utility order
  // is not consumer-guaranteed; the map stays collision-free by
  // construction (variant grammar, openspec/changes/variant-grammar).
  // Each rung also carries its design §6 forced-colors degradation:
  // fill → ButtonFace/ButtonText, tonal/outline → Canvas/CanvasText
  // (the color-mix tints do NOT drop on their own — probed), ghost →
  // transparent rest, ButtonFace/ButtonText hover.
  const frame = 'jx-press border';
  const variants = {
    fill: `${frame} [background:var(--jx-fill)] [border-color:var(--jx-fill)] text-[color:var(--jx-fill-ink)] forced-colors:bg-[ButtonFace] forced-colors:border-[ButtonText] forced-colors:text-[ButtonText]`,
    tonal: `${frame} bg-[color-mix(in_oklab,var(--jx-tonal)_12%,transparent)] border-[color-mix(in_oklab,var(--jx-tonal)_45%,transparent)] text-[color:var(--jx-tonal)] forced-colors:bg-[Canvas] forced-colors:border-[CanvasText] forced-colors:text-[CanvasText]`,
    outline: `${frame} bg-transparent [border-color:var(--jx-outline)] text-foreground hover:bg-[color-mix(in_oklab,var(--jx-tonal)_8%,transparent)] forced-colors:bg-[Canvas] forced-colors:border-[CanvasText] forced-colors:text-[CanvasText]`,
    // ghost keeps the box geometry (width-only border + transparent
    // color) but presses without a shadow — r2 blocker fix: the width
    // class is load-bearing, border-transparent alone computes to 0px
    ghost: `jx-press border border-transparent bg-transparent hover:bg-[color-mix(in_oklab,var(--jx-tonal)_8%,transparent)] hover:text-[color:var(--jx-tonal)] [--jx-press-shadow:none] [--jx-press-shadow-hover:none] [--jx-press-shadow-active:none] forced-colors:bg-transparent forced-colors:border-transparent forced-colors:text-[CanvasText] forced-colors:hover:bg-[ButtonFace] forced-colors:hover:text-[ButtonText]`,
    // link: the interaction exception — no frame, no press shadow, primary text
    link: 'text-primary underline-offset-4 hover:underline forced-colors:text-[LinkText]',
  } as const;

  // effect host class (the stacking pose rides utilities: relative z-0
  // keeps the negative-z layers under the in-flow label) + the custom
  // properties its loop reads
  const effectClass = $derived.by(() => {
    if (!effect) return '';
    switch (effect.type) {
      case 'shimmer':
        return 'relative z-0';
      case 'pulse':
        return 'relative z-0';
      case 'rainbow':
        return 'jx-rainbow-host relative z-0';
      case 'ripple':
        return 'relative z-0';
    }
  });
  const effectStyle = $derived.by(() => {
    if (!effect) return '';
    switch (effect.type) {
      case 'shimmer':
        return `--shimmer-color:${effect.color}; --shimmer-spread:${effect.spread}; --shimmer-cut:${effect.cut}; --shimmer-speed:${effect.speed}ms`;
      case 'pulse':
        return `--pulse-color:${effect.color}; --pulse-duration:${effect.duration}ms; --pulse-distance:${effect.distance}`;
      case 'rainbow':
        return `--rainbow-tx:${(effect.speed * 3) / 2}ms; --rainbow-ty:${(effect.speed * 5) / 2}ms; --rainbow-t1:${(effect.speed * 7) / 2}ms; --rainbow-t2:${(effect.speed * 11) / 2}ms; --rainbow-t3:${(effect.speed * 13) / 2}ms; --rainbow-t4:${(effect.speed * 17) / 2}ms; ${effect.colors
          .map((c, i) => `--c${i + 1}:${c}`)
          .join('; ')}`;
      case 'ripple':
        return '';
    }
  });

  // ripple: the shared runtime (./ripple.svelte.ts) — ink circles from
  // the activation point; keyboard activation (click with detail 0)
  // ripples from the center. Reduced motion skips the ink inside the
  // factory — the anchored press already answers the pointer.
  const rippleRuntime = createRipple(() => onclick?.());

  // ---- the loading lock (the anchor contract's enforcement seam) ------
  // EVERY activation path funnels through click — native buttons
  // synthesize it from Enter AND Space, anchors from Enter — so one
  // guard covers pointer and keyboard alike. loading: buttons no-op;
  // anchors preventDefault (the navigation itself is blocked). Tab
  // order is untouched — aria-disabled, never the disabled attribute.
  function onButtonClick(event: MouseEvent & { currentTarget: HTMLElement }): void {
    if (loading) return;
    // the ripple is part of the ACTIVATION path — it must spawn (or be
    // suppressed with the loading lock) exactly when the consumer fires
    if (effect?.type === 'ripple') {
      rippleRuntime.onclick(event as MouseEvent & { currentTarget: HTMLAnchorElement });
      return;
    }
    onclick?.();
  }
  function onAnchorClick(event: MouseEvent & { currentTarget: HTMLAnchorElement }): void {
    if (loading) {
      event.preventDefault();
      return;
    }
    if (effect?.type === 'ripple') rippleRuntime.onclick(event);
  }

  // THE FLAT POSE (raised={false}): the variant's own pose customs are
  // stripped FIRST (ghost's none-trio would collide with the flat block
  // — no two same-property utilities in one class list), then the flat
  // block supplies all four seams: no rest shadow, no hover shadow,
  // the press pose re-pointed to the engrave tier (an inset — pressed
  // INTO the plane), and the press vector nulled (the body never
  // moves; the inset alone creates the illusion). Link carries no
  // jx-press: the strip is a no-op and the block is skipped.
  const flatPose =
    '[--jx-press-shadow:none] [--jx-press-shadow-hover:none] [--jx-press-shadow-active:var(--shadow-engrave)] [--jx-press-move:none]';
  const variantClasses = $derived(
    !resolvedRaised && resolvedVariant !== 'link'
      ? `${variants[resolvedVariant].replace(/\s*\[--jx-press-shadow[^\]]*\]\s*/g, ' ')} ${flatPose}`
      : variants[resolvedVariant],
  );

  const classes = $derived(
    `${base} ${variantClasses}${effectClass ? ` ${effectClass}` : ''}${className ? ` ${className}` : ''}`
  );
  const isExternal = $derived(external ?? (href !== undefined && !href.startsWith('/')));

  // the leading lane (enhance-picker-feedback): loading swaps in the
  // bracket-cursor spinner (the spin family's glyph, inlined), the
  // flash swaps in the ✓ check — one glyph slot, never both
  const leadingGlyph = $derived(loading ? 'spin' : flashState === 'success' ? 'check' : 'none');
</script>

{#snippet layers()}
  {#if effect?.type === 'ripple'}
    <span class="jx-ripple-layer" aria-hidden="true">
      {#each rippleRuntime.ripples as r (r.key)}
        <span
          class="jx-ripple-dot{effect.shape === 'bevel' && !bevelInk ? ' jx-ripple-flat' : ''}"
          data-shape={effect.shape}
          style="width:{r.size}px; height:{r.size}px; top:{r.y}px; left:{r.x}px;
            --ripple-color:{effect.color}"
          use:rippleRuntime.ink={{ key: r.key, duration: effect.duration }}
        ></span>
      {/each}
    </span>
  {:else if effect?.type === 'shimmer'}
    <span class="jx-shimmer-box" aria-hidden="true">
      <span class="jx-shimmer-slide"><span class="jx-shimmer-spark"></span></span>
    </span>
    <span class="jx-shimmer-cover" aria-hidden="true"></span>
  {:else if effect?.type === 'pulse'}
    <span
      class="jx-pulse-layer"
      class:jx-pulse-slow={effect.variant === 'slow'}
      class:jx-pulse-ring={effect.variant === 'ring'}
      class:jx-pulse-ripple={effect.variant === 'ripple'}
      aria-hidden="true"
    ></span>
  {/if}
{/snippet}

{#snippet leadingLane()}
  {#if leadingGlyph === 'spin'}
    <!-- the bracket-cursor spinner, the spin family's glyph inlined
         (registry items stay dependency-free); keyframes + the
         reduced-motion static-frame freeze live in press-button.css -->
    <span data-jx-press-spin="" class="jx-press-spin font-mono text-primary" aria-hidden="true">[&nbsp;<span class="jx-press-spin-frames relative inline-grid w-[1ch] text-center align-bottom"><i class="not-italic row-start-1 col-start-1 visible animate-[jx-press-spin-frame_800ms_steps(1)_infinite]">/</i><i class="invisible not-italic row-start-1 col-start-1 animate-[jx-press-spin-frame_800ms_steps(1)_infinite] [animation-delay:200ms]">—</i><i class="invisible not-italic row-start-1 col-start-1 animate-[jx-press-spin-frame_800ms_steps(1)_infinite] [animation-delay:400ms]">\\</i><i class="invisible not-italic row-start-1 col-start-1 animate-[jx-press-spin-frame_800ms_steps(1)_infinite] [animation-delay:600ms]">|</i></span>&nbsp;]</span>
  {:else if leadingGlyph === 'check'}
    <!-- the one-shot success flash glyph (flash() painted it; it
         rests after 1.2s) -->
    <span data-jx-press-check="" class="inline-flex flex-none items-center text-primary [&_svg]:h-3.5 [&_svg]:w-3.5" aria-hidden="true">
      {@html icons.check}
    </span>
  {/if}
{/snippet}

{#if href}
  <a
    {href}
    target={isExternal ? '_blank' : undefined}
    rel={isExternal ? 'noreferrer' : undefined}
    aria-label={ariaLabel}
    aria-disabled={loading ? 'true' : undefined}
    data-jx-press-state={flashState === 'success' ? 'success' : undefined}
    data-density={d.density}
    data-jx-press-button={d.variant}
    data-jx-press-flat={flat ? '' : undefined}
    data-jx-shimmer-host={effect?.type === 'shimmer' ? '' : undefined}
    data-jx-pulse-host={effect?.type === 'pulse' ? '' : undefined}
    data-jx-ripple-host={effect?.type === 'ripple' ? '' : undefined}
    class={classes}
    style={effectStyle || undefined}
    onclick={onAnchorClick}
  >
    {@render layers()}
    {@render leadingLane()}
    {@render children()}
  </a>
{:else}
  <button
    {type}
    onclick={onButtonClick}
    aria-label={ariaLabel}
    aria-disabled={loading ? 'true' : undefined}
    data-jx-press-state={flashState === 'success' ? 'success' : undefined}
    data-density={d.density}
    data-jx-press-button={d.variant}
    data-jx-press-flat={flat ? '' : undefined}
    popovertarget={popovertarget}
    data-jx-shimmer-host={effect?.type === 'shimmer' ? '' : undefined}
    data-jx-pulse-host={effect?.type === 'pulse' ? '' : undefined}
    data-jx-ripple-host={effect?.type === 'ripple' ? '' : undefined}
    class={classes}
    style={effectStyle || undefined}
  >
    {@render layers()}
    {@render leadingLane()}
    {@render children()}
  </button>
{/if}
