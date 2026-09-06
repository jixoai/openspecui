/*
  jixoai ripple runtime (registry/files/ui/press-button/ripple.svelte.ts).
  The ink loop shared by every ripple-bearing control: spawn geometry
  (pointer origin, or the center for keyboard activation — click with
  detail 0), the WAAPI lifecycle (the dot expands by script and leaves
  the DOM when the animation finishes; destroy cancels), and the
  reduced-motion gate (the ink skips when the user asks for stillness —
  the anchored press already answers the pointer).

  Extracted verbatim from press-button.svelte (2026-08-26) when Chip
  needed the same loop — behavior byte-equal. The visual halves
  (.jx-ripple-layer/dot/flat) stay in press-button.css; every host
  imports that sheet.
*/
export interface RippleInk {
  x: number;
  y: number;
  size: number;
  key: number;
}

export interface RippleRuntime {
  /** reactive ink queue — render into the host's .jx-ripple-layer */
  readonly ripples: RippleInk[];
  /** use: action — WAAPI owns the dot's lifecycle */
  ink: (
    dot: HTMLElement,
    params: { key: number; duration: number }
  ) => { destroy: () => void };
  /** the host's click handler: spawn from the activation point, then
   *  the consumer's own activation */
  onclick: (event: MouseEvent & { currentTarget: HTMLElement }) => void;
}

export function createRipple(onActivate?: () => void): RippleRuntime {
  let ripples = $state<RippleInk[]>([]);
  let rippleSeq = 0;

  const spawnRipple = (
    host: HTMLElement,
    clientX: number,
    clientY: number,
    fromPointer: boolean
  ): void => {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
      return;
    const rect = host.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const px = fromPointer ? clientX : rect.left + rect.width / 2;
    const py = fromPointer ? clientY : rect.top + rect.height / 2;
    const key = ++rippleSeq;
    ripples = [...ripples, { x: px - rect.left - size / 2, y: py - rect.top - size / 2, size, key }];
  };

  const ink = (dot: HTMLElement, params: { key: number; duration: number }) => {
    const anim = dot.animate(
      [
        { transform: 'scale(0)', opacity: 1 },
        { transform: 'scale(2)', opacity: 0 },
      ],
      { duration: params.duration, easing: 'ease-out', fill: 'both' }
    );
    const clear = () => {
      ripples = ripples.filter((r) => r.key !== params.key);
    };
    anim.finished.then(clear, clear);
    return {
      destroy() {
        anim.cancel();
      },
    };
  };

  const onclick = (event: MouseEvent & { currentTarget: HTMLElement }): void => {
    spawnRipple(event.currentTarget, event.clientX, event.clientY, event.detail > 0);
    onActivate?.();
  };

  return {
    get ripples() {
      return ripples;
    },
    ink,
    onclick,
  };
}
