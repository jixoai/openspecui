import type { HookDoc } from '$lib/i18n/schema'
import { codeToHtml } from 'shiki'

const shikiThemes = {
  light: 'rose-pine-dawn',
  dark: 'red',
} as const

export async function highlightHookExample(hook: HookDoc): Promise<HookDoc> {
  return {
    ...hook,
    exampleHtml: await codeToHtml(hook.example, {
      lang: 'ts',
      themes: shikiThemes,
      defaultColor: false,
      cssVariablePrefix: '--shiki-',
    }),
  }
}

export async function highlightHookExamples<
  T extends { onReadDocument: HookDoc; onRunWorkflow: HookDoc },
>(hooks: T): Promise<T> {
  return {
    ...hooks,
    onReadDocument: await highlightHookExample(hooks.onReadDocument),
    onRunWorkflow: await highlightHookExample(hooks.onRunWorkflow),
  }
}
