<script lang="ts">
  import type { WebsiteContent } from '$lib/i18n/schema'

  interface Props {
    content: WebsiteContent
  }

  let { content }: Props = $props()
  const copyrightYear = new Date().getFullYear()
</script>

<footer class="border-border border-t px-4 py-4 sm:px-6 lg:px-8">
  <div class="text-muted-foreground/80 mx-auto max-w-7xl text-[11px] leading-5 sm:text-[12px]">
    <p>{`Copyright © ${copyrightYear} ${content.footer.copyright}`}</p>
  </div>
</footer>
