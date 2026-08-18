<!--
Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
1. Render the Broadside hero: large lead type, badges, copy-command and GitHub CTAs.
2. Place the terminal typing card in the second column when the hero has room, below the copy otherwise.

Original request (2026-08-19): "特别是在桌面模式下，首屏右侧有空间的话，那么我觉得可以吧这个终端打字放在首屏右侧，如果空间不够再放在下面一栏。"
-->
<script lang="ts">
  import { reveal } from '$lib/actions/reveal'
  import { GITHUB_URL } from '$lib/constants'
  import type { WebsiteContent } from '$lib/i18n/schema'
  import TerminalCard from './terminal-card.svelte'

  interface Props {
    content: WebsiteContent
  }

  let { content }: Props = $props()

  let copied = $state(false)
  let copyTimer: ReturnType<typeof setTimeout> | undefined

  async function copyQuickStart() {
    const text = content.terminal.command
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const area = document.createElement('textarea')
      area.value = text
      document.body.appendChild(area)
      area.select()
      try {
        document.execCommand('copy')
      } catch {
        /* clipboard unavailable without permissions */
      }
      area.remove()
    }
    copied = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copied = false
    }, 1400)
  }
</script>

<section class="mx-auto w-full max-w-[90rem] px-4 pb-10 pt-10 sm:px-6 sm:pt-14 lg:px-8">
  <div
    class="grid gap-10 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(25rem,31rem)] min-[1100px]:items-end min-[1100px]:gap-14"
  >
    <div class="min-w-0">
      <p class="font-nav text-primary text-[11px] uppercase tracking-[0.24em]" use:reveal>
        {content.hero.eyebrow}
      </p>
      <h1
        class="mt-4 text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.99] font-bold tracking-[-0.035em] text-balance"
        use:reveal={{ delay: 60, rise: 14 }}
      >
        {content.hero.titleLead}<em class="text-primary not-italic">{content.hero.titleAccent}</em>
      </h1>
      <p
        class="text-muted-foreground mt-5 max-w-[62ch] text-pretty text-[15px] leading-6 sm:text-base sm:leading-7"
        use:reveal={{ delay: 120 }}
      >
        {content.hero.summary}
      </p>
      <div
        class="text-muted-foreground font-nav mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs uppercase tracking-[0.14em]"
        use:reveal={{ delay: 160 }}
      >
        {#each content.hero.badges as badge (badge)}
          <span>{badge}</span>
        {/each}
      </div>
      <div class="mt-8 flex flex-wrap gap-3" use:reveal={{ delay: 200 }}>
        <button
          type="button"
          onclick={copyQuickStart}
          class={[
            'border-border inline-flex items-center gap-2.5 border px-3.5 py-2.5 text-sm font-medium transition-[transform,box-shadow] duration-150',
            copied
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-primary text-primary-foreground',
            'shadow-xs hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-md active:translate-x-px active:translate-y-px active:shadow-none',
          ].join(' ')}
        >
          <span>{copied ? content.hero.copiedCta : content.hero.copyCta}</span>
          <span>{content.terminal.command}</span>
        </button>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          class="border-border bg-background hover:bg-muted inline-flex items-center border px-3.5 py-2.5 text-sm font-medium transition-[transform,box-shadow,background-color] duration-150 shadow-xs hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-md active:translate-x-px active:translate-y-px active:shadow-none"
        >
          {content.hero.githubCta}
        </a>
      </div>
    </div>
    <div class="min-w-0" use:reveal={{ delay: 260, rise: 12 }}>
      <TerminalCard
        barTitle={content.terminal.barTitle}
        command={content.terminal.command}
        outputs={content.terminal.outputs}
      />
    </div>
  </div>
</section>
