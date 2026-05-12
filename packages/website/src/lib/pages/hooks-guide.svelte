<script lang="ts">
  import type { Snippet } from 'svelte'
  import SectionCard from '$lib/components/section-card.svelte'
  import type { WebsiteContent, WebsiteLanguage } from '$lib/i18n/schema'

  interface Props {
    content: WebsiteContent
    lang: WebsiteLanguage
    children: Snippet
  }

  let { content, lang, children }: Props = $props()
  const installPath = $derived(`/${lang}/`)
</script>

<main class="mx-auto flex max-w-[90rem] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
  <section class="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
    <SectionCard
      title={content.hooks.heroTitle}
      summary={content.hooks.heroSummary}
      tone="hero"
      headingLevel={1}
    >
      <div class="grid gap-3 text-sm sm:grid-cols-2">
        <a
          href="#hook-reference"
          class="bg-primary text-primary-foreground inline-flex items-center justify-center px-3 py-2 font-medium transition-[transform,background-color,color,opacity] duration-150 active:translate-y-px active:scale-[0.99]"
        >
          onReadDocument / onRunWorkflow
        </a>
        <a
          href={installPath}
          class="border-border hover:bg-muted inline-flex items-center justify-center border px-3 py-2 font-medium transition-[transform,background-color,color,opacity] duration-150 active:translate-y-px active:scale-[0.99]"
        >
          OpenSpecUI
        </a>
      </div>
    </SectionCard>

    <SectionCard title={content.hooks.lifecycleTitle}>
      <ol class="grid gap-3">
        {#each content.hooks.lifecycleItems as item, index (item)}
          <li class="grid gap-3 sm:grid-cols-[3rem_minmax(0,1fr)]">
            <div class="font-nav text-primary/85 text-[11px] uppercase tracking-[0.24em]">
              {`0${index + 1}`}
            </div>
            <p class="text-muted-foreground text-pretty text-[13px] leading-5 sm:text-[14px] sm:leading-6">
              {item}
            </p>
          </li>
        {/each}
      </ol>
    </SectionCard>
  </section>

  <section class="grid gap-5 lg:grid-cols-2">
    <SectionCard title={content.hooks.designTitle}>
      <p class="text-muted-foreground text-pretty text-[13px] leading-5 sm:text-[14px] sm:leading-6">
        {content.hooks.designBody}
      </p>
    </SectionCard>
    <SectionCard title={content.hooks.contractTitle}>
      <p class="text-muted-foreground text-pretty text-[13px] leading-5 sm:text-[14px] sm:leading-6">
        {content.hooks.contractBody}
      </p>
    </SectionCard>
  </section>

  <div id="hook-reference">
    {@render children()}
  </div>
</main>
