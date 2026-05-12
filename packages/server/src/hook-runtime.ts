import type { OnReadDocumentHookV1, OnRunWorkflowHookV1, OpenSpecUIHooksV1 } from '@openspecui/core'
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const OPENSPECUI_HOOKS_RELATIVE_PATH = 'openspec/openspecui.hooks.ts'

export interface HookRuntime {
  readonly hooksPath: string
  load(): Promise<OpenSpecUIHooksV1>
  onDispose(cleanup: () => void | Promise<void>): void
  dispose(): Promise<void>
}

type TsImport = (specifier: string, options: string | { parentURL: string }) => Promise<unknown>

function isOnReadDocumentHook(value: unknown): value is OnReadDocumentHookV1 {
  return typeof value === 'function'
}

function isOnRunWorkflowHook(value: unknown): value is OnRunWorkflowHookV1 {
  return typeof value === 'function'
}

function normalizeHooksModule(moduleValue: unknown): OpenSpecUIHooksV1 {
  if (!moduleValue || typeof moduleValue !== 'object') {
    return {}
  }

  const record = moduleValue as Record<string, unknown>
  const defaultRecord =
    record.default && typeof record.default === 'object'
      ? (record.default as Record<string, unknown>)
      : {}
  const moduleExportsRecord =
    record['module.exports'] && typeof record['module.exports'] === 'object'
      ? (record['module.exports'] as Record<string, unknown>)
      : {}
  return {
    onReadDocument: isOnReadDocumentHook(record.onReadDocument)
      ? record.onReadDocument
      : isOnReadDocumentHook(defaultRecord.onReadDocument)
        ? defaultRecord.onReadDocument
        : isOnReadDocumentHook(moduleExportsRecord.onReadDocument)
          ? moduleExportsRecord.onReadDocument
          : undefined,
    onRunWorkflow: isOnRunWorkflowHook(record.onRunWorkflow)
      ? record.onRunWorkflow
      : isOnRunWorkflowHook(defaultRecord.onRunWorkflow)
        ? defaultRecord.onRunWorkflow
        : isOnRunWorkflowHook(moduleExportsRecord.onRunWorkflow)
          ? moduleExportsRecord.onRunWorkflow
          : undefined,
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export class ProjectHookRuntime implements HookRuntime {
  readonly hooksPath: string
  private hooksPromise: Promise<OpenSpecUIHooksV1> | null = null
  private readonly disposeCallbacks = new Set<() => void | Promise<void>>()

  constructor(projectDir: string) {
    this.hooksPath = join(projectDir, OPENSPECUI_HOOKS_RELATIVE_PATH)
  }

  async load(): Promise<OpenSpecUIHooksV1> {
    if (this.hooksPromise) return this.hooksPromise

    this.hooksPromise = this.loadFresh().catch(() => ({}))
    return this.hooksPromise
  }

  onDispose(cleanup: () => void | Promise<void>): void {
    this.disposeCallbacks.add(cleanup)
  }

  async dispose(): Promise<void> {
    const callbacks = [...this.disposeCallbacks]
    this.disposeCallbacks.clear()
    await Promise.allSettled(callbacks.map((cleanup) => cleanup()))
  }

  private async loadFresh(): Promise<OpenSpecUIHooksV1> {
    if (!(await pathExists(this.hooksPath))) {
      return {}
    }

    const { tsImport } = (await import('tsx/esm/api')) as { tsImport: TsImport }
    const hooksUrl = `${pathToFileURL(this.hooksPath).href}?t=${Date.now()}`
    const moduleValue = await tsImport(hooksUrl, { parentURL: pathToFileURL(this.hooksPath).href })
    return normalizeHooksModule(moduleValue)
  }
}

export function createHookRuntime(projectDir: string): HookRuntime {
  return new ProjectHookRuntime(projectDir)
}
