import type { HookDoc } from '$lib/i18n/schema'
import { highlightCodeToHtml } from '../../syntax-highlight'

export { highlightCodeToHtml }

export async function highlightHookExample(hook: HookDoc): Promise<HookDoc> {
  return {
    ...hook,
    exampleHtml: await highlightCodeToHtml(hook.example, { language: 'ts' }),
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
