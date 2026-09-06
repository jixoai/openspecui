// separator — pure barrel (tw4-css-modularization D3): default =
// the canonical main; sub-components as named defaults; export *
// carries module-level named exports/types. No logic lives here.
export { default } from './separator.svelte';
export * from './separator.svelte';
export { SeparatorDefaults, type SeparatorVariant } from './separator-defaults.svelte';
