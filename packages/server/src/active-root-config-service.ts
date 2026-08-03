/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Project exact Active Root owner, file, official fields, diagnostics, and revision.
 * 2. Serialize in-process mutations by physical config path and compare loaded ownership evidence.
 * 3. Apply Structured node patches or Raw whole-document syntax validation.
 * 4. Convert atomic physical compare/write outcomes into typed latest-source recovery results.
 *
 * Original request (2026-08-01): preserve raw YAML writes for team-defined keys outside the official standard.
 * Derived checkpoint (2026-08-02): parallel and external stale saves return conflicts with latest physical source.
 */
import {
  ActiveRootMutationSchema,
  ActiveRootRevisionSchema,
  compareAndWriteAtomicPhysicalReactiveFile,
  inspectActiveRootOfficialConfig,
  patchActiveRootOfficialFields,
  validateActiveRootRawYaml,
  type ActiveRootConfig,
  type ActiveRootConfigDiagnostic,
  type ActiveRootMutation,
  type ActiveRootMutationResult,
  type RootContext,
} from '@openspecui/core'
import { createHash } from 'node:crypto'
import { relative } from 'node:path'
import { readPlanningYamlConfigFile } from './planning-config-service.js'

const mutationTails = new Map<string, Promise<void>>()

function createRevision(config: Omit<ActiveRootConfig, 'revision'>) {
  const source = JSON.stringify({
    owner: config.owner,
    file: {
      path: config.file.path,
      exists: config.file.exists,
      content: config.file.content,
    },
  })
  return ActiveRootRevisionSchema.parse(
    `sha256:${createHash('sha256').update(source).digest('hex')}`
  )
}

async function serializeMutation<T>(path: string, mutation: () => Promise<T>): Promise<T> {
  const previous = mutationTails.get(path) ?? Promise.resolve()
  const execution = previous.catch(() => undefined).then(mutation)
  const tail = execution.then(
    () => undefined,
    () => undefined
  )
  mutationTails.set(path, tail)
  try {
    return await execution
  } finally {
    if (mutationTails.get(path) === tail) mutationTails.delete(path)
  }
}

/** Read the exact active Planning-root YAML source and derive its opaque loaded revision. */
export async function readActiveRootConfig(input: {
  launchProjectDir: string
  rootContext: RootContext
}): Promise<ActiveRootConfig> {
  const planningRoot = input.rootContext.planningRoot
  if (!planningRoot) throw new Error('Planning root is unavailable.')
  const file = await readPlanningYamlConfigFile({ rootPath: planningRoot.path })
  const inspection = inspectActiveRootOfficialConfig(file.content)
  const configWithoutRevision = {
    kind: 'active-root' as const,
    owner: {
      kind: 'planning-root' as const,
      path: planningRoot.path,
      source: planningRoot.source,
      storeId: input.rootContext.storeId,
      externalToLaunchProject: planningRoot.path !== input.launchProjectDir,
    },
    file,
    ...inspection,
  }
  return { ...configWithoutRevision, revision: createRevision(configWithoutRevision) }
}

function conflictReason(
  latest: ActiveRootConfig,
  mutation: ActiveRootMutation
): Extract<ActiveRootMutationResult, { state: 'conflict' }>['reason'] | null {
  if (latest.owner.path !== mutation.ownerPath) return 'owner-changed'
  if (latest.file.path !== mutation.filePath) return 'file-changed'
  if (latest.revision !== mutation.revision) return 'revision-changed'
  return null
}

function structuredSourceDiagnostics(latest: ActiveRootConfig): ActiveRootConfigDiagnostic[] {
  const sourceDiagnostics = latest.diagnostics.filter(
    ({ code }) => code === 'config-unparseable' || code === 'config-not-mapping'
  )
  return sourceDiagnostics.length > 0
    ? sourceDiagnostics
    : [
        {
          code: 'config-not-mapping',
          severity: 'error',
          path: '$',
          message: 'The current Active Root source cannot be edited in Structured mode.',
        },
      ]
}

/**
 * Apply one exact-revision Structured or Raw mutation through atomic physical compare-and-write.
 * Conflicts and invalid sources retain the latest authoritative projection for explicit recovery.
 */
export async function mutateActiveRootConfig(input: {
  launchProjectDir: string
  rootContext: RootContext
  mutation: ActiveRootMutation
}): Promise<ActiveRootMutationResult> {
  const mutation = ActiveRootMutationSchema.parse(input.mutation)
  const initial = await readActiveRootConfig(input)
  return serializeMutation(initial.file.path, async () => {
    const latest = await readActiveRootConfig(input)
    const reason = conflictReason(latest, mutation)
    if (reason) return { state: 'conflict', reason, latest }

    let content: string
    if (mutation.mode === 'raw') {
      const validation = validateActiveRootRawYaml(mutation.content)
      if (!validation.valid) {
        return {
          state: 'invalid',
          reason: 'raw-syntax',
          diagnostics: validation.diagnostics,
          latest,
        }
      }
      content = mutation.content
    } else {
      try {
        content = patchActiveRootOfficialFields(latest.file.content, mutation.update)
      } catch {
        return {
          state: 'invalid',
          reason: 'structured-source',
          diagnostics: structuredSourceDiagnostics(latest),
          latest,
        }
      }
    }

    const write = await compareAndWriteAtomicPhysicalReactiveFile({
      rootPath: latest.owner.path,
      relativePath: relative(latest.owner.path, latest.file.path),
      expectedContent: latest.file.content,
      content,
    })
    const settled = await readActiveRootConfig(input)
    if (write.state === 'conflict') {
      return { state: 'conflict', reason: 'revision-changed', latest: settled }
    }
    return { state: 'applied', config: settled }
  })
}
