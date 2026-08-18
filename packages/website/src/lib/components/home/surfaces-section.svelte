<!--
Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
1. Render the three usage surfaces as outlined-numeral cards with their production commands.

Original request (2026-08-19): "只提供现有最新版本的信息" — surfaces describe the v9 CLI surface only.
-->
<script lang="ts">
  import { reveal } from '$lib/actions/reveal'
  import type { WebsiteContent } from '$lib/i18n/schema'

  interface Props {
    content: WebsiteContent
  }

  let { content }: Props = $props()
</script>

<section id="surfaces" class="mx-auto w-full max-w-[90rem] px-4 pb-16 sm:px-6 lg:px-8">
  <h2 class="font-nav flex items-baseline gap-4 text-lg uppercase tracking-[0.3em]" use:reveal>
    {content.surfaces.title}
    <span class="bg-border h-px flex-1" aria-hidden="true"></span>
  </h2>
  <div class="mt-9 grid border border-border sm:grid-cols-1 min-[940px]:grid-cols-3">
    {#each content.surfaces.items as item, index (item.title)}
      <article
        class="flex flex-col gap-2.5 border-t border-border p-6 min-[940px]:border-t-0 min-[940px]:border-l min-[940px]:first:border-l-0"
        use:reveal={{ delay: index * 70, rise: 12 }}
      >
        <div class="surface-numeral font-nav" aria-hidden="true">{`0${index + 1}`}</div>
        <h3 class="font-nav text-[19px]">{item.title}</h3>
        <p class="text-muted-foreground mb-2 text-pretty text-[13.5px] leading-6">{item.body}</p>
        <code
          class="bg-terminal text-terminal-foreground mt-auto block overflow-x-auto px-3 py-2 text-sm whitespace-nowrap"
        >
          $ {item.command}
        </code>
      </article>
    {/each}
  </div>
</section>

<style>
  .surface-numeral {
    font-size: clamp(2.6rem, 4.5vw, 3.6rem);
    line-height: 1;
    color: transparent;
    -webkit-text-stroke: 1.5px var(--color-primary);
  }

  @supports not (-webkit-text-stroke: 1px black) {
    .surface-numeral {
      color: color-mix(in oklab, var(--color-primary) 55%, transparent);
    }
  }
</style>
