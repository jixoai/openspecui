import type {
  TranslationDownloadFilePlan,
  TranslationDownloadGroupPlan,
  TranslationModelDownloadPlan,
} from './translator.js'

export const LOCAL_MODEL_PROFILE_DEFINITIONS = [
  { id: 'q1', label: 'q1', dtype: 'q1', suffix: '_q1', description: '1-bit quantized ONNX profile.' },
  {
    id: 'q1f16',
    label: 'q1f16',
    dtype: 'q1f16',
    suffix: '_q1f16',
    description: '1-bit block quantized fp16 ONNX profile.',
  },
  { id: 'q2', label: 'q2', dtype: 'q2', suffix: '_q2', description: '2-bit quantized ONNX profile.' },
  {
    id: 'q2f16',
    label: 'q2f16',
    dtype: 'q2f16',
    suffix: '_q2f16',
    description: '2-bit block quantized fp16 ONNX profile.',
  },
  { id: 'q4', label: 'q4', dtype: 'q4', suffix: '_q4', description: '4-bit quantized ONNX profile.' },
  {
    id: 'q4f16',
    label: 'q4f16',
    dtype: 'q4f16',
    suffix: '_q4f16',
    description: '4-bit block quantized fp16 ONNX profile.',
  },
  { id: 'bnb4', label: 'bnb4', dtype: 'bnb4', suffix: '_bnb4', description: 'bitsandbytes 4-bit ONNX profile.' },
  { id: 'q8', label: 'q8', dtype: 'q8', suffix: '_quantized', description: '8-bit quantized ONNX profile.' },
  { id: 'int8', label: 'int8', dtype: 'int8', suffix: '_int8', description: 'int8 ONNX profile.' },
  { id: 'uint8', label: 'uint8', dtype: 'uint8', suffix: '_uint8', description: 'uint8 ONNX profile.' },
  { id: 'fp16', label: 'fp16', dtype: 'fp16', suffix: '_fp16', description: 'fp16 ONNX profile.' },
  { id: 'fp32', label: 'fp32', dtype: 'fp32', suffix: '', description: 'fp32 ONNX profile.' },
] as const

export type LocalModelProfileId = (typeof LOCAL_MODEL_PROFILE_DEFINITIONS)[number]['id']

export interface LocalRepositoryFile {
  path: string
  sizeBytes?: number
}

export interface LocalRuntimeProfileFiles {
  profile: LocalModelProfileId
  dtype: string
  files: ReadonlyArray<LocalRepositoryFile>
}

const AUXILIARY_FILE_NAMES = new Set([
  'added_tokens.json',
  'config.json',
  'generation_config.json',
  'merges.txt',
  'preprocessor_config.json',
  'sentencepiece.bpe.model',
  'source.spm',
  'special_tokens_map.json',
  'spiece.model',
  'target.spm',
  'tokenizer.json',
  'tokenizer.model',
  'tokenizer_config.json',
  'vocab.json',
])

export function buildLocalDownloadPlanFromRepositoryFiles(input: {
  modelId: string
  files: ReadonlyArray<LocalRepositoryFile>
  isEncoderDecoder?: boolean
  selectedGroupId?: string
}): TranslationModelDownloadPlan | null {
  const fileMap = new Map(
    input.files
      .filter((file) => file.path.length > 0)
      .map((file) => [file.path, file.sizeBytes] as const)
  )
  const requiredBaseNames = resolveRequiredBaseNames(fileMap, input.isEncoderDecoder)
  if (requiredBaseNames.length === 0) return null

  const auxiliaryFiles = collectAuxiliaryFiles(fileMap)
  const groups = LOCAL_MODEL_PROFILE_DEFINITIONS.flatMap((profile) => {
    const onnxFiles = collectProfileOnnxFiles({
      fileMap,
      requiredBaseNames,
      suffix: profile.suffix,
    })
    if (!onnxFiles) return []
    return [
      createDownloadGroup({
        id: profile.id,
        label: buildProfileLabel(profile.id),
        description: profile.description,
        profile: profile.id,
        dtype: profile.dtype,
        files: [...auxiliaryFiles, ...onnxFiles],
      }),
    ]
  })

  return buildPlanFromGroups({
    modelId: input.modelId,
    groups,
    selectedGroupId: input.selectedGroupId,
  })
}

export function buildLocalDownloadPlanFromRuntimeProfileFiles(input: {
  modelId: string
  groups: ReadonlyArray<LocalRuntimeProfileFiles>
  selectedGroupId?: string
}): TranslationModelDownloadPlan | null {
  const groups = input.groups.flatMap((entry) => {
    const profile = LOCAL_MODEL_PROFILE_DEFINITIONS.find((item) => item.id === entry.profile)
    if (!profile || entry.files.length === 0) return []
    return [
      createDownloadGroup({
        id: profile.id,
        label: buildProfileLabel(profile.id),
        description: profile.description,
        profile: profile.id,
        dtype: entry.dtype,
        files: entry.files,
      }),
    ]
  })

  return buildPlanFromGroups({
    modelId: input.modelId,
    groups,
    selectedGroupId: input.selectedGroupId,
  })
}

export function selectLocalDownloadGroup(
  plan: TranslationModelDownloadPlan | null,
  selectedGroupId: string | undefined
): TranslationDownloadGroupPlan | null {
  if (!plan?.groups?.length) return null
  const explicit = selectedGroupId
    ? plan.groups.find((group) => group.id === selectedGroupId && group.selectable)
    : undefined
  return explicit ?? plan.groups.find((group) => group.selected) ?? selectSmallestSelectableGroup(plan.groups)
}

function buildPlanFromGroups(input: {
  modelId: string
  groups: ReadonlyArray<TranslationDownloadGroupPlan>
  selectedGroupId?: string
}): TranslationModelDownloadPlan | null {
  if (input.groups.length === 0) return null
  const selectedGroup =
    selectRequestedGroup(input.groups, input.selectedGroupId) ?? selectSmallestSelectableGroup(input.groups)
  const selectedGroupId = selectedGroup?.id
  const groups = input.groups.map((group) => ({
    ...group,
    selected: group.id === selectedGroupId,
  }))
  const selectedFiles = selectedGroup?.files ?? []
  return {
    modelId: input.modelId,
    estimatedTotalBytes: selectedGroup?.estimatedTotalBytes,
    files: selectedFiles,
    selectedGroupId,
    groups,
  }
}

function selectRequestedGroup(
  groups: ReadonlyArray<TranslationDownloadGroupPlan>,
  selectedGroupId: string | undefined
): TranslationDownloadGroupPlan | null {
  if (!selectedGroupId) return null
  return groups.find((group) => group.id === selectedGroupId && group.selectable) ?? null
}

function selectSmallestSelectableGroup(
  groups: ReadonlyArray<TranslationDownloadGroupPlan>
): TranslationDownloadGroupPlan | null {
  return (
    groups
      .filter((group) => group.selectable && group.estimatedTotalBytes !== undefined)
      .sort((left, right) => (left.estimatedTotalBytes ?? 0) - (right.estimatedTotalBytes ?? 0))[0] ??
    null
  )
}

function createDownloadGroup(input: {
  id: string
  label: string
  description?: string
  profile: string
  dtype: string
  files: ReadonlyArray<LocalRepositoryFile>
}): TranslationDownloadGroupPlan {
  const files = dedupeFiles(input.files).map((file) => ({
    path: file.path,
    sizeBytes: file.sizeBytes,
    required: true,
  }))
  const estimatedTotalBytes = files.reduce((total, file) => total + (file.sizeBytes ?? 0), 0)
  const hasConcreteSizes = files.length > 0 && files.every((file) => file.sizeBytes !== undefined)
  return {
    id: input.id,
    label: input.label,
    description: input.description,
    profile: input.profile,
    dtype: input.dtype,
    estimatedTotalBytes: estimatedTotalBytes > 0 ? estimatedTotalBytes : undefined,
    selectable: hasConcreteSizes && estimatedTotalBytes > 0,
    selected: false,
    files,
  }
}

function resolveRequiredBaseNames(
  fileMap: ReadonlyMap<string, number | undefined>,
  isEncoderDecoder: boolean | undefined
): string[] {
  const paths = [...fileMap.keys()]
  const hasEncoder = paths.some((path) => path.startsWith('onnx/encoder_model'))
  const hasMergedDecoder = paths.some((path) => path.startsWith('onnx/decoder_model_merged'))
  if (isEncoderDecoder === true || (hasEncoder && hasMergedDecoder)) {
    return ['encoder_model', 'decoder_model_merged']
  }
  if (paths.some((path) => path.startsWith('onnx/model'))) {
    return ['model']
  }
  return []
}

function collectProfileOnnxFiles(input: {
  fileMap: ReadonlyMap<string, number | undefined>
  requiredBaseNames: ReadonlyArray<string>
  suffix: string
}): TranslationDownloadFilePlan[] | null {
  const files: TranslationDownloadFilePlan[] = []
  for (const baseName of input.requiredBaseNames) {
    const onnxPath = `onnx/${baseName}${input.suffix}.onnx`
    if (!input.fileMap.has(onnxPath)) return null
    files.push({
      path: onnxPath,
      sizeBytes: input.fileMap.get(onnxPath),
      required: true,
    })
    const externalPrefix = `${onnxPath}_data`
    for (const [path, sizeBytes] of input.fileMap) {
      if (path.startsWith(externalPrefix)) {
        files.push({ path, sizeBytes, required: true })
      }
    }
  }
  return files
}

function collectAuxiliaryFiles(
  fileMap: ReadonlyMap<string, number | undefined>
): TranslationDownloadFilePlan[] {
  const files: TranslationDownloadFilePlan[] = []
  for (const [path, sizeBytes] of fileMap) {
    if (AUXILIARY_FILE_NAMES.has(path)) {
      files.push({ path, sizeBytes, required: true })
    }
  }
  return files.sort((left, right) => left.path.localeCompare(right.path))
}

function dedupeFiles(files: ReadonlyArray<LocalRepositoryFile>): LocalRepositoryFile[] {
  const seen = new Set<string>()
  const result: LocalRepositoryFile[] = []
  for (const file of files) {
    if (!file.path || seen.has(file.path)) continue
    seen.add(file.path)
    result.push(file)
  }
  return result
}

function buildProfileLabel(profile: string): string {
  switch (profile) {
    case 'q1':
      return 'q1 (1-bit)'
    case 'q2':
      return 'q2 (2-bit)'
    case 'q4':
      return 'q4 (4-bit)'
    case 'q8':
      return 'q8 (8-bit)'
    default:
      return profile
  }
}
