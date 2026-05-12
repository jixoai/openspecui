<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    eyebrow?: string
    title: string
    summary?: string
    children: Snippet
    class?: string
    contentClass?: string
    headingLevel?: 1 | 2
    tone?: 'default' | 'hero'
  }

  let {
    eyebrow,
    title,
    summary,
    children,
    class: className = '',
    contentClass = '',
    headingLevel = 2,
    tone = 'default',
  }: Props = $props()

  const titleClassName = $derived(
    tone === 'hero'
      ? 'font-nav max-w-[24ch] text-balance text-[clamp(1.58rem,2.55vw,2.7rem)] tracking-tight leading-[0.96] sm:max-w-[22ch] lg:max-w-[24ch]'
      : 'font-nav text-balance text-[1.05rem] tracking-tight leading-tight sm:text-[1.22rem]'
  )

  const summaryClassName = $derived(
    tone === 'hero'
      ? 'max-w-[62ch] text-pretty text-[13px] leading-6 text-foreground/78 sm:text-[14px] sm:leading-6'
      : 'max-w-[64ch] text-pretty text-[13px] leading-5 text-muted-foreground sm:text-[14px] sm:leading-6'
  )
</script>

<section class={`border-border bg-card border shadow-sm ${className}`}>
  <div class="border-border flex flex-col gap-3 border-b px-4 py-3 sm:px-5 sm:py-4">
    {#if eyebrow}
      <p class="font-nav text-primary text-[11px] uppercase tracking-[0.24em]">{eyebrow}</p>
    {/if}
    <div class="flex flex-col gap-2.5">
      {#if headingLevel === 1}
        <h1 class={titleClassName}>{title}</h1>
      {:else}
        <h2 class={titleClassName}>{title}</h2>
      {/if}
      {#if summary}
        <p class={summaryClassName}>{summary}</p>
      {/if}
    </div>
  </div>
  <div class={`px-4 py-4 sm:px-5 sm:py-5 ${contentClass}`.trim()}>
    {@render children()}
  </div>
</section>
