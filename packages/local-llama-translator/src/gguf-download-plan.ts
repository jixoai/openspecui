import type {
  TranslationDownloadFilePlan,
  TranslationDownloadGroupPlan,
  TranslationModelDownloadPlan,
} from '@openspecui/core/translator'
import { posix as pathPosix } from 'node:path'

export interface GgufRepositoryFile {
  path: string
  sizeBytes?: number
  etag?: string
  revision?: string
  sourceUrl?: string
  raw?: unknown
}

export function resolveGgufModelDownloadPlanFromRepositoryFiles(input: {
  modelId: string
  files: ReadonlyArray<GgufRepositoryFile>
  selectedGroupId?: string
}): TranslationModelDownloadPlan | null {
  const normalizedFiles = dedupeFiles(
    input.files
      .filter((file) => file.path.trim().length > 0)
      .map((file) => ({
        ...file,
        path: normalizePath(file.path),
      }))
  )

  const groups = normalizedFiles
    .filter((file) => file.path.toLowerCase().endsWith('.gguf'))
    .map((file) => createGroup(file))

  if (groups.length === 0) return null
  const selectedGroup =
    selectRequestedGroup(groups, input.selectedGroupId) ?? selectPreferredSelectableGroup(groups)
  const selectedGroupId = selectedGroup?.id

  return {
    modelId: input.modelId,
    estimatedTotalBytes: selectedGroup?.estimatedTotalBytes,
    files: selectedGroup?.files ?? [],
    selectedGroupId,
    groups: groups.map((group) => ({
      ...group,
      selected: group.id === selectedGroupId,
      files: [...group.files],
    })),
  }
}

function createGroup(file: GgufRepositoryFile): TranslationDownloadGroupPlan {
  const planFile = toPlanFile(file)
  const baseGroupId = stripGgufExtension(pathPosix.basename(file.path))
  return {
    id: file.path,
    baseGroupId,
    label: baseGroupId,
    description: `GGUF runtime file from ${file.path}.`,
    estimatedTotalBytes: file.sizeBytes,
    selectable: typeof file.sizeBytes === 'number' && file.sizeBytes > 0,
    selected: false,
    files: [planFile],
  }
}

function toPlanFile(file: GgufRepositoryFile): TranslationDownloadFilePlan {
  return {
    path: file.path,
    sizeBytes: file.sizeBytes,
    required: true,
    etag: file.etag,
    revision: file.revision,
    sourceUrl: file.sourceUrl,
    raw: file.raw,
  }
}

function selectRequestedGroup(
  groups: ReadonlyArray<TranslationDownloadGroupPlan>,
  selectedGroupId: string | undefined
): TranslationDownloadGroupPlan | null {
  if (!selectedGroupId) return null
  return (
    groups.find(
      (group) =>
        group.selectable && (group.id === selectedGroupId || group.baseGroupId === selectedGroupId)
    ) ?? null
  )
}

function selectPreferredSelectableGroup(
  groups: ReadonlyArray<TranslationDownloadGroupPlan>
): TranslationDownloadGroupPlan | null {
  const selectableGroups = groups.filter(
    (group) => group.selectable && group.estimatedTotalBytes !== undefined
  )
  if (selectableGroups.length === 0) return null
  return (
    selectableGroups.sort((left, right) => {
      const compatibilityDelta =
        scorePreferredLlamaGroup(right.baseGroupId ?? right.id) -
        scorePreferredLlamaGroup(left.baseGroupId ?? left.id)
      if (compatibilityDelta !== 0) return compatibilityDelta
      return (
        (left.estimatedTotalBytes ?? Number.POSITIVE_INFINITY) -
          (right.estimatedTotalBytes ?? Number.POSITIVE_INFINITY) || left.id.localeCompare(right.id)
      )
    })[0] ?? null
  )
}

function scorePreferredLlamaGroup(groupId: string): number {
  const normalized = groupId.toUpperCase()
  if (normalized.includes('Q4_K_M')) return 5
  if (normalized.includes('Q4_K_S')) return 4
  if (normalized.includes('Q5_K_M')) return 3
  if (normalized.includes('Q5_K_S')) return 2
  if (normalized.includes('Q6_K')) return 1
  if (normalized.includes('IQ1') || normalized.includes('IQ2') || normalized.includes('IQ3')) {
    return -2
  }
  if (normalized.includes('TQ1') || normalized.includes('TQ2') || normalized.includes('1.25BIT')) {
    return -3
  }
  return 0
}

function stripGgufExtension(value: string): string {
  return value.replace(/\.gguf$/iu, '')
}

function normalizePath(input: string): string {
  return input.replace(/^\.\/+/u, '').replace(/\/+/gu, '/')
}

function dedupeFiles(files: ReadonlyArray<GgufRepositoryFile>): GgufRepositoryFile[] {
  const deduped = new Map<string, GgufRepositoryFile>()
  for (const file of files) {
    deduped.set(file.path, file)
  }
  return [...deduped.values()]
}
