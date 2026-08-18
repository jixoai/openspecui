<!--
Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
1. Render the inverted run-it band: runner select, App/Web flag toggle, serve/export/auth commands.
2. Keep the runner preference persisted and every emitted command production-accurate.

Original request (2026-08-19): "只提供现有最新版本的信息" — commands mirror the published v9 CLI surface.
-->
<script lang="ts">
  import { reveal } from '$lib/actions/reveal'
  import { RUNNER_STORAGE_KEY } from '$lib/constants'
  import type { RunnerId, WebsiteContent } from '$lib/i18n/schema'
  import { getRunnerCommandPrefix, isRunnerId } from '$lib/runner'
  import { onMount } from 'svelte'

  interface Props {
    content: WebsiteContent
  }

  let { content }: Props = $props()

  let runner: RunnerId = $state('npm')
  let appMode = $state(true)

  const runnerCommandPrefix = $derived(getRunnerCommandPrefix(runner))
  const serveCommand = $derived(
    `${runnerCommandPrefix} openspecui@latest ${appMode ? content.run.appFlagLabel : content.run.webFlagLabel}`
  )
  const exportCommand = $derived(`${runnerCommandPrefix} openspecui@latest export -o ./dist`)
  const authCommand = 'openspecui --auth'

  onMount(() => {
    const stored = window.localStorage.getItem(RUNNER_STORAGE_KEY)
    if (isRunnerId(stored)) {
      runner = stored
    }
  })

  $effect(() => {
    window.localStorage.setItem(RUNNER_STORAGE_KEY, runner)
  })
</script>

<section id="run" class="bg-foreground text-background">
  <div
    class="mx-auto grid w-full max-w-[90rem] gap-9 px-4 py-12 sm:px-6 min-[940px]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] min-[940px]:items-start min-[940px]:gap-14 lg:px-8"
  >
    <div use:reveal>
      <h2 class="font-nav text-lg uppercase tracking-[0.3em]">{content.run.title}</h2>
      <p class="mt-4 max-w-[46ch] text-sm leading-6 opacity-70">{content.run.summary}</p>
      <label
        for="website-runner-select"
        class="font-nav mt-7 block text-[11px] tracking-[0.2em] opacity-60"
      >
        {content.run.runnerLabel}
      </label>
      <select
        id="website-runner-select"
        bind:value={runner}
        class="border-background/40 bg-foreground mt-2 border px-2.5 py-1.5 text-sm"
      >
        <option value="npm">npm / npx</option>
        <option value="pnpm">pnpm / pnpx</option>
        <option value="bun">bun / bunx</option>
      </select>
      <p class="font-nav mt-7 text-[11px] tracking-[0.2em] opacity-60">{content.run.appModeLabel}</p>
      <button
        type="button"
        aria-pressed={appMode}
        aria-label={`${content.run.appModeLabel} ${appMode ? content.run.appFlagLabel : content.run.webFlagLabel}`}
        onclick={() => {
          appMode = !appMode
        }}
        class="border-background/40 mt-2 border px-3 py-1.5 font-nav text-sm transition-colors"
        class:bg-primary={appMode}
        class:text-primary-foreground={appMode}
        data-app-toggle
      >
        {appMode ? content.run.appFlagLabel : content.run.webFlagLabel}
        <span class="ml-2 border-current border px-1.5 py-0.5 text-[10px] tracking-[0.16em]">
          {appMode ? content.run.appStateLabel : content.run.webStateLabel}
        </span>
      </button>
      <p class="mt-4 text-[13px] leading-5 opacity-70">
        {content.run.appModeSummary}
      </p>
      {#if appMode}
        <p class="mt-3 text-[13px] leading-5 opacity-70">{content.run.serveAppSummary}</p>
      {:else}
        <p class="mt-3 text-[13px] leading-5 opacity-70">{content.run.serveWebSummary}</p>
      {/if}
    </div>
    <div class="flex flex-col gap-5" use:reveal={{ delay: 90 }}>
      <div>
        <p class="font-nav mb-2 text-[11px] tracking-[0.2em] opacity-60">
          <span class="text-primary">{'>_'}</span>
          {content.run.serveCaption}
        </p>
        <code
          class="bg-terminal text-terminal-foreground block overflow-x-auto px-3 py-2.5 text-sm whitespace-nowrap shadow-[6px_6px_0_0_color-mix(in_oklab,var(--background)_26%,transparent)]"
          data-run-command
        >
          {serveCommand}
        </code>
      </div>
      <div>
        <p class="font-nav mb-2 text-[11px] tracking-[0.2em] opacity-60">
          {content.run.exportCaption}
        </p>
        <code
          class="bg-terminal text-terminal-foreground block overflow-x-auto px-3 py-2.5 text-sm whitespace-nowrap shadow-[6px_6px_0_0_color-mix(in_oklab,var(--background)_26%,transparent)]"
        >
          {exportCommand}
        </code>
        <p class="mt-2 text-[12px] leading-5 opacity-60">{content.run.exportSummary}</p>
      </div>
      <div>
        <p class="font-nav mb-2 text-[11px] tracking-[0.2em] opacity-60">
          {content.run.protectCaption}
        </p>
        <code
          class="bg-terminal text-terminal-foreground block overflow-x-auto px-3 py-2.5 text-sm whitespace-nowrap shadow-[6px_6px_0_0_color-mix(in_oklab,var(--background)_26%,transparent)]"
        >
          $ {authCommand}
        </code>
        <p class="mt-2 text-[12px] leading-5 opacity-60">{content.run.protectSummary}</p>
      </div>
      <p class="mt-2 text-[12px] leading-5 opacity-55">{content.run.compat}</p>
    </div>
  </div>
</section>
