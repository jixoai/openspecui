<!--
  jixoai popover (registry/files/ui/popover/popover.svelte).

  NativeHTML base (2026-08-20): the Popover API — `popover="auto"` on the
  panel plus a trigger button wired declaratively through `popovertarget`.
  Light dismiss (outside click / focus loss), Escape, aria-expanded on the
  trigger, one-auto-popover-at-a-time, and top-layer rendering are all
  browser-native. The declarative path (default trigger) runs zero
  listeners and zero positioning script; the only runtime script is the
  single native toggle seam plus the optional imperative handle.

  Anchored placement (2026-08-21, Owner ruling): the panel anchors to the
  trigger through the CSS Anchor Positioning API — `anchor-name` on the
  wrapper, `position-anchor` + `position-area` on the panel (both the
  current name and its `inset-area` legacy alias are set inline; Chrome
  127+ dropped the old name, older engines ignore the new one), plus native
  `position-try`/`position-try-fallbacks` flipping (block/inline — the
  MDN-recommended shorthand ships alongside the longhand) and
  `position-visibility: anchors-visible` so a panel whose anchor scrolled
  away hides instead of floating stale. Declarative CSS
  positioning replaces every line of JS geometry: no measure-and-replace,
  so the panel cannot jitter on open. Engines without anchor positioning
  fall back to authored viewport-center (inset + margin:auto) — the same
  visual as v1, never worse.

  Props:
    id            popover id; popovertarget association + anchor name
    triggerLabel  trigger button label (ignored when `trigger` snippet given)
    placement     the INITIAL anchored position: the six classic sides
                  plus 'left' | 'right' | 'center' (the nine-grid
                  positions). Default 'bottom-end' — under the trigger,
                  right edges aligned
    variant       floating-surface variant: 'solid' | 'acrylic' | 'auto'
                  (default 'auto' — acrylic, solid under reduced
                  transparency; jixoai.css lays the law out, and the
                  WAAPI motion kernel below animates everything)
    trigger?      custom trigger snippet: render your own control inside;
                  the wrapper still carries anchor-name, so anchoring stays
                  component-owned. With anything other than a real
                  <button popovertarget={id}> you drive open/close through
                  the imperative handle.
    panelClass?   classes appended to the panel (consumer panel law: width,
                  grid, tokens — never anchoring)
    onToggle?     mirrors the panel's native toggle event; the ONLY
                  open-state source of truth for aria-expanded mirroring
    bind:this     optional imperative handle: show()/hide()/toggle() call
                  the native popover methods (no-op without the Popover
                  API). Exceptional-trigger escape hatch (link triggers,
                  hover intent) — NOT a controlled state model: no open
                  prop, no timers, no coordinates.
  Side selection (2026-08-22, Owner mobile feedback): the side is chosen
  ONCE, at open, by the native position-try fallbacks — never re-evaluated
  while open. The earlier JS bridge (rAF scroll listener picking between
  the two authored areas) is removed: it never ran at open (stale side
  across reopens) and on mobile it fought the engine plus URL-bar resize
  events, which read as direction inversion and visible jitter. Chromium's
  "no try re-evaluation on nested-scroller scroll" behavior is now
  load-bearing: the side stays locked for the popover's lifetime, and
  `position-visibility: anchors-visible` hides the panel once the anchor
  itself scrolls out of view.

  tw4 (2026-08-24): trigger/caret/scroll paint as token utilities (press
  poses ride --jx-press* custom-property utilities, verbatim law);
  popover.css keeps the D1-exempt machinery — panel anchor geometry +
  flush margin (the @supports viewport-center fallback re-sets margin to
  auto in the same layer, so a margin utility is forbidden), the
  caret's :has()+:popover-open flip, the reduced-motion caret kill, the
  override of the unlayered jx-surface ::after law, and ::backdrop.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { icons } from '$lib/icons';
  import { createSurfaceMotion } from '$lib/surface-motion';
  import { cn } from '$lib/utils';
  import { PopoverDefaults, type PopoverSurfaceVariant } from './popover-defaults.svelte';
  import './popover.css';

  /** marker interface for kernel-owned WAAPI animations */
  interface CSSElementAnimationLike extends Animation {
    __jxKernel?: boolean;
  }

  interface Props {
    id: string;
    /** Button label for the default trigger; unnecessary when a custom
        `trigger` snippet renders its own control. */
    triggerLabel?: string;
    placement?: 'bottom' | 'bottom-end' | 'bottom-start' | 'top' | 'top-end' | 'top-start' | 'left' | 'right' | 'center';
    /** floating-surface variant: solid | acrylic | auto (acrylic unless
        the environment asks for reduced transparency). Omitted → the
        contract own 'auto' (PopoverDefaults — a declared own, not
        ambient) */
    variant?: PopoverSurfaceVariant;
    /** position-try fallbacks as a raw CSS value — custom @position-try
        idents (space/comma list) replace the default flip series; pass
        e.g. '--try-top, --try-bottom-end' authored on the consumer side.
        Empty/undefined = flip-block, flip-inline (the engine default) */
    tryFallbacks?: string;
    /** anchor gap, MARGIN semantics (2026-08-26, Owner ruling): number
        → N px on all sides (uniform — also insets the inline alignment
        edges); or a full 1–4 value CSS margin shorthand ("8px 0 0 0")
        to gap ONLY the side facing the anchor while the inline edges
        stay flush-aligned with the trigger. Default 0 = the r22 flush
        law. Known limits: position-try flips do not mirror margins —
        a flipped state hugs flush again; placement="center" with
        tryFallbacks writes margin:auto (the viewport-center pair) which
        overrides the gap — center has no anchor side to gap. Validated
        against the length grammar; invalid input is ignored (dev-mode
        warns) */
    gap?: number | string;
    trigger?: Snippet;
    panelClass?: string;
    onToggle?: (open: boolean) => void;
    children: Snippet;
  }

  let {
    id,
    triggerLabel = '',
    placement = 'bottom-end',
    variant,
    tryFallbacks = '',
    gap = undefined,
    trigger,
    panelClass = '',
    onToggle,
    children,
  }: Props = $props();

  // THE DEFAULTS READ POINT (context-defaults-economy 3.2): one line —
  // the family contract resolves the panel's style props (variant's
  // own 'auto' lives in PopoverDefaults, auditable in one place;
  // density is the no-opinion axis slot — nothing stamps, the ambient
  // css scope channel keeps flowing)
  const d = $derived(PopoverDefaults.resolve({ variant }));

  // PHYSICAL placement map (r23): when tryFallbacks drives the try
  // chain, the INITIAL position is written with physical anchor()
  // insets too — a position-area on the panel outranks any candidate's
  // physical insets (the engine's try allow-list dropped inset-area),
  // so mixing the two silently disables every candidate
  const physical = $derived.by(() => {
    // left/right: hug the side, vertically centered on the anchor;
    // center: viewport-centered (inset 0 + margin auto, the same form
    // as the --jx-try-center candidate)
    if (placement === 'left' || placement === 'right') {
      const side = placement === 'left'
        ? 'right: anchor(left); left: auto'
        : 'left: anchor(right); right: auto';
      return `${side}; top: auto; bottom: auto; align-self: anchor-center;`;
    }
    if (placement === 'center') return 'top: 0; bottom: 0; left: 0; right: 0; margin: auto;';
    const c = placement.endsWith('-start') ? 'left: anchor(left); right: auto'
      : placement.endsWith('-end') ? 'left: auto; right: anchor(right)'
      : 'left: auto; right: auto; justify-self: anchor-center';
    const r = placement.startsWith('top') ? 'top: auto; bottom: anchor(top)' : 'top: anchor(bottom); bottom: auto';
    return `${r}; ${c};`;
  });

  // Anchor names are CSS custom-ident-ish: sanitize the id into a stable
  // dashed token so any consumer id yields a valid --jx-pop-* name.
  const anchorName = `--jx-pop-${id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  // the gap prop's trust boundary (Codex co-review): finite numbers
  // become px, strings must survive the margin-shorthand grammar (1–4
  // whitespace-separated zero-or-length tokens, each a STRICT number —
  // "1..2px" and friends are dropped, not smuggled) — anything else is
  // dropped so a hostile string can never smuggle a declaration into
  // the style attr
  const isLength = (t: string): boolean =>
    t === '0' || /^(\d+(\.\d+)?|\.\d+)(px|rem|em|vw|vh|%)$/.test(t);
  const gapValue = $derived.by(() => {
    if (gap === undefined || gap === null) return '';
    if (typeof gap === 'number') {
      if (!Number.isFinite(gap)) {
        if (import.meta.env.DEV) console.warn(`[popover] invalid gap ${gap} — ignored (finite number or 1–4 CSS lengths)`);
        return '';
      }
      return `${gap}px`;
    }
    const tokens = gap.trim().split(/\s+/);
    if (tokens.length < 1 || tokens.length > 4 || !tokens.every(isLength)) {
      if (import.meta.env.DEV) console.warn(`[popover] invalid gap "${gap}" — ignored (1–4 CSS lengths or a number)`);
      return '';
    }
    return tokens.join(' ');
  });
  const area = $derived(
    placement === 'bottom' ? 'bottom' :
    placement === 'bottom-end' ? 'bottom span-right' :
    placement === 'bottom-start' ? 'bottom span-left' :
    placement === 'top' ? 'top' :
    placement === 'top-end' ? 'top span-right' :
    placement === 'left' ? 'left' :
    placement === 'right' ? 'right' :
    placement === 'center' ? 'center' :
    'top span-left'
  );

  let panel = $state<HTMLElement | null>(null);
  // DIRECTION STATE (r25): the four vector props live in reactive
  // state and render through the style template — the kernel used to
  // write them imperatively via setProperty, and every Svelte style
  // re-render (placement/tryFallbacks change) REBUILT the attribute,
  // wiping them mid-flight: animations suddenly ran on the default
  // vector. Reactive = rewrite-proof by construction
  let dir = $state({ ix: '0px', iy: '6px', ox: '6px', oy: '6px' });
  // the anchor wrapper — the enter kernel measures the slide
  // direction against it at every open
  let anchorEl = $state<HTMLElement | null>(null);
  // the DEFAULT trigger only — a custom trigger snippet owns its own
  // aria-expanded (terminal-header's link triggers manage theirs)
  let triggerEl = $state<HTMLButtonElement | null>(null);
  let open = $state(false);
  const popoverApi = (el: HTMLElement | null): Pick<HTMLElement, 'showPopover' | 'hidePopover' | 'togglePopover'> | null =>
    el && typeof el.showPopover === 'function' ? el : null;

  // THE toggle seam (2026-08-20 fix): one native event covers every
  // open/close path (popovertarget, light dismiss, Escape, the handle).
  // Open state is read LIVE from :popover-open at fire time — ToggleEvent
  // state fields are never trusted (the pre-fix code read a nonexistent
  // .newValue, which made every consumer onToggle receive false) — and
  // the seam mirrors aria-expanded onto the default trigger, which
  // popovertarget alone never does.
  function onPanelToggle(): void {
    open = panel?.matches(':popover-open') ?? false;
    triggerEl?.setAttribute('aria-expanded', String(open));
    if (open && panel) {
      motion.play(1);
      motion.startTracking();
    } else {
      panel?.classList.remove('jx-rest');
      motion.play(0);
      motion.stopTracking();
    }
    onToggle?.(open);
  }

  // ── MOTION KERNEL — the shared declarative half (r29): see
  // lib/surface-motion.ts. WAAPI animates ONE @property number
  // (--jx-p); every visible property is a CSS formula of it (the
  // declarative motion law in jixoai.css). The kernel here only wires
  // the popover's toggle seam and live anchor
  const motion = createSurfaceMotion(() => panel, { anchor: () => anchorEl });

  // imperative handle (bind:this) — thin native passthroughs, nothing more
  export function show(source?: HTMLElement): void {
    const el = popoverApi(panel);
    if (el && !panel!.matches(':popover-open')) {
      // `source` names the invoking control where the popover spec supports
      // it (focus restoration, invoker semantics); engines without the
      // options bag simply ignore the argument
      (el as HTMLElement & { showPopover(options?: { source?: HTMLElement }): void }).showPopover(
        source ? { source } : undefined,
      );
    }
  }
  export function hide(): void {
    const el = popoverApi(panel);
    if (el && panel!.matches(':popover-open')) el.hidePopover();
  }
  export function toggle(): void {
    const el = popoverApi(panel);
    if (el) el.togglePopover();
  }
</script>

<span class="jx-pop-anchor inline-flex" style="anchor-name: {anchorName}" bind:this={anchorEl}>
  {#if trigger}
    {@render trigger()}
  {:else}
    <button
      type="button"
      data-jx-pop-trigger=""
      class="jx-press inline-flex cursor-pointer items-center gap-2.5 border border-border bg-background px-3.5 py-2.5 font-sans text-sm font-medium text-foreground [--jx-press-shadow:var(--shadow-xs)] [--jx-press-shadow-hover:var(--shadow-sm)] [--jx-press-shadow-active:var(--shadow-sm-press)] hover:bg-muted"
      popovertarget={id}
      bind:this={triggerEl}
      aria-expanded={open}
    >
      {triggerLabel}
      <!-- jx-pop-caret rides the wrapper: popover.css flips it via :has()
           + :popover-open (and kills its transition under reduced
           motion); the glyph is the shared module svg, sized and
           re-stroked through consuming-context CSS -->
      <span class="jx-pop-caret flex-none inline-flex transition-transform duration-150 ease-out [&_svg]:h-[13px] [&_svg]:w-[13px] [&_svg]:stroke-[2.5]">
        {@html icons.chevronDown}
      </span>
    </button>
  {/if}
</span>

<!-- one native toggle listener is the single seam: it feeds the default
     trigger's aria-expanded AND the optional onToggle consumer callback;
     open state is read live from :popover-open, never from event fields -->
<div
  {id}
  popover="auto"
  class={cn('jx-pop jx-surface', motion.supported && 'jx-waapi', panelClass)}
  data-variant={d.variant}
  bind:this={panel}
  style="--jx-pop-gap: {gapValue || '0px'}; position-anchor: {anchorName}; --jx-surface-in-x: {dir.ix}; --jx-surface-in-y: {dir.iy}; --jx-surface-ox: {dir.ox}; --jx-surface-oy: {dir.oy}; {tryFallbacks ? `${physical}; position-try: ${tryFallbacks}; position-try-fallbacks: ${tryFallbacks};` : `inset-area: ${area}; position-area: ${area};`}"
  ontoggle={onPanelToggle}
>
  <!-- jx-surface-body = THE SURFACE (fill + acrylic blur + the ::after
       shadow layer); it never scrolls or clips. The scroll+padding ring
       sits inside it (floating-surface law, arch r3: the platform
       element paints nothing). -->
  <div data-jx-pop-shadow="" class="jx-surface-shadow" aria-hidden="true"></div>
  <!-- the REAL shadow layer: a DOM child because pseudo-elements are
       unreachable from WAAPI — the kernel animates it in lockstep
       (Owner ruling r18) -->
  <div data-jx-pop-body="" class="jx-surface-body">
    <div
      data-jx-pop-scroll=""
      class="max-h-[72vh] overflow-auto [scrollbar-gutter:stable_both-edges] [padding:var(--jx-pop-pad,12px_14px)] [padding-inline:max(var(--jx-pop-pad-inline,14px)-var(--jx-scrollbar-thin,0px),0px)]"
    >
      {@render children()}
    </div>
  </div>
</div>
