<!--
Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
1. Render the light/dark/system theme toggle persisted through the shared website theme storage.

Original request (2026-08-19): "因为顶部栏这里背景始终都是暗色的，所以Theme 和 Language 这里的 toggle 要固定 border 的颜色为亮色。"
Original request (2026-08-19): "Theme 和 Language 这两个文字我建议也改成图标" — a SunMoon icon replaces the visible label; the textual name stays on the group aria-label.
-->
<script lang="ts">
  import { onMount } from 'svelte'
  import type { WebsiteContent } from '$lib/i18n/schema'
  import SunMoon from 'lucide-svelte/icons/sun-moon'
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
  <SunMoon class="text-terminal-foreground/72 h-3.5 w-3.5" aria-hidden="true" />
  <div
    class="border-terminal-foreground/30 bg-terminal-muted inline-flex w-fit max-w-full items-center self-start overflow-hidden border shadow-none"
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
