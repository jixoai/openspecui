// figure — pure barrel: default = the Figure primitive (浮); the
// frozen batch-0 numbering interface ships as module-level named
// exports/types; the route-page provider rides as a named default.
export { default } from './figure.svelte';
export * from './figure.svelte';
export * from './numbering.svelte';
export { default as NumberingProvider } from './numbering-provider.svelte';
