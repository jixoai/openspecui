import type {
  TranslationDownloadFilePlan,
  TranslationDownloadGroupPlan,
  TranslationModelDownloadPlan,
} from '@openspecui/core/translator'
import { posix as pathPosix } from 'node:path'

const CT2_REQUIRED_FILE_NAMES = [
  'config.json',
  'model.bin',
  'shared_vocabulary.json',
  'source.spm',
  'target.spm',
] as const

const CT2_OPTIONAL_FILE_NAMES = ['tokenizer_config.json', 'vocab.json'] as const

const CT2_OPTIONAL_FILE_NAME_SET = new Set<string>(CT2_OPTIONAL_FILE_NAMES)

export interface Ct2RepositoryFile {
  path: string
  sizeBytes?: number
  etag?: string
  revision?: string
  sourceUrl?: string
  raw?: unknown
}

export function resolveCt2ModelDownloadPlan(input: {
  modelId: string
  siblings: ReadonlyArray<{ rfilename: string; size?: number }>
  selectedGroupId?: string
}): TranslationModelDownloadPlan | null {
  return resolveCt2ModelDownloadPlanFromRepositoryFiles({
    modelId: input.modelId,
    selectedGroupId: input.selectedGroupId,
    files: input.siblings.map((entry) => ({
      path: entry.rfilename,
      sizeBytes: entry.size,
    })),
  })
}

export function resolveCt2ModelDownloadPlanFromRepositoryFiles(input: {
  modelId: string
  files: ReadonlyArray<Ct2RepositoryFile>
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
  const fileByPath = new Map(normalizedFiles.map((file) => [file.path, file] as const))
  const candidateRoots = collectCandidateRoots(normalizedFiles)
  const groups = candidateRoots
    .map((rootDir) => createGroup(rootDir, fileByPath))
    .filter((group): group is TranslationDownloadGroupPlan => group !== null)

  if (groups.length === 0) return null
  return buildPlan(input.modelId, groups, input.selectedGroupId)
}

function collectCandidateRoots(files: ReadonlyArray<Ct2RepositoryFile>): string[] {
  const roots = new Set<string>()
  for (const file of files) {
    if (pathPosix.basename(file.path) !== 'model.bin') continue
    roots.add(normalizeDir(pathPosix.dirname(file.path)))
  }
  return [...roots]
}

function createGroup(
  rootDir: string,
  fileByPath: ReadonlyMap<string, Ct2RepositoryFile>
): TranslationDownloadGroupPlan | null {
  const requiredFiles = CT2_REQUIRED_FILE_NAMES.map((fileName) =>
    fileByPath.get(joinRootFile(rootDir, fileName))
  )
  if (requiredFiles.some((file) => file === undefined)) return null
  const concreteRequiredFiles = requiredFiles.filter(
    (file): file is Ct2RepositoryFile => file !== undefined
  )

  const optionalFiles = CT2_OPTIONAL_FILE_NAMES.flatMap((fileName) => {
    const file = fileByPath.get(joinRootFile(rootDir, fileName))
    return file ? [file] : []
  })
  const files = [...concreteRequiredFiles, ...optionalFiles].map((file) => toPlanFile(file))
  const estimatedTotalBytes = files.reduce((total, file) => total + (file.sizeBytes ?? 0), 0)
  const hasRequiredSizes = files
    .filter((file) => file.required)
    .every((file) => file.sizeBytes !== undefined && file.sizeBytes > 0)
  const id = rootDir || 'default'
  return {
    id,
    label: rootDir ? pathPosix.basename(rootDir) : 'default',
    description: rootDir
      ? `CTranslate2 artifacts from ${rootDir}.`
      : 'CTranslate2 artifacts from the repository root.',
    estimatedTotalBytes: estimatedTotalBytes > 0 ? estimatedTotalBytes : undefined,
    selectable: hasRequiredSizes,
    selected: false,
    files,
  }
}

function toPlanFile(file: Ct2RepositoryFile): TranslationDownloadFilePlan {
  const required = !CT2_OPTIONAL_FILE_NAME_SET.has(pathPosix.basename(file.path))
  return {
    path: file.path,
    sizeBytes: file.sizeBytes,
    required,
    etag: file.etag,
    revision: file.revision,
    sourceUrl: file.sourceUrl,
    raw: file.raw,
  }
}

function buildPlan(
  modelId: string,
  groups: ReadonlyArray<TranslationDownloadGroupPlan>,
  selectedGroupId: string | undefined
): TranslationModelDownloadPlan {
  const selectedGroup =
    selectRequestedGroup(groups, selectedGroupId) ?? selectDefaultGroup(groups) ?? groups[0]
  const selectedId = selectedGroup.id
  const normalizedGroups = groups.map((group) => ({
    ...group,
    selected: group.id === selectedId,
    files: [...group.files],
  }))
  return {
    modelId,
    estimatedTotalBytes: selectedGroup.estimatedTotalBytes,
    files: [...selectedGroup.files],
    selectedGroupId: selectedId,
    groups: normalizedGroups,
  }
}

function selectRequestedGroup(
  groups: ReadonlyArray<TranslationDownloadGroupPlan>,
  selectedGroupId: string | undefined
): TranslationDownloadGroupPlan | null {
  if (!selectedGroupId) return null
  return groups.find((group) => group.id === selectedGroupId) ?? null
}

function selectDefaultGroup(
  groups: ReadonlyArray<TranslationDownloadGroupPlan>
): TranslationDownloadGroupPlan | null {
  const selectableGroups = groups.filter((group) => group.selectable)
  if (selectableGroups.length === 0) return null
  return (
    [...selectableGroups].sort((left, right) => {
      const leftSize = left.estimatedTotalBytes ?? Number.POSITIVE_INFINITY
      const rightSize = right.estimatedTotalBytes ?? Number.POSITIVE_INFINITY
      return leftSize - rightSize || left.id.localeCompare(right.id)
    })[0] ?? null
  )
}

function joinRootFile(rootDir: string, fileName: string): string {
  return rootDir ? `${rootDir}/${fileName}` : fileName
}

function normalizeDir(input: string): string {
  if (input === '.' || input === '') return ''
  return normalizePath(input)
}

function normalizePath(input: string): string {
  return input.replace(/^\.\/+/u, '').replace(/\/+/gu, '/')
}

function dedupeFiles(files: ReadonlyArray<Ct2RepositoryFile>): Ct2RepositoryFile[] {
  const deduped = new Map<string, Ct2RepositoryFile>()
  for (const file of files) {
    deduped.set(file.path, file)
  }
  return [...deduped.values()]
}

export { CT2_OPTIONAL_FILE_NAMES, CT2_REQUIRED_FILE_NAMES }
