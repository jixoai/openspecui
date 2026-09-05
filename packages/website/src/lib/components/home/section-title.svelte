<!--
Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
1. Provide the shared Broadside section heading with its trailing rule and reveal entrance.

Owner correction (2026-08-19): "应该组件化就组件化，哪怕是我们官网这种小网站" — extracted from features/surfaces duplicates.
-->
<script lang="ts">

  interface Props {
    title: string
  }

  let { title }: Props = $props()
</script>

<h2 class="font-nav flex items-baseline gap-4 text-lg uppercase tracking-[0.3em]" data-reveal="">
  {title}
  <span class="bg-border h-px flex-1" aria-hidden="true"></span>
</h2>
