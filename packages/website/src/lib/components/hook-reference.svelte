<!--
Orthogonal intents (updated 2026-09-06 Asia/Shanghai):
1. Render one hook's contract card: header, signature, when-to-use, stable-for list.
2. Scroll affordance for the example code block: the mobile audit (2026-09-06)
   confirmed the Shiki container IS scrollable but gives zero rest-state hint —
   long lines hard-clip at the right border. The veil recipe below is the
   registry code-card's (V1-8/V2-8) subtraction-ink dialect: a non-scrolling
   wrapper hosts start/end edge veils (backdrop contrast pulls the backdrop
   toward mid tone — never adds black; the mask ramp shapes the range) that
   appear only while that direction can still scroll. The flags are
   template-bound classes, NOT runtime attributes — svelte prunes attribute
   selectors that never appear in compiled markup (verified live 2026-09-06).

Original request (2026-09-06): 移动端审计 P1 — hooks 页代码块长行右缘截断、无滚动提示。
-->
<script lang="ts">
  import type { HookDoc } from '$lib/i18n/schema'

  interface Props {
    hook: HookDoc
  }

  let { hook }: Props = $props()

  // Veil flags: recompute from scroll events + geometry changes (the
  // ResizeObserver also catches font load / container resizes). jsdom has no
  // ResizeObserver — the guard keeps the vitest render path alive.
  let scrollerEl = $state<HTMLElement | undefined>()
  let veilStart = $state(false)
  let veilEnd = $state(false)

  $effect(() => {
    const scroller = scrollerEl
    if (!scroller) return
    const sync = () => {
      veilStart = scroller.scrollLeft > 1
      veilEnd = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1
    }
    sync()
    scroller.addEventListener('scroll', sync, { passive: true })
    const ro = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(sync)
    ro?.observe(scroller)
    const codeBox = scroller.querySelector('code')
    if (codeBox) ro?.observe(codeBox)
    return () => {
      scroller.removeEventListener('scroll', sync)
      ro?.disconnect()
    }
  })
</script>

<article class="border-border bg-card min-w-0 border shadow-sm">
  <div class="border-border border-b px-4 py-3 sm:px-5 sm:py-4">
    <p class="font-nav text-primary text-[11px] uppercase tracking-[0.24em]">Hook</p>
    <h2 class="font-nav mt-2 text-balance text-[1.25rem] leading-tight tracking-tight">
      {hook.name}
    </h2>
    <p class="text-muted-foreground mt-2 text-pretty text-[13px] leading-5 sm:text-[14px] sm:leading-6">
      {hook.purpose}
    </p>
  </div>

  <div class="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
    <div class="space-y-2">
      <h3 class="font-nav text-[14px] tracking-tight">Signature</h3>
      <code
        class="bg-terminal text-terminal-foreground block overflow-x-auto px-3 py-2 text-[12px] leading-5"
      >
        {hook.signature}
      </code>
    </div>

    <div class="space-y-2">
      <h3 class="font-nav text-[14px] tracking-tight">When to use</h3>
      <p class="text-muted-foreground text-pretty text-[13px] leading-5 sm:text-[14px] sm:leading-6">
        {hook.when}
      </p>
    </div>

    <div class="space-y-2">
      <h3 class="font-nav text-[14px] tracking-tight">Stable for</h3>
      <ul class="grid gap-2">
        {#each hook.stableFor as item (item)}
          <li
            class="border-border text-muted-foreground border px-3 py-2 text-[13px] leading-5 sm:text-[14px]"
          >
            {item}
          </li>
        {/each}
      </ul>
    </div>

    {#if hook.exampleHtml}
      <div class="code-veil-host relative" class:veil-start={veilStart} class:veil-end={veilEnd}>
        <div
          class="shiki-code border-border overflow-x-auto border text-[12px] leading-5"
          bind:this={scrollerEl}
        >
          <!-- Shiki HTML is generated at build time from repository-owned hook examples. -->
          {@html hook.exampleHtml}
        </div>
      </div>
    {:else}
      <div class="code-veil-host relative" class:veil-start={veilStart} class:veil-end={veilEnd}>
        <pre
          class="bg-terminal text-terminal-foreground overflow-x-auto px-3 py-3 text-[12px] leading-5"
          bind:this={scrollerEl}
        ><code>{hook.example}</code></pre>
      </div>
    {/if}
  </div>
</article>

<style>
  /* Subtraction-ink edge veils (the registry code-card recipe, 2026-09-02):
   * backdrop contrast(0.5) pulls whatever paints behind the strip toward mid
   * tone — light themes darken, dark themes lighten, zero color tokens — and
   * the mask ramp fades the effect toward the content. The veils sit on the
   * non-scrolling wrapper so they stay pinned while the inner scroller moves. */
  .code-veil-host::before,
  .code-veil-host::after {
    content: '';
    position: absolute;
    inset-block: 0;
    inline-size: 1.75rem;
    pointer-events: none;
    opacity: 0;
    transition: opacity 150ms ease-out;
    backdrop-filter: contrast(0.5);
    -webkit-backdrop-filter: contrast(0.5);
  }
  .code-veil-host::before {
    inset-inline-start: 0;
    mask-image: linear-gradient(to right, rgb(0 0 0), transparent);
    -webkit-mask-image: linear-gradient(to right, rgb(0 0 0), transparent);
  }
  .code-veil-host::after {
    inset-inline-end: 0;
    mask-image: linear-gradient(to left, rgb(0 0 0), transparent);
    -webkit-mask-image: linear-gradient(to left, rgb(0 0 0), transparent);
  }
  .code-veil-host.veil-start::before,
  .code-veil-host.veil-end::after {
    opacity: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .code-veil-host::before,
    .code-veil-host::after {
      transition: none;
    }
  }
</style>
