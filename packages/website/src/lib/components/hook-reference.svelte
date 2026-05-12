<script lang="ts">
  import type { HookDoc } from '$lib/i18n/schema'

  interface Props {
    hook: HookDoc
  }

  let { hook }: Props = $props()
</script>

<article class="border-border bg-card min-w-0 border shadow-sm">
  <div class="border-border border-b px-4 py-3 sm:px-5 sm:py-4">
    <p class="font-nav text-primary text-[11px] uppercase tracking-[0.24em]">Hook</p>
    <h2 class="font-nav mt-2 text-balance text-[1.25rem] leading-tight tracking-tight">
      {hook.name}
    </h2>
    <p class="text-muted-foreground mt-2 text-pretty text-[13px] leading-5 sm:text-[14px] sm:leading-6">
      {hook.purpose}
    </p>
  </div>

  <div class="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
    <div class="space-y-2">
      <h3 class="font-nav text-[14px] tracking-tight">Signature</h3>
      <code
        class="bg-terminal text-terminal-foreground scrollbar-thin scrollbar-track-transparent block overflow-x-auto px-3 py-2 text-[12px] leading-5"
      >
        {hook.signature}
      </code>
    </div>

    <div class="space-y-2">
      <h3 class="font-nav text-[14px] tracking-tight">When to use</h3>
      <p class="text-muted-foreground text-pretty text-[13px] leading-5 sm:text-[14px] sm:leading-6">
        {hook.when}
      </p>
    </div>

    <div class="space-y-2">
      <h3 class="font-nav text-[14px] tracking-tight">Stable for</h3>
      <ul class="grid gap-2">
        {#each hook.stableFor as item (item)}
          <li
            class="border-border text-muted-foreground border px-3 py-2 text-[13px] leading-5 sm:text-[14px]"
          >
            {item}
          </li>
        {/each}
      </ul>
    </div>

    {#if hook.exampleHtml}
      <div
        class="shiki-code border-border scrollbar-thin scrollbar-track-transparent overflow-x-auto border text-[12px] leading-5"
      >
        <!-- Shiki HTML is generated at build time from repository-owned hook examples. -->
        {@html hook.exampleHtml}
      </div>
    {:else}
      <pre
        class="bg-terminal text-terminal-foreground scrollbar-thin scrollbar-track-transparent overflow-x-auto px-3 py-3 text-[12px] leading-5"
      ><code>{hook.example}</code></pre>
    {/if}
  </div>
</article>
