import { Button } from '@/components/button'
import { ButtonGroup, type ButtonGroupOption } from '@/components/button-group'
import { Dialog } from '@/components/dialog'
import { Select, type SelectOption } from '@/components/select'
import { Switch } from '@/components/switch'
import { TocSection } from '@/components/toc'
import { Tooltip } from '@/components/tooltip'
import {
  getBrowserSupportTableState,
  patchBrowserSupportTableRow,
  prepareBrowserTranslation,
  scanBrowserTranslationPairs,
  type BrowserTranslationAvailability,
  type BrowserTranslationAvailabilityRow,
  type BrowserTranslationSupportTableState,
} from '@/lib/browser-translation'
import { resolveDocumentTranslationConfig } from '@/lib/resolve-document-translation-config'
import { isStaticMode } from '@/lib/static-mode'
import { runSingleTranslation } from '@/lib/translate-service'
import { findTranslationLanguage, searchTranslationLanguages } from '@/lib/translation-languages'
import {
  DEFAULT_TRANSLATION_TEST_SOURCE_LANGUAGE,
  getTranslationTestSourceSample,
} from '@/lib/translation-test-samples'
import { trpc, trpcClient } from '@/lib/trpc'
import { useConfigSubscription, useGlobalSettingsSubscription } from '@/lib/use-subscription'
import {
  DEFAULT_TRANSLATION_CACHE_ENTRY_LIMIT,
  type DocumentTranslationConfigUpdate,
  type DocumentTranslationDisplayMode,
} from '@openspecui/core/document-translation'
import {
  checkLocalDirectionalModelLanguagePair,
  inferLocalDirectionalModelLanguagePair,
} from '@openspecui/core/translation-language-pair'
import {
  TRANSLATION_ENGINE_IDS,
  createTranslationEngineLifecycleStatus,
  getManagedLocalTranslationEngineManifest,
  getTranslationEngineManifest,
  getTranslationEngineLifecycleMessage,
  isManagedLocalTranslationEngineId,
  shouldShowTranslationEngineInstallGate,
  type LocalModelAssetState,
  type LocalModelCatalogItem,
  type TranslationDownloadGroupPlan,
  type TranslationEngineId,
  type TranslationEngineLifecycleStatus,
  type TranslationModelDownloadPlan,
} from '@openspecui/core/translator'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Download,
  ExternalLink,
  FlaskConical,
  Languages,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ToggleEvent as ReactToggleEvent,
} from 'react'

const DEFAULT_TRANSLATION_TARGET_LANGUAGE = 'zh'
const DEFAULT_TRANSLATION_DISPLAY_MODE: DocumentTranslationDisplayMode = 'direct'
const DEFAULT_TRANSLATION_CACHE_ENABLED = false
const DEFAULT_LOCAL_MODEL_ID = 'Xenova/opus-mt-no-de'
const DEFAULT_LOCAL_CT2_MODEL_ID = 'ooeoeo/opus-mt-en-zh-ct2-float16'
const DEFAULT_TRANSLATION_SMOKE_SOURCE_LANGUAGE = DEFAULT_TRANSLATION_TEST_SOURCE_LANGUAGE

const TRANSLATION_DISPLAY_MODE_OPTIONS = [
  { value: 'direct', label: 'Direct' },
  { value: 'bilingual', label: 'Bilingual' },
] satisfies ButtonGroupOption<DocumentTranslationDisplayMode>[]

const BROWSER_ACTIONABLE_AVAILABILITIES = new Set<BrowserTranslationAvailability>([
  'available',
  'downloading',
  'downloadable',
])

type DownloadStateChipTone = 'downloaded' | 'partial' | 'not-started'

interface LocalPanelStateData {
  modelId: string
  selectedGroupId?: string
  asset: LocalModelAssetState
  downloadPlan: TranslationModelDownloadPlan | null
}

type ManagedLocalTranslationEngineId = Extract<TranslationEngineId, 'local' | 'local-ct2'>

interface TranslationEngineQueryListItem {
  id: TranslationEngineId
  lifecycle: TranslationEngineLifecycleStatus
}

function getBrowserSupportRows(
  state: BrowserTranslationSupportTableState | null
): BrowserTranslationAvailabilityRow[] {
  return state?.table?.rows ?? []
}

function getBrowserPairKey(
  row: Pick<BrowserTranslationAvailabilityRow, 'sourceLanguage' | 'targetLanguage'>
): string {
  return `${row.sourceLanguage}->${row.targetLanguage}`
}

function getBrowserPairLabel(row: BrowserTranslationAvailabilityRow): string {
  const source = findTranslationLanguage(row.sourceLanguage)
  const target = findTranslationLanguage(row.targetLanguage)
  return `${source?.code ?? row.sourceLanguage} -> ${target?.code ?? row.targetLanguage}`
}

function getBrowserPairDescription(row: BrowserTranslationAvailabilityRow): string {
  const source = findTranslationLanguage(row.sourceLanguage)
  const target = findTranslationLanguage(row.targetLanguage)
  return `${source?.label ?? row.sourceLanguage} to ${target?.label ?? row.targetLanguage}`
}

function getBrowserSupportMessage(state: BrowserTranslationSupportTableState | null): string {
  if (!state) return 'Browser translation support has not been checked yet.'
  return state.message ?? 'Browser translation support is unavailable.'
}

function getDownloadStateChipClasses(input: {
  tone: DownloadStateChipTone
  selected: boolean
  interactive?: boolean
}): string {
  const interactive = input.interactive ?? true
  const borderClass = input.selected ? 'border-solid' : 'border-dashed'
  const toneClass =
    input.tone === 'downloaded'
      ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400'
      : input.tone === 'partial'
        ? 'border-sky-500 text-sky-700 dark:text-sky-400'
        : 'border-border text-foreground'
  const hoverClass = interactive ? 'hover:border-current' : ''
  return `${borderClass} ${toneClass} ${hoverClass}`.trim()
}

function getBrowserAvailabilityChipTone(
  availability: BrowserTranslationAvailability
): DownloadStateChipTone {
  if (availability === 'available') return 'downloaded'
  if (availability === 'downloading') return 'partial'
  return 'not-started'
}

function getBrowserCapabilityMessage(state: BrowserTranslationSupportTableState | null): string {
  if (!state) return 'Browser translation support has not been checked yet.'
  if (state.state === 'checking') return 'Checking browser translation support.'
  if (state.state === 'ready') return 'Browser translation support is available.'
  return state.message ?? 'Browser translation support is unavailable.'
}

function getBrowserRowActionKind(input: {
  row: BrowserTranslationAvailabilityRow | null
  activeSourceLanguage: string | null
}): 'download' | 'cancel' | 'downloaded' | 'progress' {
  if (!input.row) return 'progress'
  if (input.row.availability === 'available') return 'downloaded'
  if (
    input.row.availability === 'downloading' &&
    input.activeSourceLanguage === input.row.sourceLanguage
  ) {
    return 'cancel'
  }
  if (input.row.availability === 'downloadable') return 'download'
  return 'progress'
}

function getBrowserStatusIconState(
  state: BrowserTranslationSupportTableState | null
): 'checking' | 'available' | 'downloadable' | 'unavailable' {
  if (!state || state.state === 'idle' || state.state === 'checking') return 'checking'
  if (state.state !== 'ready') return 'unavailable'
  const rows = getBrowserSupportRows(state)
  if (rows.some((row) => row.availability === 'available')) return 'available'
  if (rows.some((row) => BROWSER_ACTIONABLE_AVAILABILITIES.has(row.availability))) {
    return 'downloadable'
  }
  return 'unavailable'
}

function getTranslationSmokePreset(): {
  sourceLanguage: string
  sourceText: string
} {
  return {
    sourceLanguage: DEFAULT_TRANSLATION_SMOKE_SOURCE_LANGUAGE,
    sourceText: '',
  }
}

function getTranslationTestPlaceholder(sourceLanguage: string): string {
  return getTranslationTestSourceSample(sourceLanguage)
}

function getPreferredSmokeSourceLanguage(input: {
  engineId: TranslationEngineId | null
  model: string
  targetLanguage: string
}): string {
  if (!isManagedLocalTranslationEngineId(input.engineId)) {
    return DEFAULT_TRANSLATION_SMOKE_SOURCE_LANGUAGE
  }
  const expectedPair = inferLocalDirectionalModelLanguagePair(input.model)
  if (!expectedPair) return DEFAULT_TRANSLATION_SMOKE_SOURCE_LANGUAGE
  const directionCheck = checkLocalDirectionalModelLanguagePair({
    model: input.model,
    sourceLanguage: expectedPair.sourceLanguage,
    targetLanguage: input.targetLanguage,
  })
  return directionCheck.supported
    ? expectedPair.sourceLanguage
    : DEFAULT_TRANSLATION_SMOKE_SOURCE_LANGUAGE
}

function replaceQueryCacheData<TData>(
  current: TData | { data?: TData; [key: string]: unknown } | undefined,
  nextData: TData
): unknown {
  if (current && typeof current === 'object' && 'data' in current && 'isLoading' in current) {
    return {
      ...(current as Record<string, unknown>),
      data: nextData,
      isLoading: false,
      isFetching: false,
    }
  }
  return nextData
}

function replaceTranslationEngineLifecycleInQueryData<
  TItem extends TranslationEngineQueryListItem,
  TCurrent extends TItem[] | { data?: TItem[]; [key: string]: unknown } | undefined,
>(
  current: TCurrent,
  input: {
    engineId: TranslationEngineId
    lifecycle: TranslationEngineLifecycleStatus
  }
): TCurrent {
  const updateItems = (items: TItem[] | undefined) =>
    items?.map((item) => (item.id === input.engineId ? { ...item, lifecycle: input.lifecycle } : item)) as
      | TItem[]
      | undefined

  if (Array.isArray(current)) {
    return updateItems(current) as TCurrent
  }

  if (current && typeof current === 'object' && 'data' in current) {
    return {
      ...current,
      data: updateItems(current.data),
    } as TCurrent
  }

  return current
}

function mergeLocalCatalogItems(
  ...sources: Array<ReadonlyArray<LocalModelCatalogItem> | null | undefined>
): LocalModelCatalogItem[] {
  const merged: LocalModelCatalogItem[] = []
  const indexById = new Map<string, number>()

  for (const source of sources) {
    if (!source) continue
    for (const item of source) {
      const existingIndex = indexById.get(item.id)
      if (existingIndex === undefined) {
        indexById.set(item.id, merged.length)
        merged.push(item)
      }
    }
  }

  return merged
}

function getManagedLocalDefaultModel(engineId: ManagedLocalTranslationEngineId): string {
  return engineId === 'local-ct2' ? DEFAULT_LOCAL_CT2_MODEL_ID : DEFAULT_LOCAL_MODEL_ID
}

function getManagedLocalEngineSettings(input: {
  engineId: ManagedLocalTranslationEngineId
  resolvedTranslationConfig: ReturnType<typeof resolveDocumentTranslationConfig> | undefined
  globalSettings:
    | {
        translationEngines?: {
          local?: { model?: string; selectedGroupId?: string; hfEndpoint?: string }
          localCt2?: { model?: string; selectedGroupId?: string; hfEndpoint?: string }
        }
      }
    | undefined
}): {
  model: string
  selectedGroupId: string | undefined
  hfEndpoint: string
} {
  const projectSettings =
    input.engineId === 'local-ct2'
      ? input.resolvedTranslationConfig?.engines?.localCt2
      : input.resolvedTranslationConfig?.engines?.local
  const globalEngineSettings =
    input.engineId === 'local-ct2'
      ? input.globalSettings?.translationEngines?.localCt2
      : input.globalSettings?.translationEngines?.local
  return {
    model:
      projectSettings?.model ??
      globalEngineSettings?.model ??
      getManagedLocalDefaultModel(input.engineId),
    selectedGroupId: projectSettings?.selectedGroupId ?? globalEngineSettings?.selectedGroupId,
    hfEndpoint: globalEngineSettings?.hfEndpoint ?? '',
  }
}

function createManagedLocalProjectSettingsPatch(
  engineId: ManagedLocalTranslationEngineId,
  patch: { model?: string; selectedGroupId?: string | null }
): NonNullable<DocumentTranslationConfigUpdate['engines']> {
  return engineId === 'local-ct2' ? { localCt2: patch } : { local: patch }
}

function createManagedLocalGlobalSettingsPatch(
  engineId: ManagedLocalTranslationEngineId,
  patch: { model?: string; selectedGroupId?: string | null; hfEndpoint?: string }
): {
  local?: { model?: string; selectedGroupId?: string | null; hfEndpoint?: string }
  localCt2?: { model?: string; selectedGroupId?: string | null; hfEndpoint?: string }
} {
  return engineId === 'local-ct2' ? { localCt2: patch } : { local: patch }
}

function getManagedLocalPanelStateQueryKey(input: {
  engineId: ManagedLocalTranslationEngineId
  modelId: string
  selectedGroupId?: string
}) {
  return [
    'translation',
    'managed-local',
    input.engineId,
    'panel-state',
    input.modelId,
    input.selectedGroupId ?? '',
  ] as const
}

function listManagedLocalCatalog(engineId: ManagedLocalTranslationEngineId) {
  return engineId === 'local'
    ? trpcClient.localModels.listLocal.query()
    : trpcClient.localCt2Models.listLocal.query()
}

function subscribeManagedLocalRemoteCatalog(
  engineId: ManagedLocalTranslationEngineId,
  input: {
    requestId: string
    query?: string
    targetLanguage?: string
    limit?: number
  },
  handlers: {
    onData: (event: {
      requestId: string
      phase: 'candidates' | 'enriched' | 'complete' | 'error'
      items?: LocalModelCatalogItem[]
    }) => void
    onError?: (error: unknown) => void
  }
) {
  return engineId === 'local'
    ? trpcClient.localModels.searchRemoteStream.subscribe(input, handlers)
    : trpcClient.localCt2Models.searchRemoteStream.subscribe(input, handlers)
}

function subscribeManagedLocalLogs(
  engineId: ManagedLocalTranslationEngineId,
  handlers: {
    onData: (log: { modelId: string; selectedGroupId?: string }) => void
    onError?: (error: unknown) => void
  }
) {
  return engineId === 'local'
    ? trpcClient.localModels.subscribeLogs.subscribe(undefined, handlers)
    : trpcClient.localCt2Models.subscribeLogs.subscribe(undefined, handlers)
}

function queryManagedLocalPanelState(input: {
  engineId: ManagedLocalTranslationEngineId
  modelId: string
  selectedGroupId?: string
}): Promise<LocalPanelStateData> {
  const request = { modelId: input.modelId, selectedGroupId: input.selectedGroupId }
  return input.engineId === 'local'
    ? trpcClient.localModels.panelState.query(request)
    : trpcClient.localCt2Models.panelState.query(request)
}

function markManagedLocalModelSelected(
  engineId: ManagedLocalTranslationEngineId,
  modelId: string
): Promise<LocalPanelStateData> {
  return engineId === 'local'
    ? trpcClient.localModels.markSelected.mutate({ modelId })
    : trpcClient.localCt2Models.markSelected.mutate({ modelId })
}

function refreshManagedLocalArtifacts(
  engineId: ManagedLocalTranslationEngineId,
  input: { modelId?: string }
): Promise<LocalPanelStateData> {
  return engineId === 'local'
    ? trpcClient.localModels.refreshArtifacts.mutate(input)
    : trpcClient.localCt2Models.refreshArtifacts.mutate(input)
}

function cacheManagedLocalPanelState(input: {
  engineId: ManagedLocalTranslationEngineId
  panelState: LocalPanelStateData
  queryClient: ReturnType<typeof useQueryClient>
  requestedSelectedGroupId?: string
}) {
  const selectedGroupIds = new Set<string | undefined>([
    input.panelState.selectedGroupId,
    input.requestedSelectedGroupId,
    undefined,
  ])
  for (const selectedGroupId of selectedGroupIds) {
    input.queryClient.setQueryData(
      getManagedLocalPanelStateQueryKey({
        engineId: input.engineId,
        modelId: input.panelState.modelId,
        selectedGroupId,
      }),
      (current: LocalPanelStateData | { data?: LocalPanelStateData } | undefined) =>
        replaceQueryCacheData(current, input.panelState)
    )
  }
}

function shouldPollManagedLocalPanelState(
  panelState: LocalPanelStateData | null
): boolean {
  const status = panelState?.asset.status
  return status === 'queued' || status === 'downloading' || status === 'deleting'
}

async function refreshManagedLocalPanelStateSnapshot(input: {
  engineId: ManagedLocalTranslationEngineId
  modelId: string
  requestedSelectedGroupId?: string
  queryClient: ReturnType<typeof useQueryClient>
}): Promise<LocalPanelStateData> {
  const panelState = await queryManagedLocalPanelState({
    engineId: input.engineId,
    modelId: input.modelId,
    selectedGroupId: input.requestedSelectedGroupId,
  })
  cacheManagedLocalPanelState({
    engineId: input.engineId,
    panelState,
    queryClient: input.queryClient,
    requestedSelectedGroupId: input.requestedSelectedGroupId,
  })
  return panelState
}

async function refreshManagedLocalArtifactsSnapshot(input: {
  engineId: ManagedLocalTranslationEngineId
  modelId: string
  requestedSelectedGroupId?: string
  queryClient: ReturnType<typeof useQueryClient>
}): Promise<LocalPanelStateData> {
  const panelState = await refreshManagedLocalArtifacts(input.engineId, {
    modelId: input.modelId,
  })
  cacheManagedLocalPanelState({
    engineId: input.engineId,
    panelState,
    queryClient: input.queryClient,
    requestedSelectedGroupId: input.requestedSelectedGroupId,
  })
  return panelState
}

export function SettingsTranslationPanel({ index }: { index: number }) {
  const inStaticMode = isStaticMode()
  const { data: config, isLoading: configLoading } = useConfigSubscription()
  const { data: globalSettings } = useGlobalSettingsSubscription()
  const { data: engines, refetch: refetchEngines } = useQuery({
    ...trpc.translationEngines.list.queryOptions(),
    enabled: !inStaticMode,
  })
  const { data: translationCacheStats, refetch: refetchTranslationCacheStats } = useQuery({
    ...trpc.translationCache.stats.queryOptions(),
    enabled: !inStaticMode && (config?.translation?.cacheEnabled ?? false),
  })

  const [translationEnabled, setTranslationEnabled] = useState(false)
  const [translationTargetLanguage, setTranslationTargetLanguage] = useState(
    DEFAULT_TRANSLATION_TARGET_LANGUAGE
  )
  const [translationDisplayMode, setTranslationDisplayMode] =
    useState<DocumentTranslationDisplayMode>(DEFAULT_TRANSLATION_DISPLAY_MODE)
  const [translationEngineId, setTranslationEngineId] = useState<TranslationEngineId | null>(null)
  const [translationCacheEnabled, setTranslationCacheEnabled] = useState(
    DEFAULT_TRANSLATION_CACHE_ENABLED
  )
  const [translationCacheEntryLimit, setTranslationCacheEntryLimit] = useState(
    DEFAULT_TRANSLATION_CACHE_ENTRY_LIMIT
  )
  const [browserSupportTable, setBrowserSupportTable] =
    useState<BrowserTranslationSupportTableState | null>(null)
  const [browserSelectedPairKey, setBrowserSelectedPairKey] = useState<string | null>(null)
  const [browserPreparingSourceLanguage, setBrowserPreparingSourceLanguage] = useState<
    string | null
  >(null)
  const [aiBaseUrl, setAiBaseUrl] = useState('')
  const [aiToken, setAiToken] = useState('')
  const [aiModel, setAiModel] = useState('gpt-4.1-mini')
  const [nmtModel, setNmtModel] = useState(DEFAULT_LOCAL_MODEL_ID)
  const [nmtModelQuery, setNmtModelQuery] = useState(DEFAULT_LOCAL_MODEL_ID)
  const [nmtDebouncedQuery, setNmtDebouncedQuery] = useState(DEFAULT_LOCAL_MODEL_ID)
  const [nmtHfEndpoint, setNmtHfEndpoint] = useState('')
  const [nmtSelectedGroupId, setNmtSelectedGroupId] = useState<string | undefined>(undefined)
  const [nmtLocalOptions, setNmtLocalOptions] = useState<LocalModelCatalogItem[]>([])
  const [nmtRemoteOptions, setNmtRemoteOptions] = useState<LocalModelCatalogItem[]>([])
  const [nmtRemoteLoading, setNmtRemoteLoading] = useState(false)
  const [nmtSearchOpen, setNmtSearchOpen] = useState(false)
  const [nmtSearchTouched, setNmtSearchTouched] = useState(false)
  const [translationTestOpen, setTranslationTestOpen] = useState(false)
  const [smokeSourceLanguage, setSmokeSourceLanguage] = useState(
    DEFAULT_TRANSLATION_SMOKE_SOURCE_LANGUAGE
  )
  const [smokeSourceText, setSmokeSourceText] = useState('')
  const [smokeResult, setSmokeResult] = useState('')
  const [smokeError, setSmokeError] = useState<string | null>(null)
  const [smokeRunning, setSmokeRunning] = useState(false)
  const [engineLifecycle, setEngineLifecycle] = useState<TranslationEngineLifecycleStatus | null>(
    null
  )
  const [engineInstallLogs, setEngineInstallLogs] = useState('')
  const queryClient = useQueryClient()
  const queryClientRef = useRef(queryClient)
  const browserPrepareControllerRef = useRef<AbortController | null>(null)
  const engineInstallSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)
  const engineInstallLogRef = useRef<HTMLPreElement | null>(null)
  const nmtModelRef = useRef(nmtModel)
  const nmtSelectedGroupIdRef = useRef<string | undefined>(nmtSelectedGroupId)
  const lastLocalPanelStateRef = useRef<LocalPanelStateData | null>(null)
  const resolvedTranslationConfig = useMemo(
    () => resolveDocumentTranslationConfig(config?.translation, globalSettings),
    [config?.translation, globalSettings]
  )
  const activeTranslationEngineCandidate =
    translationEngineId ?? config?.translation?.engineId ?? null
  const activeManagedLocalEngineId = isManagedLocalTranslationEngineId(
    activeTranslationEngineCandidate
  )
    ? activeTranslationEngineCandidate
    : null

  useEffect(() => {
    queryClientRef.current = queryClient
  }, [queryClient])

  useEffect(() => {
    if (!config) return
    setTranslationEnabled(config?.translation?.enabled ?? false)
    setTranslationTargetLanguage(
      config?.translation?.targetLanguage ?? DEFAULT_TRANSLATION_TARGET_LANGUAGE
    )
    setTranslationDisplayMode(config?.translation?.displayMode ?? DEFAULT_TRANSLATION_DISPLAY_MODE)
    setTranslationEngineId(config?.translation?.engineId ?? 'browser')
    setTranslationCacheEnabled(
      config?.translation?.cacheEnabled ?? DEFAULT_TRANSLATION_CACHE_ENABLED
    )
  }, [
    config?.translation?.cacheEnabled,
    config?.translation?.displayMode,
    config?.translation?.enabled,
    config?.translation?.engineId,
    config?.translation?.targetLanguage,
  ])

  useEffect(() => {
    setTranslationCacheEntryLimit(
      globalSettings?.translationCache?.entryLimit ?? DEFAULT_TRANSLATION_CACHE_ENTRY_LIMIT
    )
    setAiBaseUrl(globalSettings?.translationEngines?.openai?.baseUrl ?? '')
    setAiToken(globalSettings?.translationEngines?.openai?.token ?? '')
    setAiModel(globalSettings?.translationEngines?.openai?.model ?? 'gpt-4.1-mini')
    if (!activeManagedLocalEngineId) return
    const managedLocalEngine = getManagedLocalEngineSettings({
      engineId: activeManagedLocalEngineId,
      resolvedTranslationConfig,
      globalSettings,
    })
    setNmtModel(managedLocalEngine.model)
    setNmtModelQuery(managedLocalEngine.model)
    setNmtDebouncedQuery(managedLocalEngine.model)
    setNmtHfEndpoint(managedLocalEngine.hfEndpoint)
    setNmtSelectedGroupId(managedLocalEngine.selectedGroupId)
  }, [
    activeManagedLocalEngineId,
    config?.translation?.engines?.local?.model,
    config?.translation?.engines?.local?.selectedGroupId,
    config?.translation?.engines?.localCt2?.model,
    config?.translation?.engines?.localCt2?.selectedGroupId,
    globalSettings?.translationCache?.entryLimit,
    globalSettings?.translationEngines?.openai?.baseUrl,
    globalSettings?.translationEngines?.openai?.model,
    globalSettings?.translationEngines?.openai?.token,
    globalSettings?.translationEngines?.local?.hfEndpoint,
    globalSettings?.translationEngines?.local?.model,
    globalSettings?.translationEngines?.local?.selectedGroupId,
    globalSettings?.translationEngines?.localCt2?.hfEndpoint,
    globalSettings?.translationEngines?.localCt2?.model,
    globalSettings?.translationEngines?.localCt2?.selectedGroupId,
    resolvedTranslationConfig?.engines?.local?.model,
    resolvedTranslationConfig?.engines?.local?.selectedGroupId,
    resolvedTranslationConfig?.engines?.localCt2?.model,
    resolvedTranslationConfig?.engines?.localCt2?.selectedGroupId,
  ])

  useEffect(() => {
    nmtModelRef.current = nmtModel
  }, [nmtModel])

  useEffect(() => {
    nmtSelectedGroupIdRef.current = nmtSelectedGroupId
  }, [nmtSelectedGroupId])

  useEffect(() => {
    if (!activeManagedLocalEngineId) return
    const timer = window.setTimeout(() => {
      setNmtDebouncedQuery(nmtModelQuery.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [activeManagedLocalEngineId, nmtModelQuery])

  useEffect(() => {
    if (!activeManagedLocalEngineId) return
    let cancelled = false
    void listManagedLocalCatalog(activeManagedLocalEngineId)
      .then((local) => {
        if (cancelled) return
        setNmtLocalOptions(local.items)
      })
      .catch(() => {
        if (cancelled) return
        setNmtLocalOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [activeManagedLocalEngineId])

  useEffect(() => {
    if (!activeManagedLocalEngineId) return
    const requestId = `local-search-${Date.now()}-${Math.random().toString(36).slice(2)}`
    if (!nmtSearchOpen || !nmtSearchTouched) {
      setNmtRemoteLoading(false)
      return
    }
    setNmtRemoteLoading(true)
    const subscription = subscribeManagedLocalRemoteCatalog(
      activeManagedLocalEngineId,
      {
        requestId,
        targetLanguage: translationTargetLanguage,
        query: nmtDebouncedQuery || undefined,
        limit: 6,
      },
      {
        onData: (event) => {
          if (event.requestId !== requestId) return
          if (event.items) setNmtRemoteOptions(event.items)
          if (event.phase === 'complete' || event.phase === 'error') {
            setNmtRemoteLoading(false)
          }
        },
        onError: () => {
          setNmtRemoteLoading(false)
          setNmtRemoteOptions([])
        },
      }
    )
    return () => {
      subscription.unsubscribe()
    }
  }, [
    activeManagedLocalEngineId,
    nmtDebouncedQuery,
    nmtHfEndpoint,
    nmtSearchOpen,
    nmtSearchTouched,
    translationTargetLanguage,
  ])

  useEffect(() => {
    if (inStaticMode || !activeManagedLocalEngineId) return
    const nmtSubscription = subscribeManagedLocalLogs(activeManagedLocalEngineId, {
      onData: (log) => {
        const activeSelectedGroupId = nmtSelectedGroupIdRef.current
        const activeModelId = nmtModelRef.current.trim()
        const requestedSelectedGroupId =
          log.modelId === activeModelId ? activeSelectedGroupId : log.selectedGroupId
        void queryManagedLocalPanelState({
          engineId: activeManagedLocalEngineId,
          modelId: log.modelId,
          selectedGroupId: requestedSelectedGroupId,
        })
          .then((panelState) => {
            cacheManagedLocalPanelState({
              engineId: activeManagedLocalEngineId,
              panelState,
              queryClient: queryClientRef.current,
              requestedSelectedGroupId,
            })
            if (log.modelId === activeModelId) {
              lastLocalPanelStateRef.current = panelState
              setNmtSelectedGroupId(panelState.selectedGroupId)
            }
          })
          .catch(() => undefined)

        void listManagedLocalCatalog(activeManagedLocalEngineId)
          .then((local) => setNmtLocalOptions(local.items))
          .catch(() => undefined)
      },
      onError: () => undefined,
    })
    return () => {
      nmtSubscription.unsubscribe()
    }
  }, [activeManagedLocalEngineId, inStaticMode])

  useEffect(() => {
    if (!activeManagedLocalEngineId) {
      setNmtLocalOptions([])
      setNmtRemoteOptions([])
      setNmtRemoteLoading(false)
    }
  }, [activeManagedLocalEngineId])

  const saveTranslationConfigMutation = useMutation({
    mutationFn: (translation: DocumentTranslationConfigUpdate) =>
      trpcClient.config.update.mutate({ translation }),
    onSuccess: async () => {
      await refetchEngines()
    },
  })
  const saveGlobalSettingsMutation = useMutation({
    mutationFn: (input: Parameters<typeof trpcClient.globalSettings.update.mutate>[0]) =>
      trpcClient.globalSettings.update.mutate(input),
    onSuccess: async () => {
      await refetchEngines()
    },
  })
  const downloadLocalModelMutation = useMutation({
    mutationFn: (input: { modelId: string; groupId?: string }) => {
      if (!activeManagedLocalEngineId) {
        throw new Error('A managed local translation engine is required.')
      }
      return activeManagedLocalEngineId === 'local'
        ? trpcClient.localModels.download.mutate(input)
        : trpcClient.localCt2Models.download.mutate(input)
    },
    onSuccess: async (_result, input) => {
      if (!activeManagedLocalEngineId) return
      const panelState = await refreshManagedLocalPanelStateSnapshot({
        engineId: activeManagedLocalEngineId,
        modelId: input.modelId,
        requestedSelectedGroupId: input.groupId,
        queryClient,
      })
      lastLocalPanelStateRef.current = panelState
      setNmtSelectedGroupId(panelState.selectedGroupId)
    },
  })
  const pauseLocalModelMutation = useMutation({
    mutationFn: (input: { modelId: string; groupId?: string }) => {
      if (!activeManagedLocalEngineId) {
        throw new Error('A managed local translation engine is required.')
      }
      return activeManagedLocalEngineId === 'local'
        ? trpcClient.localModels.pause.mutate(input)
        : trpcClient.localCt2Models.pause.mutate(input)
    },
    onSuccess: async (_result, input) => {
      if (!activeManagedLocalEngineId) return
      const panelState = await refreshManagedLocalPanelStateSnapshot({
        engineId: activeManagedLocalEngineId,
        modelId: input.modelId,
        requestedSelectedGroupId: input.groupId,
        queryClient,
      })
      lastLocalPanelStateRef.current = panelState
      setNmtSelectedGroupId(panelState.selectedGroupId)
    },
  })
  const resumeLocalModelMutation = useMutation({
    mutationFn: (input: { modelId: string; groupId?: string }) => {
      if (!activeManagedLocalEngineId) {
        throw new Error('A managed local translation engine is required.')
      }
      return activeManagedLocalEngineId === 'local'
        ? trpcClient.localModels.resume.mutate(input)
        : trpcClient.localCt2Models.resume.mutate(input)
    },
    onSuccess: async (_result, input) => {
      if (!activeManagedLocalEngineId) return
      const panelState = await refreshManagedLocalPanelStateSnapshot({
        engineId: activeManagedLocalEngineId,
        modelId: input.modelId,
        requestedSelectedGroupId: input.groupId,
        queryClient,
      })
      lastLocalPanelStateRef.current = panelState
      setNmtSelectedGroupId(panelState.selectedGroupId)
    },
  })
  const deleteLocalModelMutation = useMutation({
    mutationFn: (input: { modelId: string; groupId?: string }) => {
      if (!activeManagedLocalEngineId) {
        throw new Error('A managed local translation engine is required.')
      }
      return activeManagedLocalEngineId === 'local'
        ? trpcClient.localModels.delete.mutate(input)
        : trpcClient.localCt2Models.delete.mutate(input)
    },
    onSuccess: async (_result, input) => {
      if (!activeManagedLocalEngineId) return
      const panelState = await refreshManagedLocalPanelStateSnapshot({
        engineId: activeManagedLocalEngineId,
        modelId: input.modelId,
        requestedSelectedGroupId: input.groupId,
        queryClient,
      })
      lastLocalPanelStateRef.current = panelState
      setNmtSelectedGroupId(panelState.selectedGroupId)
    },
  })
  const refreshLocalProfilesMutation = useMutation({
    mutationFn: (input: { modelId?: string }) => {
      if (!activeManagedLocalEngineId) {
        throw new Error('A managed local translation engine is required.')
      }
      return refreshManagedLocalArtifacts(activeManagedLocalEngineId, input)
    },
    onSuccess: (panelState, input) => {
      if (!activeManagedLocalEngineId) return
      cacheManagedLocalPanelState({
        engineId: activeManagedLocalEngineId,
        panelState,
        queryClient,
        requestedSelectedGroupId: input.modelId ? nmtSelectedGroupIdRef.current : undefined,
      })
      lastLocalPanelStateRef.current = panelState
    },
  })
  const cleanTranslationCacheMutation = useMutation({
    mutationFn: () => trpcClient.translationCache.clean.mutate(),
  })
  const clearTranslationCacheMutation = useMutation({
    mutationFn: () => trpcClient.translationCache.clear.mutate(),
  })
  const installTranslationEngineMutation = useMutation({
    mutationFn: async (engineId: TranslationEngineId) => {
      engineInstallSubscriptionRef.current?.unsubscribe()
      setEngineInstallLogs('')
      const result = await new Promise<TranslationEngineLifecycleStatus>((resolve, reject) => {
        const subscription = trpcClient.translationEngines.installStream.subscribe(
          { engineId },
          {
            onData: (event) => {
              if (event.type === 'status') {
                setEngineLifecycle(event.lifecycle)
                return
              }
              if (event.type === 'log') {
                setEngineInstallLogs((current) => `${current}${event.text}`)
                return
              }
              setEngineLifecycle(event.lifecycle)
              if (!shouldShowTranslationEngineInstallGate(event.lifecycle)) {
                resolve(event.lifecycle)
                return
              }
              reject(
                new Error(
                  getTranslationEngineLifecycleMessage(event.lifecycle) ?? 'Install failed.'
                )
              )
            },
            onError: (error) => {
              reject(error instanceof Error ? error : new Error(String(error)))
            },
          }
        )
        engineInstallSubscriptionRef.current = subscription
      })
      return result
    },
    onSuccess: async (lifecycle, engineId) => {
      setEngineLifecycle(lifecycle)
      queryClientRef.current.setQueryData(
        trpc.translationEngines.list.queryOptions().queryKey,
        (current) =>
          replaceTranslationEngineLifecycleInQueryData(current, {
            engineId,
            lifecycle,
          })
      )
      if (isManagedLocalTranslationEngineId(engineId)) {
        const modelId = nmtModelRef.current.trim()
        if (modelId) {
          try {
            const panelState = await refreshManagedLocalArtifactsSnapshot({
              engineId,
              modelId,
              requestedSelectedGroupId: nmtSelectedGroupIdRef.current,
              queryClient,
            })
            if (activeManagedLocalEngineId === engineId) {
              lastLocalPanelStateRef.current = panelState
              setNmtSelectedGroupId(panelState.selectedGroupId)
            }
          } catch {
            // Let the standard panel query surface any runtime/model errors after handoff.
          }
        }
      }
      await refetchEngines()
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error)
      setEngineLifecycle(
        createTranslationEngineLifecycleStatus({
          dependency: {
            state: 'error',
            message: 'Translation engine installation failed.',
            error: message,
          },
          runtime: {
            state: 'error',
            error: message,
          },
          summary: 'Translation engine installation failed.',
        })
      )
    },
  })

  const engineConfigReady = inStaticMode || config !== undefined
  const effectiveTranslationEngineId = engineConfigReady
    ? (translationEngineId ?? config?.translation?.engineId ?? 'browser')
    : null
  const effectiveManagedLocalEngineId = isManagedLocalTranslationEngineId(
    effectiveTranslationEngineId
  )
    ? effectiveTranslationEngineId
    : null
  const persistedTranslationEngineId = config ? (config.translation?.engineId ?? 'browser') : null
  const preferredSmokeSourceLanguage = useMemo(
    () =>
      getPreferredSmokeSourceLanguage({
        engineId: effectiveTranslationEngineId,
        model: nmtModel,
        targetLanguage: translationTargetLanguage,
      }),
    [effectiveTranslationEngineId, nmtModel, translationTargetLanguage]
  )

  useEffect(() => {
    setSmokeSourceLanguage(preferredSmokeSourceLanguage)
  }, [preferredSmokeSourceLanguage])

  const refreshBrowserSupportTable = useCallback(
    async (targetLanguage: string) => {
      if (inStaticMode) return
      const controller = new AbortController()
      try {
        const state = await scanBrowserTranslationPairs(targetLanguage, {
          signal: controller.signal,
          onProgress: (nextState) => {
            setBrowserSupportTable(nextState)
          },
        })
        setBrowserSupportTable(state)
        const selectedRows = getBrowserSupportRows(state)
        setBrowserSelectedPairKey((current) => {
          if (current && selectedRows.some((row) => getBrowserPairKey(row) === current)) {
            return current
          }
          return selectedRows[0] ? getBrowserPairKey(selectedRows[0]) : null
        })
      } finally {
        controller.abort()
      }
    },
    [inStaticMode]
  )

  useEffect(() => {
    if (inStaticMode || persistedTranslationEngineId !== 'browser') return
    if (effectiveTranslationEngineId !== 'browser') return
    const cached = getBrowserSupportTableState(translationTargetLanguage)
    if (cached) {
      setBrowserSupportTable(cached)
      const cachedRows = getBrowserSupportRows(cached)
      setBrowserSelectedPairKey((current) => {
        if (current && cachedRows.some((row) => getBrowserPairKey(row) === current)) {
          return current
        }
        return cachedRows[0] ? getBrowserPairKey(cachedRows[0]) : null
      })
      return
    }
    void refreshBrowserSupportTable(translationTargetLanguage)
  }, [
    inStaticMode,
    persistedTranslationEngineId,
    effectiveTranslationEngineId,
    refreshBrowserSupportTable,
    translationTargetLanguage,
  ])

  useEffect(() => {
    if (effectiveTranslationEngineId === 'browser') return
    browserPrepareControllerRef.current?.abort()
    browserPrepareControllerRef.current = null
    setBrowserPreparingSourceLanguage(null)
  }, [effectiveTranslationEngineId])

  const engineOptions = useMemo<SelectOption<TranslationEngineId>[]>(
    () =>
      TRANSLATION_ENGINE_IDS.map((engineId) => {
        const engine = engines?.find((item) => item.id === engineId)
        const manifest = getTranslationEngineManifest(engineId)
        return {
          value: engineId,
          label: engine?.label ?? manifest.label,
          disabled: inStaticMode && engineId !== 'browser',
        }
      }),
    [engines, inStaticMode]
  )
  const selectedEngine = engines?.find((engine) => engine.id === effectiveTranslationEngineId)
  const selectedEngineLifecycle = selectedEngine?.lifecycle ?? null
  const selectedEngineManifest = effectiveTranslationEngineId
    ? getTranslationEngineManifest(effectiveTranslationEngineId)
    : null
  const selectedManagedLocalManifest = effectiveManagedLocalEngineId
    ? getManagedLocalTranslationEngineManifest(effectiveManagedLocalEngineId)
    : null
  const browserRows = useMemo(
    () => getBrowserSupportRows(browserSupportTable),
    [browserSupportTable]
  )
  const selectedBrowserRow = useMemo(
    () =>
      browserRows.find((row) => getBrowserPairKey(row) === browserSelectedPairKey) ??
      browserRows[0] ??
      null,
    [browserRows, browserSelectedPairKey]
  )
  const browserStatusIconState = getBrowserStatusIconState(browserSupportTable)
  const browserSupportMessage = getBrowserSupportMessage(browserSupportTable)
  const resolvedLifecycle =
    engineLifecycle && effectiveTranslationEngineId === selectedEngine?.id
      ? engineLifecycle
      : selectedEngineLifecycle
  const engineStatusMessage =
    effectiveTranslationEngineId === 'browser'
      ? getBrowserCapabilityMessage(browserSupportTable)
      : (getTranslationEngineLifecycleMessage(resolvedLifecycle) ??
        selectedEngine?.message ??
        selectedEngine?.description ??
        selectedEngineManifest?.description)
  const browserRowActionKind = getBrowserRowActionKind({
    row: selectedBrowserRow,
    activeSourceLanguage: browserPreparingSourceLanguage,
  })
  const browserProgressPercent =
    selectedBrowserRow?.availability === 'available'
      ? 100
      : Math.round((selectedBrowserRow?.progress ?? 0) * 100)
  const browserCheckLoading = browserSupportTable?.state === 'checking'
  const resolvedManagedLocalSettings = effectiveManagedLocalEngineId
    ? getManagedLocalEngineSettings({
        engineId: effectiveManagedLocalEngineId,
        resolvedTranslationConfig,
        globalSettings,
      })
    : null
  const managedLocalModelLabel = selectedManagedLocalManifest?.modelLabel ?? 'Local model'
  const managedLocalDownloadGroupsLabel =
    selectedManagedLocalManifest?.downloadGroupsLabel ?? 'Local download profiles'
  const managedLocalRefreshTooltip =
    selectedManagedLocalManifest?.refreshTooltip ?? 'Refresh local model profiles'
  const nmtModelId = nmtModel.trim()
  const persistedLocalSelectedGroupId = resolvedManagedLocalSettings?.selectedGroupId
  const preferredLocalSelectedGroupId = nmtSelectedGroupId ?? persistedLocalSelectedGroupId
  const localPanelStateQuery = useQuery({
    queryKey:
      effectiveManagedLocalEngineId && nmtModelId.length > 0
        ? getManagedLocalPanelStateQueryKey({
            engineId: effectiveManagedLocalEngineId,
            modelId: nmtModelId,
            selectedGroupId: preferredLocalSelectedGroupId,
          })
        : ['translation', 'managed-local', 'idle'],
    queryFn: () => {
      if (!effectiveManagedLocalEngineId) {
        throw new Error('A managed local translation engine is required.')
      }
      return queryManagedLocalPanelState({
        engineId: effectiveManagedLocalEngineId,
        modelId: nmtModelId,
        selectedGroupId: preferredLocalSelectedGroupId,
      })
    },
    enabled: effectiveManagedLocalEngineId !== null && nmtModelId.length > 0,
  })
  const queriedLocalPanelState =
    localPanelStateQuery.data?.modelId === nmtModelId ? localPanelStateQuery.data : null
  useEffect(() => {
    if (queriedLocalPanelState) {
      lastLocalPanelStateRef.current = queriedLocalPanelState
      return
    }
    if (!effectiveManagedLocalEngineId || nmtModelId.length === 0) {
      lastLocalPanelStateRef.current = null
    }
  }, [effectiveManagedLocalEngineId, nmtModelId, queriedLocalPanelState])
  const cachedLocalPanelState =
    lastLocalPanelStateRef.current?.modelId === nmtModelId ? lastLocalPanelStateRef.current : null
  const localPanelState = queriedLocalPanelState ?? cachedLocalPanelState
  const localPanelError =
    localPanelStateQuery.error instanceof Error ? localPanelStateQuery.error.message : null
  const nmtCatalogOptions = useMemo(() => {
    return mergeLocalCatalogItems(nmtLocalOptions, nmtRemoteOptions)
  }, [nmtLocalOptions, nmtRemoteOptions])
  const selectedLocalAsset = localPanelState?.asset ?? null
  const serverLocalDownloadPlan = localPanelState?.downloadPlan ?? selectedLocalAsset?.plan ?? null
  const resolvedLocalDownloadPlan = serverLocalDownloadPlan
  const nmtDownloadGroups = resolvedLocalDownloadPlan?.groups ?? []
  const selectedLocalGroup = nmtDownloadGroups.find((group) => group.selected) ?? null
  const effectiveLocalSelectedGroupId =
    selectedLocalGroup?.id ??
    localPanelState?.selectedGroupId ??
    selectedLocalAsset?.plan?.selectedGroupId ??
    preferredLocalSelectedGroupId
  const nmtKnownSize =
    (selectedLocalGroup?.estimatedTotalBytes ??
      resolvedLocalDownloadPlan?.estimatedTotalBytes ??
      0) > 0
  const displayedLocalAsset = selectedLocalAsset
  const nmtProgressPercent =
    displayedLocalAsset?.progress === undefined
      ? undefined
      : Math.round(displayedLocalAsset.progress * 100)
  const nmtGroupSelectionDisabled = displayedLocalAsset?.status === 'deleting'
  const nmtResolvedHfEndpoint = nmtHfEndpoint.trim() || 'https://huggingface.co'
  const localPlanLoading =
    (localPanelStateQuery.isLoading || localPanelStateQuery.isFetching) && !selectedLocalAsset
  useEffect(() => {
    if (!activeManagedLocalEngineId || !nmtModelId || inStaticMode) return
    if (!shouldPollManagedLocalPanelState(localPanelState)) return
    const timer = window.setTimeout(() => {
      void localPanelStateQuery.refetch()
    }, 750)
    return () => window.clearTimeout(timer)
  }, [
    activeManagedLocalEngineId,
    inStaticMode,
    localPanelState,
    localPanelStateQuery,
    nmtModelId,
  ])
  const shouldShowInstallFlow =
    effectiveTranslationEngineId !== null && shouldShowTranslationEngineInstallGate(resolvedLifecycle)
  const startBrowserPairPreparation = useCallback(
    async (row: BrowserTranslationAvailabilityRow) => {
      browserPrepareControllerRef.current?.abort()
      const controller = new AbortController()
      browserPrepareControllerRef.current = controller
      setBrowserPreparingSourceLanguage(row.sourceLanguage)
      setBrowserSupportTable(
        patchBrowserSupportTableRow(
          row.targetLanguage,
          {
            ...row,
            availability: 'downloading',
            progress: row.progress ?? 0,
            message: 'Downloading browser translation support.',
          },
          {
            state: 'ready',
          }
        )
      )
      try {
        const status = await prepareBrowserTranslation(row.targetLanguage, {
          sourceLanguage: row.sourceLanguage,
          signal: controller.signal,
          onStatus: (nextStatus) => {
            setBrowserSupportTable(
              patchBrowserSupportTableRow(
                row.targetLanguage,
                {
                  sourceLanguage: row.sourceLanguage,
                  targetLanguage: row.targetLanguage,
                  availability: nextStatus.availability,
                  progress: nextStatus.progress,
                  message: nextStatus.message,
                },
                {
                  state: nextStatus.availability === 'error' ? 'error' : 'ready',
                }
              )
            )
          },
        })
        setBrowserSupportTable(
          patchBrowserSupportTableRow(
            row.targetLanguage,
            {
              sourceLanguage: row.sourceLanguage,
              targetLanguage: row.targetLanguage,
              availability: status.availability,
              progress: status.progress,
              message: status.message,
            },
            {
              state: status.availability === 'error' ? 'error' : 'ready',
            }
          )
        )
      } finally {
        if (browserPrepareControllerRef.current === controller) {
          browserPrepareControllerRef.current = null
        }
        setBrowserPreparingSourceLanguage((current) =>
          current === row.sourceLanguage ? null : current
        )
      }
    },
    []
  )
  const cancelBrowserPairPreparation = useCallback(() => {
    browserPrepareControllerRef.current?.abort()
    browserPrepareControllerRef.current = null
    setBrowserPreparingSourceLanguage(null)
  }, [])
  const runSmokeTest = useCallback(async () => {
    if (!effectiveTranslationEngineId) return
    const sourceText = smokeSourceText.trim() || getTranslationTestPlaceholder(smokeSourceLanguage)

    const sourceLanguage = smokeSourceLanguage.trim() || DEFAULT_TRANSLATION_SMOKE_SOURCE_LANGUAGE
    const targetLanguage = translationTargetLanguage.trim() || DEFAULT_TRANSLATION_TARGET_LANGUAGE

    setSmokeRunning(true)
    setSmokeError(null)
    setSmokeResult('')
    try {
      const smokeModel = isManagedLocalTranslationEngineId(effectiveTranslationEngineId)
        ? nmtModel.trim() || undefined
        : effectiveTranslationEngineId === 'openai'
          ? aiModel.trim() || undefined
          : undefined
      const result = await runSingleTranslation({
        engineId: effectiveTranslationEngineId,
        sourceLanguage,
        targetLanguage,
        model: smokeModel,
        selectedGroupId: isManagedLocalTranslationEngineId(effectiveTranslationEngineId)
          ? effectiveLocalSelectedGroupId
          : undefined,
        text: sourceText,
      })
      setSmokeResult(result)
    } catch (error) {
      setSmokeError(error instanceof Error ? error.message : 'Translation test failed.')
    } finally {
      setSmokeRunning(false)
    }
  }, [
    aiModel,
    effectiveLocalSelectedGroupId,
    nmtModel,
    smokeSourceLanguage,
    smokeSourceText,
    effectiveTranslationEngineId,
    translationTargetLanguage,
  ])
  const savedTranslationConfig = {
    enabled: config?.translation?.enabled ?? false,
    targetLanguage: config?.translation?.targetLanguage ?? DEFAULT_TRANSLATION_TARGET_LANGUAGE,
    displayMode: config?.translation?.displayMode ?? DEFAULT_TRANSLATION_DISPLAY_MODE,
    cacheEnabled: config?.translation?.cacheEnabled ?? DEFAULT_TRANSLATION_CACHE_ENABLED,
    engineId: config?.translation?.engineId ?? 'browser',
  }
  const savedTranslationCacheEntryLimit =
    globalSettings?.translationCache?.entryLimit ?? DEFAULT_TRANSLATION_CACHE_ENTRY_LIMIT
  const isSaving =
    savedTranslationConfig.enabled !== translationEnabled ||
    savedTranslationConfig.targetLanguage !== translationTargetLanguage ||
    savedTranslationConfig.displayMode !== translationDisplayMode ||
    savedTranslationConfig.cacheEnabled !== translationCacheEnabled ||
    savedTranslationConfig.engineId !== effectiveTranslationEngineId ||
    savedTranslationCacheEntryLimit !== translationCacheEntryLimit

  useEffect(() => {
    if (!effectiveTranslationEngineId || effectiveTranslationEngineId === 'browser') {
      setEngineLifecycle(null)
      setEngineInstallLogs('')
      engineInstallSubscriptionRef.current?.unsubscribe()
      engineInstallSubscriptionRef.current = null
      return
    }
    setEngineLifecycle(selectedEngineLifecycle)
    setEngineInstallLogs('')
  }, [effectiveTranslationEngineId])

  useEffect(() => {
    if (!effectiveTranslationEngineId || effectiveTranslationEngineId === 'browser') return
    setEngineLifecycle((current) => {
      if (current?.dependency.state === 'installing' && shouldShowTranslationEngineInstallGate(selectedEngineLifecycle)) {
        return current
      }
      return selectedEngineLifecycle
    })
  }, [
    effectiveTranslationEngineId,
    selectedEngineLifecycle,
  ])

  useEffect(() => {
    if (!engineInstallLogs) return
    const element = engineInstallLogRef.current
    if (!element) return
    element.scrollTop = element.scrollHeight
  }, [engineInstallLogs])

  useEffect(() => {
    return () => {
      engineInstallSubscriptionRef.current?.unsubscribe()
    }
  }, [])

  return (
    <TocSection id="settings-translation" index={index} className="space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Languages className="h-5 w-5" />
        Translation
      </h2>
      <div className="border-border @container space-y-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <label className="block text-sm font-medium">Enable document translation</label>
            <p className="text-muted-foreground mt-1 text-sm">
              Select a translator engine for Markdown document views.
            </p>
          </div>
          <Switch
            checked={translationEnabled}
            onCheckedChange={(checked) => {
              setTranslationEnabled(checked)
              saveTranslationConfigMutation.mutate({ enabled: checked })
              if (checked && effectiveTranslationEngineId === 'browser') {
                void refreshBrowserSupportTable(translationTargetLanguage)
              }
            }}
            ariaLabel="Enable document translation"
            disabled={saveTranslationConfigMutation.isPending || inStaticMode}
          />
        </div>

        <div className="@[42rem]:grid-cols-2 grid gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Target Language</label>
            <TranslationLanguageCombobox
              value={translationTargetLanguage}
              onChange={(targetLanguage) => {
                setTranslationTargetLanguage(targetLanguage)
                saveTranslationConfigMutation.mutate({ targetLanguage })
                if (effectiveTranslationEngineId === 'browser') {
                  setBrowserSupportTable(null)
                  setBrowserSelectedPairKey(null)
                  void refreshBrowserSupportTable(targetLanguage)
                }
              }}
              disabled={saveTranslationConfigMutation.isPending || inStaticMode}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Display Mode</label>
            <ButtonGroup<DocumentTranslationDisplayMode>
              value={translationDisplayMode}
              onChange={(displayMode) => {
                setTranslationDisplayMode(displayMode)
                saveTranslationConfigMutation.mutate({ displayMode })
              }}
              options={TRANSLATION_DISPLAY_MODE_OPTIONS}
            />
          </div>
        </div>

        <div className="border-border/60 space-y-3 border-t pt-3">
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Engine</label>
              <div className="@[42rem]:grid-cols-[minmax(15rem,17rem)_minmax(0,1fr)_auto] grid gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {effectiveTranslationEngineId ? (
                    <Select<TranslationEngineId>
                      value={effectiveTranslationEngineId}
                      onValueChange={(engineId) => {
                        setTranslationEngineId(engineId)
                        saveTranslationConfigMutation.mutate({ engineId })
                        if (engineId === 'browser' && !inStaticMode) {
                          const cached = getBrowserSupportTableState(translationTargetLanguage)
                          if (cached) {
                            setBrowserSupportTable(cached)
                            const cachedRows = getBrowserSupportRows(cached)
                            setBrowserSelectedPairKey(
                              cachedRows[0] ? getBrowserPairKey(cachedRows[0]) : null
                            )
                          } else {
                            void refreshBrowserSupportTable(translationTargetLanguage)
                          }
                        }
                      }}
                      options={engineOptions}
                      ariaLabel="Engine"
                      className="min-w-[12rem]"
                      disabled={saveTranslationConfigMutation.isPending || inStaticMode}
                    />
                  ) : (
                    <button
                      type="button"
                      aria-label="Engine"
                      className="border-border bg-background text-muted-foreground inline-flex h-9 min-w-[12rem] items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                      disabled
                    >
                      <span>{configLoading ? 'Loading engine...' : 'Select engine'}</span>
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    </button>
                  )}
                  <Tooltip content="Open translation test" delay={0}>
                    <Button
                      variant="primary"
                      size="icon-md"
                      aria-label="Open translation test"
                      onClick={() => setTranslationTestOpen(true)}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <FlaskConical className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                </div>
                <div className="min-w-0 space-y-1.5 text-sm">
                  {selectedEngine?.technicalSummary ? (
                    <div className="text-muted-foreground whitespace-normal text-xs leading-5 [overflow-wrap:anywhere]">
                      {selectedEngine.technicalSummary}
                    </div>
                  ) : null}
                  <div className="text-muted-foreground flex min-w-0 items-center gap-2 leading-5">
                    {effectiveTranslationEngineId === 'browser' ? (
                      browserStatusIconState === 'checking' ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      ) : browserStatusIconState === 'available' ? (
                        <Tooltip content="Installed" delay={0}>
                          <button
                            type="button"
                            aria-label="Installed"
                            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-emerald-500"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        </Tooltip>
                      ) : browserStatusIconState === 'downloadable' ? (
                        <Download className="h-4 w-4 shrink-0 text-sky-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                      )
                    ) : !shouldShowTranslationEngineInstallGate(resolvedLifecycle) ? (
                      <Tooltip content="Installed" delay={0}>
                        <button
                          type="button"
                          aria-label="Installed"
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-emerald-500"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    ) : resolvedLifecycle?.dependency.state === 'installing' ||
                      resolvedLifecycle?.runtime.state === 'probing' ? (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="primary"
                        aria-label="Installing translation engine"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 w-7 shrink-0 rounded-full"
                        disabled
                      >
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="primary"
                        aria-label="Install translation engine"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 w-7 shrink-0 rounded-full"
                        onClick={() => {
                          if (!effectiveTranslationEngineId) return
                          const label =
                            selectedEngine?.label ??
                            selectedEngineManifest?.label ??
                            effectiveTranslationEngineId
                          setEngineLifecycle(
                            createTranslationEngineLifecycleStatus({
                              dependency: {
                                state: 'installing',
                                message: `Installing ${label}.`,
                              },
                              summary: `Installing ${label}.`,
                            })
                          )
                          installTranslationEngineMutation.mutate(effectiveTranslationEngineId)
                        }}
                        disabled={
                          !effectiveTranslationEngineId ||
                          installTranslationEngineMutation.isPending
                        }
                      >
                        {installTranslationEngineMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                    <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                      {resolvedLifecycle?.dependency.state === 'installing' && engineInstallLogs ? (
                        <pre
                          ref={engineInstallLogRef}
                          className="bg-muted/40 border-border scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[color-mix(in_srgb,currentColor,transparent_78%)] max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border px-3 py-2 font-mono text-[11px] leading-5"
                        >
                          <code>{engineInstallLogs}</code>
                        </pre>
                      ) : (
                        engineStatusMessage
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {shouldShowInstallFlow ? null : effectiveTranslationEngineId === 'openai' ? (
          <div className="border-border/60 @[56rem]:grid-cols-3 grid gap-3 border-t pt-3">
            <label className="block text-sm font-medium">
              API Base URL
              <input
                value={aiBaseUrl}
                onChange={(event) => setAiBaseUrl(event.currentTarget.value)}
                onBlur={() =>
                  saveGlobalSettingsMutation.mutate({
                    translationEngines: { openai: { baseUrl: aiBaseUrl.trim() } },
                  })
                }
                className="border-input bg-background mt-2 h-9 w-full rounded-md border px-3 text-sm"
                placeholder="https://api.openai.com/v1"
              />
            </label>
            <label className="block text-sm font-medium">
              Token
              <input
                value={aiToken}
                type="password"
                onChange={(event) => setAiToken(event.currentTarget.value)}
                onBlur={() =>
                  saveGlobalSettingsMutation.mutate({
                    translationEngines: { openai: { token: aiToken } },
                  })
                }
                className="border-input bg-background mt-2 h-9 w-full rounded-md border px-3 text-sm"
                placeholder="sk-..."
              />
            </label>
            <label className="block text-sm font-medium">
              Model
              <input
                value={aiModel}
                onChange={(event) => setAiModel(event.currentTarget.value)}
                onBlur={() => {
                  const model = aiModel.trim()
                  saveGlobalSettingsMutation.mutate({
                    translationEngines: { openai: { model } },
                  })
                  saveTranslationConfigMutation.mutate({ engines: { openai: { model } } })
                }}
                className="border-input bg-background mt-2 h-9 w-full rounded-md border px-3 text-sm"
              />
            </label>
          </div>
        ) : null}
        {shouldShowInstallFlow ? null : effectiveTranslationEngineId === 'browser' ? (
          <div className="border-border/60 border-t pt-3">
            <div className="space-y-3 text-xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <label className="block text-sm font-medium">Browser language pairs</label>
                    <div className="text-muted-foreground flex min-w-0 items-center gap-2 text-[11px] leading-5">
                      {browserSupportTable?.state === 'checking' ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      ) : null}
                      <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                        {browserSupportMessage}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void refreshBrowserSupportTable(translationTargetLanguage)}
                    disabled={browserCheckLoading}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Check
                  </Button>
                </div>
                {browserRows.length > 0 ? (
                  <div
                    className="flex flex-wrap gap-1.5 pt-1"
                    aria-label="Browser translation language pairs"
                  >
                    {browserRows.map((row) => {
                      const selected =
                        getBrowserPairKey(row) === getBrowserPairKey(selectedBrowserRow ?? row)
                      return (
                        <button
                          key={getBrowserPairKey(row)}
                          type="button"
                          onClick={() => setBrowserSelectedPairKey(getBrowserPairKey(row))}
                          className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] leading-none transition-colors ${getDownloadStateChipClasses(
                            {
                              tone: getBrowserAvailabilityChipTone(row.availability),
                              selected,
                            }
                          )}`}
                          title={getBrowserPairDescription(row)}
                        >
                          <span className="font-medium">{getBrowserPairLabel(row)}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
              {selectedBrowserRow ? (
                <div className="border-border bg-muted/30 rounded-md border px-3 py-2 text-xs">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <div className="text-foreground flex min-w-0 items-center gap-2 font-medium">
                      <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                        {getBrowserPairDescription(selectedBrowserRow)}
                      </span>
                    </div>
                    <div className="relative inline-flex h-10 w-10 items-center justify-center">
                      <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          className="stroke-border fill-none"
                          strokeWidth="3"
                        />
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          className={`fill-none transition-all ${
                            browserRowActionKind === 'downloaded'
                              ? 'stroke-emerald-500'
                              : 'stroke-primary'
                          }`}
                          strokeWidth="3"
                          strokeDasharray={100.531}
                          strokeDashoffset={100.531 * (1 - browserProgressPercent / 100)}
                          strokeLinecap="round"
                        />
                      </svg>
                      {browserRowActionKind === 'download' ? (
                        <Tooltip content="Download language pair" delay={0}>
                          <button
                            type="button"
                            aria-label="Download browser language pair"
                            onClick={() => void startBrowserPairPreparation(selectedBrowserRow)}
                            className="text-foreground focus-visible:ring-primary absolute inline-flex h-8 w-8 items-center justify-center rounded-full bg-transparent outline-none transition-[background-color,transform] hover:scale-105 focus-visible:ring-1"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                      ) : browserRowActionKind === 'cancel' ? (
                        <Tooltip content="Cancel download" delay={0}>
                          <button
                            type="button"
                            aria-label="Cancel browser language pair download"
                            onClick={cancelBrowserPairPreparation}
                            className="text-foreground focus-visible:ring-primary group absolute inline-flex h-8 w-8 items-center justify-center rounded-full bg-transparent outline-none transition-[background-color,transform] hover:scale-105 focus-visible:ring-1"
                          >
                            <span className="text-[10px] font-medium group-hover:hidden">
                              {`${browserProgressPercent}%`}
                            </span>
                            <X className="hidden h-3.5 w-3.5 group-hover:block" />
                          </button>
                        </Tooltip>
                      ) : browserRowActionKind === 'downloaded' ? (
                        <Tooltip content="Downloaded" delay={0}>
                          <span
                            aria-label="Downloaded"
                            className="absolute inline-flex h-8 w-8 items-center justify-center rounded-full bg-transparent text-emerald-500"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </span>
                        </Tooltip>
                      ) : (
                        <span className="text-foreground absolute text-[10px] font-medium">
                          {browserCheckLoading ? '...' : `${browserProgressPercent}%`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-muted-foreground mt-2 leading-5">
                    {selectedBrowserRow.message ??
                      (selectedBrowserRow.availability === 'available'
                        ? 'This language pair is ready in the browser.'
                        : selectedBrowserRow.availability === 'downloading'
                          ? 'Chrome is downloading this language pair.'
                          : 'This language pair can be downloaded by Chrome.')}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        {shouldShowInstallFlow ? null : effectiveManagedLocalEngineId ? (
          <div className="border-border/60 border-t pt-3">
            <div className="space-y-3 text-xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium">
                    {effectiveManagedLocalEngineId === 'local-ct2' ? 'CT2 Model' : 'Local Model'}
                  </label>
                  <div className="flex items-center gap-1">
                    <Tooltip content={managedLocalRefreshTooltip} delay={0}>
                      <button
                        type="button"
                        aria-label={managedLocalRefreshTooltip}
                        onClick={() => {
                          if (!nmtModelId) return
                          refreshLocalProfilesMutation.mutate({ modelId: nmtModelId })
                        }}
                        disabled={!nmtModelId || refreshLocalProfilesMutation.isPending}
                        className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-primary inline-flex h-8 w-8 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${
                            refreshLocalProfilesMutation.isPending ? 'animate-spin' : ''
                          }`}
                        />
                      </button>
                    </Tooltip>
                    <LocalProviderSettingsPopover
                      value={nmtHfEndpoint}
                      resolvedEndpoint={nmtResolvedHfEndpoint}
                      onValueChange={setNmtHfEndpoint}
                      onCommit={(endpoint) => {
                        saveGlobalSettingsMutation.mutate({
                          translationEngines: createManagedLocalGlobalSettingsPatch(
                            effectiveManagedLocalEngineId,
                            { hfEndpoint: endpoint }
                          ),
                        })
                        setNmtRemoteOptions([])
                      }}
                    />
                  </div>
                </div>
                <div className="@[42rem]:grid-cols-[minmax(0,1fr)_auto] grid gap-2">
                  <LocalModelCombobox
                    value={nmtModel}
                    query={nmtModelQuery}
                    options={nmtCatalogOptions}
                    remoteLoading={nmtRemoteLoading}
                    onQueryChange={setNmtModelQuery}
                    onOpenChange={setNmtSearchOpen}
                    onSearchInput={() => setNmtSearchTouched(true)}
                    onChange={(nextModel) => {
                      setNmtModel(nextModel)
                      setNmtModelQuery(nextModel)
                    }}
                    onCommit={async (model) => {
                      const panelState = await markManagedLocalModelSelected(
                        effectiveManagedLocalEngineId,
                        model
                      )
                      cacheManagedLocalPanelState({
                        engineId: effectiveManagedLocalEngineId,
                        panelState,
                        queryClient,
                        requestedSelectedGroupId: preferredLocalSelectedGroupId,
                      })
                      lastLocalPanelStateRef.current = panelState
                      saveGlobalSettingsMutation.mutate({
                        translationEngines: createManagedLocalGlobalSettingsPatch(
                          effectiveManagedLocalEngineId,
                          { model, selectedGroupId: null }
                        ),
                      })
                      saveTranslationConfigMutation.mutate({
                        engines: createManagedLocalProjectSettingsPatch(
                          effectiveManagedLocalEngineId,
                          { model, selectedGroupId: null }
                        ),
                      })
                      setNmtSelectedGroupId(panelState.selectedGroupId)
                    }}
                    ariaLabel={managedLocalModelLabel}
                  />
                  <div className="text-muted-foreground inline-flex min-w-0 items-center text-[11px] leading-5 [overflow-wrap:anywhere]">
                    HF: {nmtResolvedHfEndpoint}
                  </div>
                </div>
                <LocalDownloadGroupSelector
                  ariaLabel={managedLocalDownloadGroupsLabel}
                  groups={nmtDownloadGroups}
                  loading={localPlanLoading}
                  disabled={nmtGroupSelectionDisabled}
                  onSelectGroup={(groupId) => {
                    setNmtSelectedGroupId(groupId)
                    saveGlobalSettingsMutation.mutate({
                      translationEngines: createManagedLocalGlobalSettingsPatch(
                        effectiveManagedLocalEngineId,
                        { selectedGroupId: groupId }
                      ),
                    })
                    saveTranslationConfigMutation.mutate({
                      engines: createManagedLocalProjectSettingsPatch(
                        effectiveManagedLocalEngineId,
                        { selectedGroupId: groupId }
                      ),
                    })
                  }}
                />
              </div>
              <LocalDownloadFilesCard
                plan={displayedLocalAsset?.plan ?? resolvedLocalDownloadPlan}
                groups={nmtDownloadGroups}
                state={displayedLocalAsset}
                progressPercent={nmtProgressPercent}
                loading={localPlanLoading}
                error={
                  localPanelError ??
                  (selectedLocalAsset?.status === 'error'
                    ? (selectedLocalAsset.error ?? null)
                    : null)
                }
                onDownload={() => {
                  downloadLocalModelMutation.mutate({
                    modelId: nmtModelId,
                    groupId: effectiveLocalSelectedGroupId,
                  })
                }}
                onPause={() => {
                  pauseLocalModelMutation.mutate({
                    modelId: nmtModelId,
                    groupId: effectiveLocalSelectedGroupId,
                  })
                }}
                onResume={() => {
                  resumeLocalModelMutation.mutate({
                    modelId: nmtModelId,
                    groupId: effectiveLocalSelectedGroupId,
                  })
                }}
                onDelete={() => {
                  deleteLocalModelMutation.mutate({
                    modelId: nmtModelId,
                    groupId: effectiveLocalSelectedGroupId,
                  })
                }}
                knownSize={nmtKnownSize}
                modelId={nmtModelId}
              />
            </div>
          </div>
        ) : null}

        <div className="border-border/60 space-y-3 border-t pt-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <label className="block text-sm font-medium">Translation cache</label>
              <p className="text-muted-foreground mt-1 text-sm">
                Stores validated translation projections in the shared user cache.
              </p>
            </div>
            <Switch
              checked={translationCacheEnabled}
              onCheckedChange={(checked) => {
                setTranslationCacheEnabled(checked)
                saveTranslationConfigMutation.mutate({ cacheEnabled: checked })
                if (checked) void refetchTranslationCacheStats()
              }}
              ariaLabel="Enable translation cache"
              disabled={saveTranslationConfigMutation.isPending || inStaticMode}
            />
          </div>

          {translationCacheEnabled ? (
            <div className="@[42rem]:grid-cols-[minmax(12rem,1fr)_auto] grid gap-3">
              <label className="block text-sm font-medium">
                Entry limit
                <input
                  type="number"
                  min={100}
                  max={200000}
                  step={100}
                  value={translationCacheEntryLimit}
                  onChange={(event) =>
                    setTranslationCacheEntryLimit(Number(event.currentTarget.value))
                  }
                  onBlur={() => {
                    const nextLimit = Math.round(translationCacheEntryLimit)
                    setTranslationCacheEntryLimit(nextLimit)
                    saveGlobalSettingsMutation.mutate({
                      translationCache: { entryLimit: nextLimit },
                    })
                  }}
                  className="border-input bg-background mt-2 h-9 w-full rounded-md border px-3 text-sm"
                />
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    cleanTranslationCacheMutation.mutate(undefined, {
                      onSuccess: () => void refetchTranslationCacheStats(),
                    })
                  }
                  disabled={cleanTranslationCacheMutation.isPending}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Clean
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    clearTranslationCacheMutation.mutate(undefined, {
                      onSuccess: () => void refetchTranslationCacheStats(),
                    })
                  }
                  disabled={clearTranslationCacheMutation.isPending}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Clear
                </Button>
              </div>
              <p className="text-muted-foreground @[42rem]:col-span-2 text-xs">
                {translationCacheStats
                  ? `${translationCacheStats.entries} / ${translationCacheStats.entryLimit} entries`
                  : 'Cache stats unavailable.'}
              </p>
            </div>
          ) : null}
        </div>

        {isSaving ? (
          <p className="text-muted-foreground text-xs">Saving translation settings...</p>
        ) : null}

        <TranslationTestDialog
          open={translationTestOpen}
          onClose={() => setTranslationTestOpen(false)}
          engineId={effectiveTranslationEngineId}
          sourceLanguage={smokeSourceLanguage}
          sourceText={smokeSourceText}
          result={smokeResult}
          error={smokeError}
          running={smokeRunning}
          onSample={() => {
            const preset = getTranslationSmokePreset()
            setSmokeSourceLanguage(preset.sourceLanguage)
            setSmokeSourceText(preset.sourceText)
            setSmokeResult('')
            setSmokeError(null)
          }}
          onRun={() => void runSmokeTest()}
          onSourceLanguageChange={(sourceLanguage) => {
            setSmokeSourceLanguage(sourceLanguage)
            setSmokeResult('')
            setSmokeError(null)
          }}
          onSourceTextChange={setSmokeSourceText}
        />
      </div>
    </TocSection>
  )
}

function LocalModelCombobox({
  ariaLabel,
  value,
  query,
  options,
  remoteLoading,
  onQueryChange,
  onOpenChange,
  onSearchInput,
  onChange,
  onCommit,
}: {
  ariaLabel?: string
  value: string
  query: string
  options: LocalModelCatalogItem[]
  remoteLoading: boolean
  onQueryChange: (value: string) => void
  onOpenChange: (open: boolean) => void
  onSearchInput: () => void
  onChange: (value: string) => void
  onCommit: (value: string) => Promise<void> | void
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const popoverId = `translation-local-model-popover-${id}`
  const listboxId = `translation-local-model-options-${id}`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(
    null
  )

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const margin = 8
    const width = Math.min(Math.max(rect.width, 420), window.innerWidth - margin * 2)
    const left = Math.min(window.innerWidth - width - margin, Math.max(margin, rect.left))
    const top = Math.min(window.innerHeight - margin, Math.max(margin, rect.bottom + 4))
    setPosition({ left, top, width })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  const hidePopover = useCallback(() => {
    const popover = popoverRef.current
    if (!popover) {
      setOpen(false)
      return
    }
    if (typeof popover.hidePopover === 'function') {
      try {
        popover.hidePopover()
        return
      } catch {
        // ignore
      }
    }
    setOpen(false)
  }, [])

  const handleToggle = useCallback(
    (event: ReactToggleEvent<HTMLDivElement>) => {
      const nextOpen = event.newState === 'open'
      setOpen(nextOpen)
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel ?? 'Local model'}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        popoverTarget={popoverId}
        popoverTargetAction="toggle"
        onClick={updatePosition}
        className="border-border bg-background text-foreground hover:bg-muted/30 focus:ring-primary inline-flex h-9 w-full min-w-[12rem] items-center gap-2 rounded-md border px-3 py-2 text-left text-sm outline-none focus:ring-1"
      >
        <span className="min-w-0 flex-1 truncate">{value || 'Select model'}</span>
        <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
      </button>

      <div
        id={popoverId}
        ref={popoverRef}
        role="dialog"
        aria-label="Select local model"
        popover="auto"
        onToggle={handleToggle}
        className="settings-floating-popover bg-popover text-popover-foreground border-border m-0 rounded-md border p-2 shadow-lg backdrop:bg-black/20"
        style={
          position
            ? {
                position: 'fixed',
                inset: 'auto',
                left: position.left,
                top: position.top,
                width: position.width,
              }
            : undefined
        }
      >
        <div className="border-border bg-popover sticky top-0 z-10 mb-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-2 py-1.5">
          <Search className="text-muted-foreground h-4 w-4" aria-hidden="true" />
          <input
            ref={searchInputRef}
            role="textbox"
            aria-label="Search local models"
            aria-autocomplete="list"
            aria-controls={listboxId}
            value={query}
            onChange={(event) => {
              onSearchInput()
              onQueryChange(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') hidePopover()
              if (event.key === 'Enter') {
                const nextValue = query.trim()
                onChange(nextValue)
                onCommit(nextValue)
                hidePopover()
              }
            }}
            className="text-foreground placeholder:text-muted-foreground min-w-0 bg-transparent text-sm outline-none"
            placeholder="Search Hugging Face translation models"
          />
          <button
            type="button"
            aria-label="Clear model search"
            title="Clear"
            onClick={() => {
              onQueryChange('')
              searchInputRef.current?.focus()
            }}
            className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-6 w-6 items-center justify-center rounded transition-colors"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div
          id={listboxId}
          role="listbox"
          aria-label="Local model options"
          className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[color-mix(in_srgb,currentColor,transparent_78%)] max-h-72 overflow-y-auto"
        >
          {options.length > 0 ? (
            options.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                role="option"
                aria-selected={candidate.id === value}
                className={`grid w-full gap-1 rounded-sm px-2 py-2 text-left text-sm ${
                  candidate.id === value
                    ? 'bg-primary/10 text-primary'
                    : 'text-popover-foreground hover:bg-muted/70'
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (!candidate.selectable) return
                  onChange(candidate.id)
                  void onCommit(candidate.id)
                  hidePopover()
                }}
                disabled={!candidate.selectable}
              >
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <span className="min-w-0 truncate">{candidate.id}</span>
                  {candidate.local ? (
                    <span className="text-emerald-600">
                      {formatLocalModelStatus(candidate.asset.status)}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground whitespace-normal text-xs [overflow-wrap:anywhere]">
                  {candidate.summary}
                </span>
                <span className="text-muted-foreground flex flex-wrap items-center gap-2 text-[11px]">
                  {candidate.downloads > 0
                    ? `${formatCompactNumber(candidate.downloads)} downloads · `
                    : ''}
                  {formatByteSize(candidate.size.estimatedTotalBytes)}
                  {candidate.asset.progress !== undefined &&
                  candidate.asset.status !== 'downloaded' ? (
                    <span>· {Math.round(candidate.asset.progress * 100)}%</span>
                  ) : null}
                  {!candidate.selectable ? <span>· Size required</span> : null}
                </span>
                <LocalModelGroupChips
                  groups={candidate.downloadGroups ?? candidate.asset.plan?.groups ?? []}
                />
              </button>
            ))
          ) : (
            <div className="text-muted-foreground px-2 py-2 text-sm">No matching models</div>
          )}
          {remoteLoading ? (
            <div className="text-muted-foreground flex items-center gap-2 px-2 py-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading remote models…
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function TranslationTestDialog({
  open,
  onClose,
  engineId,
  sourceLanguage,
  sourceText,
  result,
  error,
  running,
  onSample,
  onRun,
  onSourceLanguageChange,
  onSourceTextChange,
}: {
  open: boolean
  onClose: () => void
  engineId: TranslationEngineId | null
  sourceLanguage: string
  sourceText: string
  result: string
  error: string | null
  running: boolean
  onSample: () => void
  onRun: () => void
  onSourceLanguageChange: (sourceLanguage: string) => void
  onSourceTextChange: (sourceText: string) => void
}) {
  if (!open) return null

  return (
    <Dialog
      open={open}
      title={
        <div className="flex min-w-0 items-center gap-2">
          <FlaskConical className="text-muted-foreground h-4 w-4 shrink-0" />
          <span className="truncate text-sm font-medium">Translation Test</span>
        </div>
      }
      onClose={onClose}
      headerActions={
        <Button size="sm" variant="secondary" onClick={onSample}>
          <RotateCcw className="h-3.5 w-3.5" />
          Sample
        </Button>
      }
      className="max-w-3xl"
    >
      <div className="space-y-4">
        <div className="@[56rem]:grid-cols-[minmax(10rem,12rem)_minmax(0,1fr)] grid gap-3">
          <label className="block text-sm font-medium">
            Source Language
            <div className="mt-2">
              <TranslationLanguageCombobox
                value={sourceLanguage}
                onChange={onSourceLanguageChange}
                ariaLabel="Translation test source language"
                dialogLabel="Select translation test source language"
                searchInputLabel="Search translation test source languages"
                optionsListLabel="Translation test source language options"
                clearButtonLabel="Clear translation test source language search"
                placeholder="Select source language"
                disabled={running}
              />
            </div>
          </label>
          <label className="block text-sm font-medium">
            Source Text
            <textarea
              aria-label="Translation test source text"
              value={sourceText}
              onChange={(event) => onSourceTextChange(event.currentTarget.value)}
              rows={4}
              className="border-input bg-background focus:ring-ring mt-2 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              placeholder={getTranslationTestPlaceholder(sourceLanguage)}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onRun} disabled={running}>
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Run Test
          </Button>
          <p className="text-muted-foreground text-xs">
            {engineId === 'local'
              ? 'Uses the configured local model and server runtime.'
              : engineId === 'local-ct2'
                ? 'Uses the configured CT2 model artifacts and server runtime.'
                : engineId === 'openai'
                  ? 'Uses the configured OpenAI-compatible provider and model.'
                  : 'Uses the current browser Translator API capability.'}
          </p>
        </div>

        {error ? (
          <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-xs">
            {error}
          </div>
        ) : null}
        {result ? (
          <div className="bg-muted/30 border-border rounded-md border px-3 py-2">
            <div className="text-foreground text-xs font-medium">Translated Output</div>
            <p className="text-foreground mt-1 whitespace-pre-wrap text-sm">{result}</p>
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}

function LocalProviderSettingsPopover({
  value,
  resolvedEndpoint,
  onValueChange,
  onCommit,
}: {
  value: string
  resolvedEndpoint: string
  onValueChange: (value: string) => void
  onCommit: (endpoint: string) => void
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const popoverId = `translation-local-provider-popover-${id}`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(
    null
  )

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const margin = 8
    const width = Math.min(Math.max(rect.width, 320), window.innerWidth - margin * 2)
    const left = Math.min(window.innerWidth - width - margin, Math.max(margin, rect.right - width))
    const top = Math.min(window.innerHeight - margin, Math.max(margin, rect.bottom + 4))
    setPosition({ left, top, width })
  }, [])

  const commit = useCallback(() => {
    onCommit(value.trim())
  }, [onCommit, value])

  const hidePopover = useCallback(() => {
    const popover = popoverRef.current
    if (!popover) {
      setOpen(false)
      return
    }
    if (typeof popover.hidePopover === 'function') {
      try {
        popover.hidePopover()
        return
      } catch {
        // Native popover can throw if the element is already closed.
      }
    }
    setOpen(false)
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  const handleToggle = useCallback(
    (event: ReactToggleEvent<HTMLDivElement>) => {
      const nextOpen = event.newState === 'open'
      setOpen(nextOpen)
      if (nextOpen) updatePosition()
      else commit()
    },
    [commit, updatePosition]
  )

  return (
    <div className="shrink-0">
      <Tooltip content="Hugging Face endpoint" delay={0}>
        <button
          ref={triggerRef}
          type="button"
          aria-label="Local provider settings"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={popoverId}
          popoverTarget={popoverId}
          popoverTargetAction="toggle"
          onClick={updatePosition}
          className="text-muted-foreground hover:bg-muted hover:text-foreground focus:ring-primary inline-flex h-7 w-7 items-center justify-center rounded-md outline-none transition-colors focus:ring-1"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
      <div
        id={popoverId}
        ref={popoverRef}
        role="dialog"
        aria-label="Local provider settings"
        popover="auto"
        onToggle={handleToggle}
        className="settings-floating-popover bg-popover text-popover-foreground border-border m-0 space-y-3 rounded-md border p-3 shadow-lg backdrop:bg-black/20"
        style={
          position
            ? {
                position: 'fixed',
                inset: 'auto',
                left: position.left,
                top: position.top,
                width: position.width,
              }
            : undefined
        }
      >
        <label className="block text-sm font-medium">
          HF Endpoint
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => onValueChange(event.currentTarget.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commit()
                hidePopover()
              }
              if (event.key === 'Escape') hidePopover()
            }}
            className="border-input bg-background mt-2 h-9 w-full rounded-md border px-3 text-sm"
            placeholder="https://huggingface.co"
          />
        </label>
        <div className="text-muted-foreground text-xs leading-5 [overflow-wrap:anywhere]">
          Current endpoint: {resolvedEndpoint}. Mirror example: https://hf-mirror.com
        </div>
      </div>
    </div>
  )
}

function LocalModelGroupChips({ groups }: { groups: TranslationDownloadGroupPlan[] }) {
  if (groups.length === 0) return null

  return (
    <span className="flex flex-wrap gap-1 pt-1">
      {groups.slice(0, 5).map((group) => {
        const tone = mapLocalGroupStatusToChipTone(group.status)
        return (
          <span
            key={group.id}
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] ${
              group.selectable
                ? getDownloadStateChipClasses({
                    tone,
                    selected: group.selected,
                    interactive: false,
                  })
                : 'text-muted-foreground/60 border-dashed'
            }`}
          >
            <span>{group.label}</span>
            <span>{formatByteSize(group.estimatedTotalBytes)}</span>
          </span>
        )
      })}
    </span>
  )
}

function LocalDownloadGroupSelector({
  ariaLabel,
  groups,
  loading,
  disabled,
  onSelectGroup,
}: {
  ariaLabel?: string
  groups: TranslationDownloadGroupPlan[]
  loading: boolean
  disabled: boolean
  onSelectGroup: (groupId: string) => void
}) {
  if (groups.length === 0) return null

  return (
    <>
      <div
        className="flex flex-wrap gap-1.5 pt-1"
        aria-label={ariaLabel ?? 'Local download profiles'}
        aria-busy={loading}
      >
        {groups.map((group) => {
          const chipState = mapLocalGroupStatusToChipTone(group.status)
          return (
            <button
              key={group.id}
              type="button"
              disabled={!group.selectable || disabled}
              onClick={() => onSelectGroup(group.id)}
              className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] leading-none transition-colors ${getDownloadStateChipClasses(
                {
                  tone: chipState,
                  selected: group.selected,
                }
              )} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span className="font-medium">{group.label}</span>
              <span>{formatByteSize(group.estimatedTotalBytes)}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

type LocalDownloadGroupChipState = 'downloaded' | 'partial' | 'not-started'

function mapLocalGroupStatusToChipTone(
  status: TranslationDownloadGroupPlan['status']
): LocalDownloadGroupChipState {
  if (status === 'downloaded') return 'downloaded'
  if (
    status === 'queued' ||
    status === 'downloading' ||
    status === 'paused' ||
    status === 'error' ||
    status === 'deleting'
  ) {
    return 'partial'
  }
  return 'not-started'
}

type LocalPlanAction = 'download' | 'pause' | 'resume' | 'downloaded' | 'deleting' | 'progress'

function getLocalPlanAction(input: {
  state: LocalModelAssetState | null
  loading: boolean
  knownSize: boolean
}): LocalPlanAction {
  if (input.loading) return 'progress'
  switch (input.state?.status) {
    case 'deleting':
      return 'deleting'
    case 'downloading':
      return 'pause'
    case 'paused':
      return 'resume'
    case 'downloaded':
      return 'downloaded'
    case 'error':
    case 'not-downloaded':
    case undefined:
      return input.knownSize ? 'download' : 'progress'
    case 'queued':
      return 'progress'
  }
}

function buildLocalModelRevisionLink(
  modelId: string,
  selectedGroup: TranslationDownloadGroupPlan | null,
  files: TranslationModelDownloadPlan['files']
): { commitHash: string; href: string } | null {
  const commitHash = selectedGroup?.commitHash ?? files.find((file) => file.revision)?.revision
  if (!commitHash) return null
  return {
    commitHash,
    href: `https://huggingface.co/${modelId}/tree/${encodeURIComponent(commitHash)}`,
  }
}

function LocalDownloadFilesCard({
  plan,
  groups,
  state,
  progressPercent,
  loading,
  error,
  onDownload,
  onPause,
  onResume,
  onDelete,
  knownSize,
  modelId,
}: {
  plan: TranslationModelDownloadPlan | null
  groups: TranslationDownloadGroupPlan[]
  state: LocalModelAssetState | null
  progressPercent: number | undefined
  loading: boolean
  error: string | null
  onDownload: () => void
  onPause: () => void
  onResume: () => void
  onDelete: () => void
  knownSize: boolean
  modelId: string
}) {
  const isDeleting = state?.status === 'deleting'
  const isPaused = state?.status === 'paused'
  const isDownloaded = state?.status === 'downloaded'
  const isError = state?.status === 'error'
  const action = getLocalPlanAction({ state, loading, knownSize })
  const canDelete = !loading && !isDeleting && (isDownloaded || isPaused || isError)
  const actionProgress = progressPercent ?? 0
  const selectedGroup = groups.find((group) => group.selected) ?? null
  const planFiles = selectedGroup?.files ?? plan?.files ?? state?.plan?.files ?? []
  const revisionLink = buildLocalModelRevisionLink(modelId, selectedGroup, planFiles)
  const stateFileByPath = new Map(state?.files.map((file) => [file.path, file]) ?? [])
  const displayFiles =
    planFiles.length > 0
      ? planFiles.map((file) => ({
          ...file,
          downloadedBytes: stateFileByPath.get(file.path)?.downloadedBytes,
        }))
      : (state?.files ?? [])
  const isResolving = loading && !state

  return (
    <div className="space-y-3">
      {!loading && plan && !knownSize ? (
        <div className="text-amber-600">
          This model is not downloadable here until concrete artifact sizes are known.
        </div>
      ) : null}
      <div
        className={`border-border rounded-md border px-3 py-2 text-xs ${
          isDownloaded ? 'bg-emerald-500/5' : 'bg-muted/30'
        }`}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="text-foreground flex min-w-0 items-center gap-2 font-medium">
            <span>Download files</span>
            {plan ? (
              <span className="text-muted-foreground text-[11px] font-normal">
                {formatByteSize(selectedGroup?.estimatedTotalBytes ?? plan.estimatedTotalBytes)}
              </span>
            ) : state?.totalBytes !== undefined ? (
              <span className="text-muted-foreground text-[11px] font-normal">
                {formatByteSize(state.totalBytes)}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {canDelete ? (
              <button
                type="button"
                aria-label="Delete model"
                title="Delete local model"
                onClick={onDelete}
                disabled={!modelId}
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/40 inline-flex h-8 w-8 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <div className="relative inline-flex h-10 w-10 items-center justify-center">
              <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  className="stroke-border fill-none"
                  strokeWidth="3"
                />
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  className={`fill-none transition-all ${
                    isDownloaded ? 'stroke-emerald-500' : 'stroke-primary'
                  }`}
                  strokeWidth="3"
                  strokeDasharray={100.531}
                  strokeDashoffset={100.531 * (1 - actionProgress / 100)}
                  strokeLinecap="round"
                />
              </svg>
              {action === 'download' ? (
                <Tooltip content="Download model" delay={0}>
                  <button
                    type="button"
                    aria-label="Download model"
                    data-local-plan-action="download"
                    onClick={onDownload}
                    disabled={!modelId}
                    className="text-foreground focus-visible:ring-primary absolute inline-flex h-8 w-8 items-center justify-center rounded-full bg-transparent outline-none transition-[background-color,transform] hover:scale-105 focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
              ) : action === 'pause' ? (
                <Tooltip content="Pause" delay={0}>
                  <button
                    type="button"
                    aria-label="Pause download"
                    data-local-plan-action="pause"
                    onClick={onPause}
                    disabled={!modelId}
                    className="text-foreground focus-visible:ring-primary group absolute inline-flex h-8 w-8 items-center justify-center rounded-full bg-transparent outline-none transition-[background-color,transform] hover:scale-105 focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="text-[10px] font-medium group-hover:hidden">
                      {`${actionProgress}%`}
                    </span>
                    <Pause className="hidden h-3.5 w-3.5 group-hover:block" />
                  </button>
                </Tooltip>
              ) : action === 'resume' ? (
                <Tooltip content="Resume download" delay={0}>
                  <button
                    type="button"
                    aria-label="Resume download"
                    data-local-plan-action="resume"
                    onClick={onResume}
                    disabled={!modelId}
                    className="text-foreground focus-visible:ring-primary absolute inline-flex h-8 w-8 items-center justify-center rounded-full bg-transparent outline-none transition-[background-color,transform] hover:scale-105 focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
              ) : action === 'downloaded' ? (
                <Tooltip content="Downloaded" delay={0}>
                  <span
                    aria-label="Downloaded"
                    data-local-plan-action="downloaded"
                    className="absolute inline-flex h-8 w-8 items-center justify-center rounded-full bg-transparent text-emerald-500"
                  >
                    <CheckCircle className="h-4 w-4" />
                  </span>
                </Tooltip>
              ) : action === 'deleting' ? (
                <span
                  data-local-plan-action="deleting"
                  className="text-foreground absolute inline-flex h-8 w-8 items-center justify-center rounded-full bg-transparent"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                </span>
              ) : (
                <span
                  data-local-plan-action="progress"
                  className="text-foreground absolute text-[10px] font-medium"
                >
                  {loading ? '...' : `${actionProgress}%`}
                </span>
              )}
            </div>
          </div>
        </div>
        {isDeleting ? (
          <div className="text-muted-foreground mt-2 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Removing local model files…
          </div>
        ) : error ? (
          <div className="text-destructive mt-2 flex items-center gap-2 leading-5">
            <XCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          <>
            {revisionLink ? (
              <div className="text-muted-foreground mt-2 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 leading-5">
                <span>Revision</span>
                <a
                  href={revisionLink.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary bg-muted inline-flex min-w-0 items-center gap-1 rounded px-1 py-0.5 font-mono text-[11px] hover:underline"
                >
                  <span className="min-w-0 truncate">{revisionLink.commitHash}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
            ) : null}
            {isResolving ? (
              <div className="text-muted-foreground mt-2 flex items-center gap-2 leading-5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading model files…
              </div>
            ) : displayFiles.length > 0 ? (
              <ul className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[color-mix(in_srgb,currentColor,transparent_78%)] text-muted-foreground mt-2 max-h-48 space-y-1 overflow-y-auto pr-1">
                {displayFiles.map((file) => {
                  const sizeBytes = file.sizeBytes
                  const downloadedBytes =
                    'downloadedBytes' in file
                      ? (file.downloadedBytes ??
                        (isDownloaded && sizeBytes !== undefined
                          ? sizeBytes
                          : sizeBytes !== undefined
                            ? 0
                            : undefined))
                      : undefined
                  return (
                    <li key={file.path} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                      <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                        {file.path}
                      </span>
                      <span className="shrink-0">
                        {downloadedBytes !== undefined || sizeBytes !== undefined
                          ? `${formatByteSize(downloadedBytes)} / ${formatByteSize(sizeBytes)}`
                          : 'Pending'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="text-muted-foreground mt-2">No runtime download plan available.</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function formatByteSize(value: number | undefined): string {
  if (value === undefined || value < 0) return 'Unknown size'
  if (value === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  const digits = size >= 100 || unitIndex === 0 ? 0 : 1
  return `${size.toFixed(digits)} ${units[unitIndex]}`
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value
  )
}

function formatLocalModelStatus(status: LocalModelAssetState['status']): string {
  switch (status) {
    case 'not-downloaded':
      return 'Not downloaded'
    case 'queued':
      return 'Queued'
    case 'downloading':
      return 'Downloading'
    case 'paused':
      return 'Paused'
    case 'downloaded':
      return 'Downloaded'
    case 'error':
      return 'Error'
    case 'deleting':
      return 'Deleting'
  }
}

function TranslationLanguageCombobox({
  value,
  onChange,
  ariaLabel = 'Translation target language',
  dialogLabel = 'Select translation target language',
  searchInputLabel = 'Search translation languages',
  optionsListLabel = 'Translation target language options',
  clearButtonLabel = 'Clear search',
  placeholder = 'Select language',
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
  dialogLabel?: string
  searchInputLabel?: string
  optionsListLabel?: string
  clearButtonLabel?: string
  placeholder?: string
  disabled?: boolean
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const popoverId = `translation-target-language-popover-${id}`
  const listboxId = `translation-target-language-options-${id}`
  const selectedLanguage = findTranslationLanguage(value)
  const selectedLabel = selectedLanguage?.label ?? value
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [popoverPosition, setPopoverPosition] = useState<{
    left: number
    top: number
    width: number
  } | null>(null)
  const filteredOptions = useMemo(() => searchTranslationLanguages(query), [query])

  const updatePopoverPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const margin = 8
    const width = Math.min(Math.max(rect.width, 320), window.innerWidth - margin * 2)
    const left = Math.min(window.innerWidth - width - margin, Math.max(margin, rect.left))
    const top = Math.min(window.innerHeight - margin, Math.max(margin, rect.bottom + 4))
    setPopoverPosition({ left, top, width })
  }, [])

  const hidePopover = useCallback(() => {
    const popover = popoverRef.current
    if (!popover) {
      setOpen(false)
      return
    }
    if (typeof popover.hidePopover === 'function') {
      try {
        popover.hidePopover()
        return
      } catch {
        // Native popover can throw if the element is already closed.
      }
    }
    setOpen(false)
  }, [])

  useEffect(() => {
    if (open) updatePopoverPosition()
  }, [open, updatePopoverPosition])

  useEffect(() => {
    if (!open) return
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  }, [open])

  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', updatePopoverPosition)
    window.addEventListener('scroll', updatePopoverPosition, true)
    return () => {
      window.removeEventListener('resize', updatePopoverPosition)
      window.removeEventListener('scroll', updatePopoverPosition, true)
    }
  }, [open, updatePopoverPosition])

  useEffect(() => {
    if (disabled) {
      hidePopover()
      setQuery('')
    }
  }, [disabled, hidePopover])

  const commitLanguage = useCallback(
    (languageCode: string) => {
      setQuery('')
      onChange(languageCode)
      hidePopover()
    },
    [hidePopover, onChange]
  )

  const handleToggle = useCallback(
    (event: ReactToggleEvent<HTMLDivElement>) => {
      const nextOpen = event.newState === 'open'
      setOpen(nextOpen)
      if (nextOpen) updatePopoverPosition()
      else setQuery('')
    },
    [updatePopoverPosition]
  )

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        popoverTarget={popoverId}
        popoverTargetAction="toggle"
        disabled={disabled}
        onClick={updatePopoverPosition}
        className="border-border bg-background text-foreground hover:bg-muted/30 focus:ring-primary inline-flex h-9 w-full min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Languages className="text-muted-foreground h-4 w-4 shrink-0" />
        {selectedLanguage ? (
          <span className="text-muted-foreground shrink-0 font-mono text-xs">
            {selectedLanguage.code}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate">{selectedLabel || placeholder}</span>
        <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
      </button>

      <div
        id={popoverId}
        ref={popoverRef}
        role="dialog"
        aria-label={dialogLabel}
        popover="auto"
        onToggle={handleToggle}
        className="settings-floating-popover bg-popover text-popover-foreground border-border m-0 rounded-md border p-2 shadow-lg backdrop:bg-black/20"
        style={
          popoverPosition
            ? {
                position: 'fixed',
                inset: 'auto',
                left: popoverPosition.left,
                top: popoverPosition.top,
                width: popoverPosition.width,
              }
            : undefined
        }
      >
        <div className="border-border bg-popover sticky top-0 z-10 mb-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-2 py-1.5">
          <Search className="text-muted-foreground h-4 w-4" aria-hidden="true" />
          <input
            ref={searchInputRef}
            role="textbox"
            aria-label={searchInputLabel}
            aria-autocomplete="list"
            aria-controls={listboxId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') hidePopover()
            }}
            className="text-foreground placeholder:text-muted-foreground min-w-0 bg-transparent text-sm outline-none"
            placeholder="Search code, English, or native name"
          />
          <button
            type="button"
            aria-label={clearButtonLabel}
            title="Clear"
            onClick={() => {
              setQuery('')
              searchInputRef.current?.focus()
            }}
            disabled={disabled || query.length === 0}
            className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-6 w-6 items-center justify-center rounded transition-colors disabled:pointer-events-none disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div
          id={listboxId}
          role="listbox"
          aria-label={optionsListLabel}
          className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[color-mix(in_srgb,currentColor,transparent_78%)] max-h-60 overflow-y-auto"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((language) => (
              <button
                key={language.code}
                type="button"
                role="option"
                aria-selected={language.code === value}
                className={`grid w-full grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm ${
                  language.code === value
                    ? 'bg-primary/10 text-primary'
                    : 'text-popover-foreground hover:bg-muted/70'
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commitLanguage(language.code)}
              >
                <span className="text-muted-foreground font-mono text-xs">{language.code}</span>
                <span className="min-w-0 truncate">{language.label}</span>
              </button>
            ))
          ) : (
            <div className="text-muted-foreground px-2 py-2 text-sm">No matching languages</div>
          )}
        </div>
      </div>
    </div>
  )
}
