<!--
  jixoai theme toggle (registry/files/ui/theme-toggle/theme-toggle.svelte).
  light / dark / system with four variants:
    full    — segmented selector: icon + label per mode, click to SET
    compact — cycling button: icon + current mode label
    icon    — cycling button: icon only (aria-label carries the mode)
    text    — cycling button: current mode label only
  Drives the shared theme contract (localStorage "theme", .dark class +
  colorScheme on the root). Pair with the no-flash inline bootstrap in
  app.html. Icons come from the shared $lib/icons module (lucide
  geometry inlined at build — no icon-library runtime dependency).

  tw4 (2026-08-24): PURE utility migration, zero css residue — the
  bezel's currentColor color-mix paint rides arbitrary-value utilities;
  the segmented group's last-slot border and the data-active fill are
  JS-known, so conditional strings carry them.
-->
<script lang="ts">
  import { icons } from '$lib/icons';
  import { cn } from '$lib/utils';
  import { ThemeToggleDefaults, type ThemeToggleVariant } from './theme-toggle-defaults.svelte';

  type Theme = 'light' | 'dark' | 'system';

  interface Props {
    variant?: ThemeToggleVariant;
    /** full variant only: hide the text labels, show icons alone. */
    hideLabels?: boolean;
  }

  let { variant, hideLabels = false }: Props = $props();
  // the family Defaults is the single read point (context-defaults-
  // economy 3.4): variant rides a literal slot (own 'compact', never
  // reads context — a structural selector, not a paint rung)
  const d = $derived(ThemeToggleDefaults.resolve({ variant }));

  const ORDER: Theme[] = ['light', 'dark', 'system'];
  const LABEL: Record<Theme, string> = { light: 'light', dark: 'dark', system: 'system' };

  let current = $state<Theme>('system');

  const apply = (theme: Theme): void => {
    const dark =
      theme === 'dark' ||
      (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  };

  const set = (theme: Theme): void => {
    current = theme;
    localStorage.setItem('theme', theme);
    apply(theme);
  };

  const cycle = (): void => set(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]!);

  $effect(() => {
    current = (localStorage.getItem('theme') as Theme | null) ?? 'system';
    apply(current);
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => current === 'system' && apply('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  });

  // the bezel recipe theme-toggle/language-switcher share: 1px
  // currentColor border, transparent fill, hover leans the border in
  const bezel =
    'inline-flex cursor-pointer items-center gap-1.5 border border-[color-mix(in_oklab,currentColor_35%,transparent)] bg-transparent text-[11px] text-inherit transition-[color,border-color,background-color] duration-150 ease-out';
</script>

{#snippet iconFor(theme: Theme)}
  <!-- sun/moon/monitor from the shared icons module; the wrapper owns
       the 13px box (module bakes 16px) and keeps the data hook -->
  {#if theme === 'light'}
    <span data-jx-theme-icon="" class="flex-none inline-flex [&_svg]:h-[13px] [&_svg]:w-[13px]">{@html icons.sun}</span>
  {:else if theme === 'dark'}
    <span data-jx-theme-icon="" class="flex-none inline-flex [&_svg]:h-[13px] [&_svg]:w-[13px]">{@html icons.moon}</span>
  {:else}
    <span data-jx-theme-icon="" class="flex-none inline-flex [&_svg]:h-[13px] [&_svg]:w-[13px]">{@html icons.monitor}</span>
  {/if}
{/snippet}

{#if d.variant === 'full'}
  <div data-jx-theme-segmented="" class="font-nav inline-flex" role="group" aria-label="Color theme">
    {#each ORDER as theme, index (theme)}
      <button
        type="button"
        onclick={() => set(theme)}
        aria-pressed={current === theme}
        aria-label={hideLabels ? LABEL[theme] : undefined}
        data-jx-theme-seg=""
        class={cn(
          'py-1',
          bezel,
          index === ORDER.length - 1 ? 'border-r' : 'border-r-0',
          'px-[9px]',
          current === theme && 'bg-[color-mix(in_oklab,currentColor_16%,transparent)]',
        )}
        data-active={current === theme || undefined}
      >
        {@render iconFor(theme)}
        {#if !hideLabels}
          <span>{LABEL[theme]}</span>
        {/if}
      </button>
    {/each}
  </div>
{:else}
  <button
    type="button"
    onclick={cycle}
    data-jx-theme-btn=""
    class={cn('font-nav px-2.5 py-1', bezel, 'hover:border-[color-mix(in_oklab,currentColor_70%,transparent)]')}
    aria-label={`theme: ${current}`}
  >
    {#if d.variant === 'compact'}
      {@render iconFor(current)}
      <span>{LABEL[current]}</span>
    {:else if d.variant === 'icon'}
      {@render iconFor(current)}
    {:else}
      <span>{LABEL[current]}</span>
    {/if}
  </button>
{/if}
