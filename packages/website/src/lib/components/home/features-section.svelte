<!--
Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
1. Render the eight-entry WHAT'S INSIDE index as full-width numbered rows with rule-draw reveals.
2. Own the sticky index rail scroll-spy highlight (desktop only; no observer means no spy, no crash).

Original request (2026-08-19): "可以用是Scroll-Animation 来实现相关的 features 展示，但是注意动效要克制"
-->
<script lang="ts">
  import { reveal } from '$lib/actions/reveal'
  import type { WebsiteContent } from '$lib/i18n/schema'

  interface Props {
    content: WebsiteContent
  }

  let { content }: Props = $props()

  let featureRows = $state<(HTMLElement | undefined)[]>([])
  let railLinks = $state<(HTMLAnchorElement | undefined)[]>([])

  $effect(() => {
    const rows = featureRows.filter((row): row is HTMLElement => Boolean(row))
    const links = railLinks.filter((link): link is HTMLAnchorElement => Boolean(link))
    if (typeof IntersectionObserver === 'undefined' || rows.length === 0 || links.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const id = entry.target.getAttribute('data-feature-id')
          for (const link of links) {
            link.classList.toggle('is-active', link.getAttribute('data-feature-id') === id)
          }
        }
      },
      { rootMargin: '-10% 0px -55% 0px' }
    )
    for (const row of rows) observer.observe(row)
    return () => observer.disconnect()
  })
</script>

<section id="features" class="mx-auto w-full max-w-[90rem] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
  <h2 class="font-nav flex items-baseline gap-4 text-lg uppercase tracking-[0.3em]" use:reveal>
    {content.features.title}
    <span class="bg-border h-px flex-1" aria-hidden="true"></span>
  </h2>
  <div class="mt-9 grid gap-10 min-[1000px]:grid-cols-[11rem_minmax(0,1fr)] min-[1000px]:gap-12">
    <nav
      class="text-muted-foreground hidden min-[1000px]:sticky min-[1000px]:top-24 min-[1000px]:flex min-[1000px]:flex-col min-[1000px]:gap-2 font-nav text-xs tracking-[0.1em]"
      aria-label={content.features.indexLabel}
    >
      <p class="mb-2 text-[10.5px] uppercase tracking-[0.26em]">{content.features.indexLabel}</p>
      {#each content.features.items as item, index (item.id)}
        <a
          href="#{item.id}"
          data-feature-id={item.id}
          bind:this={railLinks[index]}
          class="hover:text-foreground feature-rail-link flex gap-2.5 transition-colors"
        >
          <span class="text-[10px] opacity-70">{`0${index + 1}`}</span>
          <span>{item.title}</span>
        </a>
      {/each}
    </nav>
    <div class="min-w-0">
      {#each content.features.items as item, index (item.id)}
        <article
          id={item.id}
          data-feature-id={item.id}
          bind:this={featureRows[index]}
          class="grid gap-2.5 border-t border-border py-6 min-[760px]:grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1.15fr)] min-[760px]:items-baseline min-[760px]:gap-10 sm:py-7"
        >
          <div class="bg-border h-px w-full min-[760px]:col-span-full" use:reveal={{ rule: true }}></div>
          <div
            class="font-nav text-primary text-[clamp(1.3rem,2.2vw,1.8rem)] leading-none"
            use:reveal={{ delay: 40, rise: 12 }}
          >
            {`0${index + 1}`}
          </div>
          <h3
            class="text-[clamp(1.2rem,2vw,1.55rem)] font-bold tracking-[-0.015em]"
            use:reveal={{ delay: 70, rise: 12 }}
          >
            {item.title}
          </h3>
          <p
            class="text-muted-foreground max-w-[62ch] text-pretty text-sm leading-6"
            use:reveal={{ delay: 100, rise: 12 }}
          >
            {item.body}
          </p>
        </article>
      {/each}
    </div>
  </div>
</section>

<style>
  /* The scroll-spy observer toggles `is-active` at runtime, outside scoped-CSS visibility. */
  .feature-rail-link:global(.is-active) {
    color: var(--color-primary);
  }

  .feature-rail-link:global(.is-active)::before {
    content: '—';
    margin-right: 0.35rem;
  }
</style>
