/**
 * Surface motion kernel (registry/files/lib/surface-motion.ts).
 *
 * The declarative motion law's JS half (Owner rulings r26–r28): WAAPI
 * animates exactly ONE @property-registered number — --jx-p, the
 * timeline progress — and every visible property is a CSS formula of
 * it (see the floating-surface law in jixoai.css). This kernel never
 * touches a layout property; its two jobs are the LIFECYCLE (drive
 * --jx-p between 0 and 1, 460ms linear, debuggable in Chrome's
 * animation panel) and the LIVE AXIS (an rAF loop publishing the
 * panel↔anchor unit vector as --jx-dx/--jx-dy; dialogs pass no anchor
 * and ride the project-default bottom-right).
 *
 * Lifecycle asymmetry, hard-won (r27): an animation created while the
 * panel is still display:none never runs — ENTRY pins the start value
 * inline and creates the animation on the NEXT frame, after the
 * display flip; EXIT (whose panel stays rendered through the
 * allow-discrete window) starts at once and keeps sampling the
 * computed progress until the display flips, landing lastP on 0 (a
 * stale lastP made the next entry a 1→1 no-op).
 *
 * At rest the tracker toggles .jx-rest (the law maps it to
 * filter:none — a lingering blur(0px) keeps a filter layer alive and
 * disturbs the backdrop compositing). Reduced motion jumps the same
 * lifecycle to its end instantly.
 */

export interface SurfaceMotionOptions {
  /** live anchor for the axis; omit (dialogs) for the default axis */
  anchor?: () => HTMLElement | null;
}

/** engine capability probe, exported for multi-panel consumers that
 *  need the .jx-waapi gate BEFORE any panel's kernel exists (menubar:
 *  one lazily-created kernel per panel — no instance at render time) */
export const surfaceMotionSupported: boolean =
  typeof CSS !== 'undefined' && typeof CSS.registerProperty === 'function' && typeof window !== 'undefined';

export interface SurfaceMotion {
  /** drive the timeline: 1 = entry, 0 = exit */
  play(to: number): void;
  /** start the live-axis rAF loop (while logically open) */
  startTracking(): void;
  /** stop the loop (the axis freezes at the last sample) */
  stopTracking(): void;
  /** drop every frame and the animation */
  destroy(): void;
  /** false when the engine cannot animate the timeline (no @property) */
  readonly supported: boolean;
}

const DURATION_MS = 460;
/** the blur formula is 100px*(1-clamp(p*2)) — at p>=0.5 it computes
 *  to blur(0px), and a RESIDUAL blur(0px) still creates a filter
 *  layer that disturbs the backdrop compositing. The hard rule
 *  (Owner, 2026-08-23 r30): whenever the blur would be zero, the
 *  filter is NONE — the whole second half of the timeline and the
 *  exit above the midpoint, not just the settled rest */
const REST_THRESHOLD = 0.5;
const isResting = (pv: number): boolean => pv >= REST_THRESHOLD;

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const raf = (cb: FrameRequestCallback): number =>
  typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : 0;
const caf = (id: number): void => {
  if (id && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
};

export function createSurfaceMotion(
  panel: () => HTMLElement | null,
  opts: SurfaceMotionOptions = {},
): SurfaceMotion {
  const supported = surfaceMotionSupported;

  let progressAnim: Animation | null = null;
  let trackFrame = 0;
  let entryFrame = 0;
  let exitFrame = 0;
  // generation token: a deferred entry callback from a superseded run
  // must not create its animation
  let runToken = 0;
  // last observed progress: the engine cancels the fill-both progress
  // animation when the closed panel's display flips — reading the
  // computed --jx-p at close time then returns the cascade initial 0
  let lastP = 0;

  function play(to: number): void {
    const p = panel();
    if (!p) return;
    progressAnim?.cancel();
    if (prefersReducedMotion()) {
      lastP = to;
      runToken += 1;
      caf(entryFrame);
      caf(exitFrame);
      p.style.setProperty('--jx-p', String(to)); // jump to complete
      p.classList.toggle('jx-rest', isResting(to));
      return;
    }
    const from = lastP;
    const token = ++runToken;
    // pin the start inline FIRST: an animation created while the panel
    // is still display:none never runs (the engine skips it)
    p.style.setProperty('--jx-p', String(from));
    if (to < from) {
      // EXIT starts at `from` — apply the zero-blur rule IMMEDIATELY:
      // at from>=0.5 the first exit frame computes blur(0px) and the
      // sampler only lands next frame (r30 hard rule, frame zero)
      p.classList.toggle('jx-rest', isResting(from));
    } else {
      p.classList.remove('jx-rest'); // the blur formula must own filter again
    }
    caf(entryFrame);
    caf(exitFrame);
    if (from === to) return; // nothing to animate
    if (to < from) {
      // EXIT: start at once, keep sampling until the display flips so
      // lastP lands on 0 for the next entry
      progressAnim = p.animate(
        [{ '--jx-p': from }, { '--jx-p': to }],
        { duration: DURATION_MS, easing: 'linear', fill: 'both' },
      );
      const sample = (): void => {
        if (token !== runToken) return;
        if (getComputedStyle(p).display === 'none') {
          lastP = 0; // the engine canceled the animation at the flip
          return;
        }
        const pv = Number(getComputedStyle(p).getPropertyValue('--jx-p'));
        if (Number.isFinite(pv)) {
          lastP = pv;
          // r30: during the exit, p in (0.5,1] still computes
          // blur(0px) — the filter must be none through that stretch
          p.classList.toggle('jx-rest', isResting(pv));
        }
        exitFrame = raf(sample);
      };
      exitFrame = raf(sample);
    } else {
      // ENTRY: create on the NEXT frame, when display has flipped
      entryFrame = raf(() => {
        if (token !== runToken) return;
        if (!isVisibleState(p)) return;
        progressAnim = p.animate(
          [{ '--jx-p': from }, { '--jx-p': to }],
          { duration: DURATION_MS, easing: 'linear', fill: 'both' },
        );
      });
    }
  }

  /** "logically open" — popover OR dialog flavors of the kernel */
  function isVisibleState(p: HTMLElement): boolean {
    return p.matches(':popover-open, [open]');
  }

  function startTracking(): void {
    stopTracking();
    const step = (): void => {
      const p = panel();
      if (!p || !isVisibleState(p)) return;
      const pv = Number(getComputedStyle(p).getPropertyValue('--jx-p'));
      if (Number.isFinite(pv)) lastP = pv;
      // r30 hard rule: filter:none whenever the blur would compute
      // to blur(0px) — p>=0.5, not just the settled rest
      p.classList.toggle('jx-rest', isResting(lastP));
      const a = opts.anchor?.();
      if (a) {
        const pr = p.getBoundingClientRect();
        const ar = a.getBoundingClientRect();
        const dx = pr.left + pr.width / 2 - (ar.left + ar.width / 2);
        const dy = pr.top + pr.height / 2 - (ar.top + ar.height / 2);
        const len = Math.hypot(dx, dy);
        if (len > 1) {
          p.style.setProperty('--jx-dx', String(dx / len));
          p.style.setProperty('--jx-dy', String(dy / len));
        } else {
          // degenerate axis (centers coincide) → the project default
          p.style.setProperty('--jx-dx', '0.70710678');
          p.style.setProperty('--jx-dy', '0.70710678');
        }
      }
      trackFrame = raf(step);
    };
    trackFrame = raf(step);
  }

  function stopTracking(): void {
    caf(trackFrame);
  }

  function destroy(): void {
    runToken += 1;
    stopTracking();
    caf(entryFrame);
    caf(exitFrame);
    progressAnim?.cancel();
  }

  return { play, startTracking, stopTracking, destroy, supported };
}
