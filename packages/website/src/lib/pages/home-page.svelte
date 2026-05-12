<script lang="ts">
  import ArrowUpRight from 'lucide-svelte/icons/arrow-up-right'
  import BookOpenText from 'lucide-svelte/icons/book-open-text'
  import FileOutput from 'lucide-svelte/icons/file-output'
  import Github from 'lucide-svelte/icons/github'
  import PanelsTopLeft from 'lucide-svelte/icons/panels-top-left'
  import TerminalSquare from 'lucide-svelte/icons/terminal-square'
  import { onMount } from 'svelte'
  import { APP_URL, GITHUB_URL, OPENSPEC_URL, RUNNER_STORAGE_KEY } from '$lib/constants'
  import ExternalLink from '$lib/components/external-link.svelte'
  import SectionCard from '$lib/components/section-card.svelte'
  import type { RunnerId, WebsiteContent, WebsiteLanguage } from '$lib/i18n/schema'
  import { getRunnerCommandPrefix, isRunnerId } from '$lib/runner'

  interface Props {
    content: WebsiteContent
    lang: WebsiteLanguage
  }

  let { content, lang }: Props = $props()
  let runner: RunnerId = $state('npm')
  let appModeEnabled = $state(true)

  const runnerCommandPrefix = $derived(getRunnerCommandPrefix(runner))
  const hostedAppCommand = $derived(`${runnerCommandPrefix} openspecui@latest --app`)
  const runCommand = $derived(
    `${runnerCommandPrefix} openspecui@latest${appModeEnabled ? ' --app' : ''}`
  )
  const currentRunSummary = $derived(
    appModeEnabled ? content.commands.appOnSummary : content.commands.appOffSummary
  )
  const hooksPath = $derived(`/${lang}/hooks/`)

  onMount(() => {
    const stored = window.localStorage.getItem(RUNNER_STORAGE_KEY)
    if (isRunnerId(stored)) {
      runner = stored
    }
  })

  $effect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RUNNER_STORAGE_KEY, runner)
    }
  })
</script>

<main
  class="mx-auto flex max-w-[90rem] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10"
>
  <section
    class="grid items-start gap-5 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
  >
    <SectionCard
      title={content.hero.title}
      summary={content.hero.summary}
      tone="hero"
      headingLevel={1}
      class="relative overflow-hidden"
      contentClass="sm:pb-6 sm:pr-6"
    >
      <div
        class="pointer-events-none absolute right-0 top-0 hidden h-48 w-48 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--color-primary),transparent_76%),transparent_70%)] lg:block"
      ></div>
      <div
        class="relative grid gap-5 min-[1180px]:grid-cols-[minmax(13rem,0.74fr)_minmax(16rem,1fr)] min-[1180px]:items-start min-[1440px]:grid-cols-[minmax(17rem,0.66fr)_minmax(24rem,1.14fr)]"
      >
        <div class="max-w-[32rem] space-y-4 lg:pr-0">
          <div class="flex flex-wrap gap-2 text-xs">
            <span class="border-border bg-background inline-flex items-center border px-2.5 py-1 font-medium">
              {content.hero.badges.live}
            </span>
            <span class="bg-primary text-primary-foreground inline-flex items-center px-2.5 py-1 font-medium">
              {content.hero.badges.hosted}
            </span>
            <span class="bg-muted text-muted-foreground inline-flex items-center px-2.5 py-1 font-medium">
              {content.hero.badges.static}
            </span>
          </div>
          <div class="flex flex-wrap gap-3 text-sm">
            <a
              href={APP_URL}
              target="_blank"
              rel="noreferrer"
              class="bg-primary text-primary-foreground hover:opacity-92 inline-flex items-center gap-2 px-3 py-2 font-medium transition-[transform,background-color,color,opacity] duration-150 active:translate-y-px active:scale-[0.99]"
            >
              {content.hero.primaryCta}
              <ArrowUpRight class="h-4 w-4" />
            </a>
            <a
              href={hooksPath}
              class="border-border bg-background hover:bg-muted inline-flex items-center gap-2 border px-3 py-2 font-medium transition-[transform,background-color,color,opacity] duration-150 active:translate-y-px active:scale-[0.99]"
            >
              {content.hero.secondaryCta}
              <ArrowUpRight class="h-4 w-4" />
            </a>
          </div>
        </div>
        <aside class="border-border bg-background/70 space-y-4 border p-4.5 lg:mt-1">
          <div>
            <p class="font-nav text-primary text-[11px] uppercase tracking-[0.24em]">
              {content.hero.sidebarEyebrow}
            </p>
            <h3 class="font-nav mt-2 text-balance text-[17px] tracking-tight">
              {content.hero.sidebarTitle}
            </h3>
          </div>
          <p class="text-muted-foreground max-w-none text-pretty text-[13px] leading-5 sm:text-[14px] sm:leading-6">
            {content.hero.sidebarBody}
          </p>
          <code
            class="bg-terminal text-terminal-foreground scrollbar-thin scrollbar-track-transparent block overflow-x-auto px-3 py-2 text-sm"
          >
            {hostedAppCommand}
          </code>
          <p class="text-muted-foreground/80 text-pretty text-[11px] leading-5 sm:text-[12px]">
            {content.commands.compatibility}
          </p>
        </aside>
      </div>
    </SectionCard>

    <SectionCard title={content.modes.title} summary={content.modes.summary}>
      <div class="border-border divide-border divide-y border">
        {#each content.modes.items as item, index (item.title)}
          <article class="grid gap-3 p-4 sm:grid-cols-[3rem_minmax(0,1fr)]">
            <div class="font-nav text-primary/85 text-[11px] uppercase tracking-[0.24em]">
              {`0${index + 1}`}
            </div>
            <div class="space-y-1.5">
              <h3 class="font-nav text-[16px] tracking-tight">{item.title}</h3>
              <p class="text-muted-foreground text-pretty text-[13px] leading-5 sm:text-[14px] sm:leading-6">
                {item.body}
              </p>
            </div>
          </article>
        {/each}
      </div>
    </SectionCard>
  </section>

  <section class="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
    <SectionCard title={content.commands.title} summary={content.commands.summary}>
      <div class="space-y-4">
        <div class="grid gap-3 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <div class="border-border flex items-center justify-between gap-3 border px-3 py-3">
            <label
              for="website-runner-select"
              class="text-muted-foreground/80 text-[11px] leading-5 sm:text-[12px]"
            >
              {content.commands.runnerLabel}
            </label>
            <select
              id="website-runner-select"
              bind:value={runner}
              class="border-border bg-background min-w-28 border px-2 py-1 text-sm"
            >
              <option value="npm">npm / npx</option>
              <option value="pnpm">pnpm / pnpx</option>
              <option value="bun">bun / bunx</option>
            </select>
          </div>
          <button
            type="button"
            aria-pressed={appModeEnabled}
            aria-label={content.commands.appToggleLabel}
            onclick={() => {
              appModeEnabled = !appModeEnabled
            }}
            class="border-border hover:bg-muted/30 border px-3 py-3 text-left transition-[transform,background-color,color,opacity] duration-150 active:translate-y-px active:scale-[0.99]"
          >
            <div class="min-w-0 space-y-2">
              <div class="flex items-start justify-between gap-2">
                <p class="font-nav min-w-0 text-[16px] tracking-tight">
                  {content.commands.appToggleLabel}
                </p>
                <span
                  class={[
                    'inline-flex shrink-0 items-center px-2 py-1 text-[11px] font-medium uppercase tracking-[0.18em]',
                    appModeEnabled
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  {appModeEnabled
                    ? content.commands.appToggleEnabled
                    : content.commands.appToggleDisabled}
                </span>
              </div>
              <p class="text-muted-foreground text-pretty text-[13px] leading-5 sm:text-[14px] sm:leading-6">
                {content.commands.appToggleSummary}
              </p>
            </div>
          </button>
        </div>
        <div class="border-border divide-border divide-y border">
          <div class="grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
            <div class="bg-muted flex h-10 w-10 items-center justify-center">
              {#if appModeEnabled}
                <PanelsTopLeft class="text-primary h-4 w-4" />
              {:else}
                <TerminalSquare class="text-primary h-4 w-4" />
              {/if}
            </div>
            <div class="min-w-0 space-y-2.5">
              <div class="space-y-1.5">
                <h3 class="font-nav text-[16px] tracking-tight">{content.commands.runLabel}</h3>
                <p class="text-muted-foreground text-[13px] leading-5 sm:min-h-[3rem] sm:text-[14px] sm:leading-6">
                  {currentRunSummary}
                </p>
              </div>
              <code
                class="bg-terminal text-terminal-foreground scrollbar-thin scrollbar-track-transparent block overflow-x-auto px-3 py-2 text-sm"
              >
                {runCommand}
              </code>
            </div>
          </div>
          <div class="grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
            <div class="bg-muted flex h-10 w-10 items-center justify-center">
              <FileOutput class="text-primary h-4 w-4" />
            </div>
            <div class="min-w-0 space-y-2.5">
              <div class="space-y-1.5">
                <h3 class="font-nav text-[16px] tracking-tight">
                  {content.commands.exportLabel}
                </h3>
                <p class="text-muted-foreground text-pretty text-[13px] leading-5 sm:text-[14px] sm:leading-6">
                  {content.commands.exportSummary}
                </p>
              </div>
              <code
                class="bg-terminal text-terminal-foreground scrollbar-thin scrollbar-track-transparent block overflow-x-auto px-3 py-2 text-sm"
              >
                {`${runnerCommandPrefix} openspecui@latest export -o ./dist`}
              </code>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>

    <SectionCard title={content.links.title} summary={content.links.summary}>
      <div class="border-border divide-border divide-y border">
        <ExternalLink
          href={APP_URL}
          title={content.links.appTitle}
          body={content.links.appBody}
          icon={PanelsTopLeft}
        />
        <ExternalLink
          href={OPENSPEC_URL}
          title={content.links.openspecTitle}
          body={content.links.openspecBody}
          icon={BookOpenText}
        />
        <ExternalLink
          href={GITHUB_URL}
          title={content.links.githubTitle}
          body={content.links.githubBody}
          icon={Github}
        />
      </div>
    </SectionCard>
  </section>
</main>
