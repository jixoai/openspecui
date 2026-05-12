## User Input

<user>我需要你将网站升级成svelte@v5，使用sveltekit来进行开发维护这个静态网站。你先调研一下最新版的svelte的开发，给出一份完整可靠的计划</user>
<user>Implement the plan.</user>

## Objective Scope

- Upgrade `packages/website` from the current React/Vite single-page landing site to a Svelte 5 + SvelteKit static site.
- Keep `www.openspecui.com` as a static Cloudflare Pages deployment.
- Add first-class documentation surface for project hooks, including `onReadDocument` and `onRunWorkflow`.
- Preserve the existing OpenSpecUI visual language by reusing shared product CSS tokens.
- Preserve English and Simplified Chinese support with SvelteKit-friendly URL routing.

## Non-Goals

- Do not migrate `packages/web`, `packages/app`, or CLI product UI to Svelte.
- Do not add server-side runtime functions for the website in this loop.
- Do not redesign the brand system beyond what is needed for the SvelteKit migration.
- Do not change hook runtime behavior in `packages/core` or `packages/cli`.

## Acceptance Boundary

- `packages/website` builds through SvelteKit with static output in `dist`.
- `/en/`, `/zh/`, `/en/hooks/`, and `/zh/hooks/` are generated as static pages.
- The homepage keeps the existing launch-command behavior and language switch.
- The hooks documentation page explains the stable hooks model and covers `onReadDocument` and `onRunWorkflow`.
- Local website typecheck, tests, and build pass.
