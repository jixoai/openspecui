import type { RunnerId } from '$lib/i18n/schema'

export function getRunnerCommandPrefix(runner: RunnerId): string {
  if (runner === 'pnpm') return 'pnpx'
  if (runner === 'bun') return 'bunx'
  return 'npx'
}

export function isRunnerId(value: string | null): value is RunnerId {
  return value === 'npm' || value === 'pnpm' || value === 'bun'
}
