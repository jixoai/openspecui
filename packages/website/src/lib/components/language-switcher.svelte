<!--
Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
1. Render the EN/中文 locale toggle as localized anchor links.

Original request (2026-08-19): "因为顶部栏这里背景始终都是暗色的，所以Theme 和 Language 这里的 toggle 要固定 border 的颜色为亮色。"
Original request (2026-08-19): "Theme 和 Language 这两个文字我建议也改成图标" — a Languages icon replaces the visible label; the textual name stays on the group aria-label.
-->
<script lang="ts">
  import { getAlternateLocale, localizePath } from '$lib/i18n/languages'
  import type { WebsiteContent, WebsiteLanguage } from '$lib/i18n/schema'
  import Languages from 'lucide-svelte/icons/languages'

  interface Props {
    content: WebsiteContent
    lang: WebsiteLanguage
    pathname: string
  }

  let { content, lang, pathname }: Props = $props()
  const alternate = $derived(getAlternateLocale(lang))
</script>

<div class="flex items-center gap-2">
  <Languages class="text-terminal-foreground/72 h-3.5 w-3.5" aria-hidden="true" />
  <div
    class="border-terminal-foreground/30 bg-terminal-muted inline-flex w-fit max-w-full items-center self-start overflow-hidden border shadow-none"
    role="group"
    aria-label={content.meta.languageLabel}
  >
    <a
      href={localizePath(pathname, 'en')}
      aria-current={lang === 'en' ? 'true' : undefined}
      class={[
        'px-2.5 py-1 text-xs font-medium transition-colors',
        lang === 'en'
          ? 'bg-primary text-primary-foreground'
          : 'text-terminal-foreground/72 hover:bg-terminal-hover hover:text-terminal-foreground',
      ].join(' ')}
    >
      EN
    </a>
    <a
      href={localizePath(pathname, 'zh')}
      aria-current={lang === 'zh' ? 'true' : undefined}
      class={[
        'px-2.5 py-1 text-xs font-medium transition-colors',
        lang === 'zh'
          ? 'bg-primary text-primary-foreground'
          : 'text-terminal-foreground/72 hover:bg-terminal-hover hover:text-terminal-foreground',
      ].join(' ')}
    >
      中文
    </a>
  </div>
  <span class="sr-only">{alternate}</span>
</div>
