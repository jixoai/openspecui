<script lang="ts">
  import ArrowUpRight from 'lucide-svelte/icons/arrow-up-right'
  import type { ComponentType, SvelteComponent } from 'svelte'
  import type { IconProps } from 'lucide-svelte'

  interface Props {
    href: string
    title: string
    body: string
    icon: ComponentType<SvelteComponent<IconProps>>
  }

  let { href, title, body, icon: Icon }: Props = $props()
</script>

<a
  href={href}
  target="_blank"
  rel="noreferrer"
  class="group flex items-start justify-between gap-4 px-4 py-3.5 transition-[transform,background-color,color,opacity] duration-150 hover:bg-muted/30 active:translate-y-px active:scale-[0.99]"
>
  <div class="min-w-0 space-y-2">
    <div class="flex items-center gap-2">
      <Icon class="text-primary h-4 w-4 shrink-0" />
      <span class="font-nav text-[16px] tracking-tight">{title}</span>
    </div>
    <p class="text-muted-foreground text-pretty text-[13px] leading-5 sm:text-[14px] sm:leading-6">
      {body}
    </p>
  </div>
  <ArrowUpRight
    class="text-muted-foreground group-hover:text-foreground mt-0.5 h-4 w-4 shrink-0 transition-colors"
  />
</a>
