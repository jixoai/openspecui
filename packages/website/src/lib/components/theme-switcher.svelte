<script lang="ts">
  import { onMount } from 'svelte'
  import type { WebsiteContent } from '$lib/i18n/schema'
  import {
    applyWebsiteTheme,
    getWebsiteStoredTheme,
    persistWebsiteTheme,
    type WebsiteTheme,
  } from '$lib/theme/theme-bootstrap'

  interface Props {
    content: WebsiteContent
  }

  const options: readonly WebsiteTheme[] = ['light', 'dark', 'system']

  let { content }: Props = $props()
  let theme: WebsiteTheme = $state('system')

  function setTheme(nextTheme: WebsiteTheme): void {
    theme = nextTheme
    persistWebsiteTheme(nextTheme)
    applyWebsiteTheme(nextTheme)
  }

  onMount(() => {
    theme = getWebsiteStoredTheme()
    applyWebsiteTheme(theme)
  })
</script>

<div class="flex items-center gap-2">
  <span class="text-terminal-foreground/72 text-xs">{content.meta.themeLabel}</span>
  <div
    class="border-terminal-border bg-terminal-muted inline-flex w-fit max-w-full items-center self-start overflow-hidden border shadow-none"
    role="group"
    aria-label={content.meta.themeLabel}
  >
    {#each options as option (option)}
      <button
        type="button"
        aria-pressed={theme === option}
        class={[
          'px-2.5 py-1 text-xs font-medium capitalize transition-colors',
          theme === option
            ? 'bg-primary text-primary-foreground'
            : 'text-terminal-foreground/72 hover:bg-terminal-hover hover:text-terminal-foreground',
        ].join(' ')}
        onclick={() => setTheme(option)}
      >
        {option}
      </button>
    {/each}
  </div>
</div>
