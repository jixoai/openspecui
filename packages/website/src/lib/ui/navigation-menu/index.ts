// navigation-menu — pure barrel (tabs precedent): default = the
// canonical main; sub-parts as named defaults; export * carries
// module-level named exports/types. No logic lives here.
export { default } from './navigation-menu.svelte';
export * from './navigation-menu.svelte';
export { default as NavigationMenuItem } from './navigation-menu-item.svelte';
export * from './navigation-menu-item.svelte';
export { default as NavigationMenuTrigger } from './navigation-menu-trigger.svelte';
export * from './navigation-menu-trigger.svelte';
export { default as NavigationMenuPanel } from './navigation-menu-panel.svelte';
export * from './navigation-menu-panel.svelte';
export { default as NavigationMenuLink } from './navigation-menu-link.svelte';
export * from './navigation-menu-link.svelte';
export { default as NavigationMenuIndicator } from './navigation-menu-indicator.svelte';
export * from './navigation-menu-indicator.svelte';
export { NavigationMenuDefaults, type NavigationMenuSurfaceVariant } from './navigation-menu-defaults.svelte';
