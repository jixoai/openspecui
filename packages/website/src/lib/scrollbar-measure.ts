/**
 * jixoai scrollbar width probe (registry/files/lib/scrollbar-measure.ts).
 *
 * 2026-08-22 · Scrollbar law (Owner request): scrollbar-width: thin plus
 * scrollbar-gutter: stable both-edges need the REAL per-OS scrollbar
 * width as a CSS variable, because padding-inline on every scrollport
 * subtracts it (the gutter reserves space between the inner border edge
 * and the outer padding edge). Measured references: macOS classic thin
 * = 11px, auto = 14px — other OS/version combinations differ, so the
 * value is probed at runtime, never hardcoded.
 *
 * Why a custom element: shadow DOM is the only zero-leak measurement
 * chamber — page CSS (including the theme's own `*` scrollbar rules)
 * cannot select INTO the shadow tree; only inherited properties cross
 * the boundary, and each probe re-declares the ones it depends on
 * (scrollbar-width, scrollbar-color). The element renders offscreen,
 * measures offsetWidth - clientWidth of overflow:scroll probes under
 * `scrollbar-width: thin` and `auto`, publishes
 * --jx-scrollbar-thin / --jx-scrollbar-auto (px) on :root, then
 * removes itself. Overlay-scrollbar systems measure 0px — exactly what
 * the compensation recipes need (no gutter is ever reserved there).
 *
 * Widths are published ONLY when the engine supports BOTH standard
 * scrollbar styling and scrollbar-gutter. Without gutter support a
 * classic scrollbar still takes space with nothing to compensate
 * against, so authored paddings must stay untouched (Safari today:
 * native scrollbars, zero compensation).
 *
 * Usage — import for its side effect once in the root layout (the
 * registration guard keeps module evaluation safe under SSR/prerender,
 * same law as the form-field bridge):
 *
 *   import '@lib/scrollbar-measure';
 */
if (typeof document !== 'undefined' && !customElements.get('jx-scrollbar-measure')) {
  class JxScrollbarMeasure extends HTMLElement {
    connectedCallback(): void {
      const root = this.attachShadow({ mode: 'open' });
      // :host is 0x0 and invisible — the probes overflow it without
      // ever painting; visibility: hidden keeps layout measurable.
      root.innerHTML = `
        <style>
          :host {
            height: 0;
            left: 0;
            pointer-events: none;
            position: fixed;
            top: 0;
            visibility: hidden;
            width: 0;
          }
          .probe {
            height: 100px;
            overflow: scroll;
            width: 100px;
          }
          .probe.thin {
            scrollbar-width: thin;
          }
          .probe.auto {
            scrollbar-width: auto;
          }
        </style>
        <div class="probe thin"></div>
        <div class="probe auto"></div>`;
      const width = (selector: string): number => {
        const el = root.querySelector<HTMLDivElement>(selector);
        return el === null ? 0 : Math.round((el.offsetWidth - el.clientWidth) * 100) / 100;
      };
      const supports =
        typeof CSS !== 'undefined' &&
        CSS.supports('scrollbar-width: thin') &&
        CSS.supports('scrollbar-gutter: stable both-edges');
      if (supports) {
        const style = document.documentElement.style;
        style.setProperty('--jx-scrollbar-thin', `${width('.probe.thin')}px`);
        style.setProperty('--jx-scrollbar-auto', `${width('.probe.auto')}px`);
      }
      this.remove();
    }
  }
  customElements.define('jx-scrollbar-measure', JxScrollbarMeasure);
  (document.body ?? document.documentElement).append(document.createElement('jx-scrollbar-measure'));
}
