import { Button } from '@/components/button'
import { ButtonGroup, type ButtonGroupOption } from '@/components/button-group'
import { Dialog } from '@/components/dialog'
import { Select, type SelectOption } from '@/components/select'
import { Switch } from '@/components/switch'
import { TocSection } from '@/components/toc'
import { Tooltip } from '@/components/tooltip'
import {
  prepareBrowserTranslation,
  probeBrowserTranslation,
  type BrowserTranslationStatus,
} from '@/lib/browser-translation'
import { isStaticMode } from '@/lib/static-mode'
import { runSingleTranslation } from '@/lib/translate-service'
import { findTranslationLanguage, searchTranslationLanguages } from '@/lib/translation-languages'
import { trpc, trpcClient } from '@/lib/trpc'
import { useConfigSubscription, useGlobalSettingsSubscription } from '@/lib/use-subscription'
import {
  DEFAULT_TRANSLATION_CACHE_ENTRY_LIMIT,
  type DocumentTranslationConfigUpdate,
  type DocumentTranslationDisplayMode,
} from '@openspecui/core/document-translation'
import { selectLocalDownloadGroup } from '@openspecui/core/local-download-profiles'
import {
  TRANSLATION_ENGINE_IDS,
  getTranslationEngineManifest,
  type LocalModelAssetState,
  type LocalModelCatalogItem,
  type TranslationDownloadGroupPlan,
  type TranslationEngineId,
  type TranslationModelDownloadPlan,
} from '@openspecui/core/translator'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Download,
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
const DEFAULT_TRANSLATION_SMOKE_SOURCE = 'My name is Sarah and I live in London.'
const DEFAULT_TRANSLATION_SMOKE_SOURCE_LANGUAGE = 'en'
const TRANSLATION_TEST_PLACEHOLDERS: Record<string, string> = {
  en: DEFAULT_TRANSLATION_SMOKE_SOURCE,
  no: 'Dette er en liten oversettelsestest fra norsk til tysk.',
  zh: '这是一句用于验证翻译引擎的短句。',
  de: 'Dies ist ein kurzer Satz zum Testen der Übersetzung.',
  fr: 'Ceci est une courte phrase pour tester la traduction.',
  ja: 'これは翻訳エンジンを確認するための短い文です。',
  ko: '이 문장은 번역 엔진을 확인하기 위한 짧은 문장입니다.',
  es: 'Esta es una frase corta para probar la traducción.',
}

const TRANSLATION_DISPLAY_MODE_OPTIONS = [
  { value: 'direct', label: 'Direct' },
  { value: 'bilingual', label: 'Bilingual' },
] satisfies ButtonGroupOption<DocumentTranslationDisplayMode>[]

function formatTranslationCapability(
  capability: BrowserTranslationStatus | null,
  loading: boolean
): string {
  if (loading) return 'Checking browser translation capability...'
  if (!capability) return 'Capability not checked yet.'

  switch (capability.availability) {
    case 'available':
      return 'Browser translator is ready.'
    case 'downloadable':
      return 'Language support can be downloaded by Chrome.'
    case 'downloading':
      return 'Chrome is preparing translation support.'
    case 'missing':
      return capability.message ?? 'Browser Translator API is not exposed.'
    case 'unavailable':
      return 'Translation is unavailable for this browser or language pair.'
    case 'error':
      return capability.message ?? 'Unable to check translation capability.'
  }
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
  const normalized = sourceLanguage.trim().toLowerCase()
  const primary = normalized.split(/[-_]/, 1)[0] ?? normalized
  return (
    TRANSLATION_TEST_PLACEHOLDERS[normalized] ??
    TRANSLATION_TEST_PLACEHOLDERS[primary] ??
    DEFAULT_TRANSLATION_SMOKE_SOURCE
  )
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
  const [translationCapability, setTranslationCapability] =
    useState<BrowserTranslationStatus | null>(null)
  const [translationCapabilityLoading, setTranslationCapabilityLoading] = useState(false)
  const [aiBaseUrl, setAiBaseUrl] = useState('')
  const [aiToken, setAiToken] = useState('')
  const [aiModel, setAiModel] = useState('gpt-4.1-mini')
  const [nmtModel, setNmtModel] = useState(DEFAULT_LOCAL_MODEL_ID)
  const [nmtModelQuery, setNmtModelQuery] = useState(DEFAULT_LOCAL_MODEL_ID)
  const [nmtDebouncedQuery, setNmtDebouncedQuery] = useState(DEFAULT_LOCAL_MODEL_ID)
  const [nmtHfEndpoint, setNmtHfEndpoint] = useState('')
  const [nmtSelectedGroupId, setNmtSelectedGroupId] = useState<string | undefined>(undefined)
  const [nmtLocalLoaded, setNmtLocalLoaded] = useState(false)
  const [nmtLocalOptions, setNmtLocalOptions] = useState<LocalModelCatalogItem[]>([])
  const [nmtRemoteOptions, setNmtRemoteOptions] = useState<LocalModelCatalogItem[]>([])
  const [nmtRemoteLoading, setNmtRemoteLoading] = useState(false)
  const [localSelectedState, setLocalSelectedState] = useState<LocalModelAssetState | null>(null)
  const [localDownloadPlan, setLocalDownloadPlan] = useState<TranslationModelDownloadPlan | null>(null)
  const [localPlanLoading, setLocalPlanLoading] = useState(false)
  const [localPlanError, setLocalPlanError] = useState<string | null>(null)
  const [translationTestOpen, setTranslationTestOpen] = useState(false)
  const [smokeSourceLanguage, setSmokeSourceLanguage] = useState(
    DEFAULT_TRANSLATION_SMOKE_SOURCE_LANGUAGE
  )
  const [smokeSourceText, setSmokeSourceText] = useState('')
  const [smokeResult, setSmokeResult] = useState('')
  const [smokeError, setSmokeError] = useState<string | null>(null)
  const [smokeRunning, setSmokeRunning] = useState(false)

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
    const nextNmtModel =
      globalSettings?.translationEngines?.local?.model ??
      config?.translation?.engines?.local?.model ??
      DEFAULT_LOCAL_MODEL_ID
    setNmtModel(nextNmtModel)
    setNmtModelQuery(nextNmtModel)
    setNmtDebouncedQuery(nextNmtModel)
    setNmtHfEndpoint(globalSettings?.translationEngines?.local?.hfEndpoint ?? '')
    setNmtSelectedGroupId(
      globalSettings?.translationEngines?.local?.selectedGroupId ??
        config?.translation?.engines?.local?.selectedGroupId
    )
  }, [
    config?.translation?.engines?.local?.model,
    config?.translation?.engines?.local?.selectedGroupId,
    globalSettings?.translationCache?.entryLimit,
    globalSettings?.translationEngines?.openai?.baseUrl,
    globalSettings?.translationEngines?.openai?.model,
    globalSettings?.translationEngines?.openai?.token,
    globalSettings?.translationEngines?.local?.hfEndpoint,
    globalSettings?.translationEngines?.local?.model,
    globalSettings?.translationEngines?.local?.selectedGroupId,
  ])

  useEffect(() => {
    if (translationEngineId !== 'local') return
    const trimmedModel = nmtModel.trim()
    if (!trimmedModel) {
      setLocalDownloadPlan(null)
      setLocalSelectedState(null)
      setLocalPlanLoading(false)
      setLocalPlanError(null)
      return
    }
    let cancelled = false
    setLocalPlanError(null)
    const localAsset = findLocalModelAssetSnapshot(nmtLocalOptions, trimmedModel)
    const localPlan = localAsset
      ? createLocalPlanFromAssetState(localAsset, nmtSelectedGroupId)
      : null
    if (localAsset) {
      setLocalSelectedState(localAsset)
      setLocalDownloadPlan(localPlan)
      setLocalPlanLoading(false)
      return
    }

    if (!nmtLocalLoaded) {
      setLocalPlanLoading(true)
      setLocalSelectedState(null)
      setLocalDownloadPlan(null)
      return
    }

    setLocalPlanLoading(true)
    void trpcClient.localModels.state
      .query({
        modelId: trimmedModel,
        selectedGroupId: nmtSelectedGroupId,
      })
      .then(async (state) => {
        if (cancelled) return
        const statePlan = createLocalPlanFromAssetState(state, nmtSelectedGroupId)
        if (statePlan && hasLocalModelAssetTruth(state)) {
          setLocalPlanLoading(false)
          setLocalDownloadPlan((current) => mergeLocalPlanSnapshots(current, statePlan))
          setLocalSelectedState(state)
          return
        }
        setLocalSelectedState(state)
        setLocalPlanLoading(true)
        const plan = await trpcClient.translationEngines.getModelDownloadPlan.query({
          engineId: 'local',
          model: trimmedModel,
          selectedGroupId: nmtSelectedGroupId,
        })
        if (cancelled) return
        setLocalDownloadPlan(plan)
        setLocalSelectedState(state)
      })
      .catch((error) => {
        if (cancelled) return
        setLocalDownloadPlan(null)
        setLocalSelectedState(null)
        setLocalPlanError(error instanceof Error ? error.message : 'Unable to resolve model plan.')
      })
      .finally(() => {
        if (cancelled) return
        setLocalPlanLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    nmtHfEndpoint,
    nmtLocalLoaded,
    nmtLocalOptions,
    nmtModel,
    nmtSelectedGroupId,
    translationEngineId,
  ])

  useEffect(() => {
    if (translationEngineId !== 'local') return
    const timer = window.setTimeout(() => {
      setNmtDebouncedQuery(nmtModelQuery.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [nmtModelQuery, translationEngineId])

  useEffect(() => {
    if (translationEngineId !== 'local') return
    let cancelled = false
    setNmtLocalLoaded(false)
    void trpcClient.localModels.listLocal
      .query()
      .then((local) => {
        if (cancelled) return
        setNmtLocalOptions(local.items)
        setNmtLocalLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setNmtLocalOptions([])
        setNmtLocalLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [translationEngineId])

  useEffect(() => {
    if (translationEngineId !== 'local') return
    const requestId = `local-search-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setNmtRemoteLoading(true)
    const subscription = trpcClient.localModels.searchRemoteStream.subscribe(
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
  }, [nmtDebouncedQuery, nmtHfEndpoint, translationEngineId, translationTargetLanguage])

  useEffect(() => {
    if (inStaticMode) return
    const nmtSubscription = trpcClient.localModels.subscribeLogs.subscribe(undefined, {
      onData: (log) => {
        if (log.modelId === nmtModel.trim()) {
          void trpcClient.localModels.state
            .query({ modelId: log.modelId, selectedGroupId: nmtSelectedGroupId })
            .then((state) => setLocalSelectedState(state))
            .catch(() => undefined)
        }
      },
      onError: () => undefined,
    })
    return () => {
      nmtSubscription.unsubscribe()
    }
  }, [inStaticMode, nmtModel, nmtSelectedGroupId])

  useEffect(() => {
    if (translationEngineId !== 'local') {
      setNmtLocalOptions([])
      setNmtLocalLoaded(false)
      setNmtRemoteOptions([])
      setNmtRemoteLoading(false)
      setLocalPlanLoading(false)
    }
  }, [translationEngineId])

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
    mutationFn: (input: { modelId: string; selectedGroupId?: string }) =>
      trpcClient.localModels.download.mutate(input),
  })
  const pauseLocalModelMutation = useMutation({
    mutationFn: (modelId: string) => trpcClient.localModels.pause.mutate({ modelId }),
  })
  const resumeLocalModelMutation = useMutation({
    mutationFn: (input: { modelId: string; selectedGroupId?: string }) =>
      trpcClient.localModels.resume.mutate(input),
  })
  const deleteLocalModelMutation = useMutation({
    mutationFn: (modelId: string) => trpcClient.localModels.delete.mutate({ modelId }),
    onSuccess: async () => {
      const modelId = nmtModel.trim()
      if (!modelId) return
      const [state, plan] = await Promise.all([
        trpcClient.localModels.state.query({ modelId, selectedGroupId: nmtSelectedGroupId }),
        trpcClient.translationEngines.getModelDownloadPlan.query({
          engineId: 'local',
          model: modelId,
          selectedGroupId: nmtSelectedGroupId,
        }),
      ])
      setLocalSelectedState(state)
      setLocalDownloadPlan(plan)
    },
  })
  const cleanTranslationCacheMutation = useMutation({
    mutationFn: () => trpcClient.translationCache.clean.mutate(),
  })
  const clearTranslationCacheMutation = useMutation({
    mutationFn: () => trpcClient.translationCache.clear.mutate(),
  })

  const engineConfigReady = inStaticMode || config !== undefined
  const effectiveTranslationEngineId = engineConfigReady
    ? (translationEngineId ?? config?.translation?.engineId ?? 'browser')
    : null
  const persistedTranslationEngineId = config ? (config.translation?.engineId ?? 'browser') : null

  const refreshTranslationCapability = useCallback(
    async (targetLanguage: string, options: { initialize?: boolean } = {}) => {
      setTranslationCapabilityLoading(true)
      const controller = new AbortController()
      try {
        const status = options.initialize
          ? await prepareBrowserTranslation(targetLanguage, controller.signal)
          : await probeBrowserTranslation(targetLanguage)
        setTranslationCapability(status)
      } finally {
        controller.abort()
        setTranslationCapabilityLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (inStaticMode || persistedTranslationEngineId !== 'browser') return
    if (effectiveTranslationEngineId !== 'browser') return
    void refreshTranslationCapability(translationTargetLanguage, { initialize: translationEnabled })
  }, [
    inStaticMode,
    persistedTranslationEngineId,
    refreshTranslationCapability,
    translationEnabled,
    effectiveTranslationEngineId,
    translationTargetLanguage,
  ])

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
  const selectedEngineManifest = effectiveTranslationEngineId
    ? getTranslationEngineManifest(effectiveTranslationEngineId)
    : null
  const engineStatusMessage =
    effectiveTranslationEngineId === 'browser'
      ? formatTranslationCapability(translationCapability, translationCapabilityLoading)
      : (selectedEngine?.message ?? selectedEngine?.description ?? selectedEngineManifest?.description)
  const nmtCatalogOptions = useMemo(() => {
    const merged = new Map<string, LocalModelCatalogItem>()
    for (const item of nmtLocalOptions) merged.set(item.id, item)
    for (const item of nmtRemoteOptions) {
      if (!merged.has(item.id)) merged.set(item.id, item)
    }
    return [...merged.values()]
  }, [nmtLocalOptions, nmtRemoteOptions])
  const nmtModelId = nmtModel.trim()
  const selectedLocalAsset = localSelectedState
  const activeLocalCandidate =
    nmtCatalogOptions.find((candidate) => candidate.id === nmtModelId) ?? null
  const persistedLocalSelectedGroupId =
    globalSettings?.translationEngines?.local?.selectedGroupId ??
    config?.translation?.engines?.local?.selectedGroupId
  const preferredLocalSelectedGroupId = nmtSelectedGroupId ?? persistedLocalSelectedGroupId
  const nmtDownloadGroups =
    localDownloadPlan?.groups ??
    selectedLocalAsset?.plan?.groups ??
    activeLocalCandidate?.downloadGroups ??
    []
  const selectedLocalGroup =
    nmtDownloadGroups.find((group) => group.id === preferredLocalSelectedGroupId) ??
    nmtDownloadGroups.find((group) => group.selected) ??
    null
  const effectiveLocalSelectedGroupId =
    selectedLocalGroup?.id ??
    localDownloadPlan?.selectedGroupId ??
    selectedLocalAsset?.plan?.selectedGroupId ??
    preferredLocalSelectedGroupId
  const nmtKnownSize =
    (selectedLocalGroup?.estimatedTotalBytes ?? localDownloadPlan?.estimatedTotalBytes ?? 0) > 0
  const displayedLocalAsset = deriveLocalGroupAssetState({
    state: selectedLocalAsset,
    plan: localDownloadPlan,
    selectedGroupId: effectiveLocalSelectedGroupId,
  })
  const nmtProgressPercent =
    displayedLocalAsset?.progress === undefined
      ? undefined
      : Math.round(displayedLocalAsset.progress * 100)
  const nmtGroupSelectionDisabled = displayedLocalAsset?.status === 'deleting'
  const nmtResolvedHfEndpoint = nmtHfEndpoint.trim() || 'https://huggingface.co'
  const updateSelectedLocalLifecycle = useCallback(
    (
      status: LocalModelAssetState['status'],
      patch: Partial<
        Pick<LocalModelAssetState, 'progress' | 'bytesDownloaded' | 'totalBytes' | 'resumable'>
      > = {}
    ) => {
      const modelId = nmtModel.trim()
      if (!modelId) return
      setLocalSelectedState((current) =>
        buildOptimisticLocalModelState({
          current,
          modelId,
          status,
          plan: localDownloadPlan,
          selectedGroupId: effectiveLocalSelectedGroupId,
          patch,
        })
      )
    },
    [effectiveLocalSelectedGroupId, localDownloadPlan, nmtModel]
  )
  const runSmokeTest = useCallback(async () => {
    if (!effectiveTranslationEngineId) return
    const sourceText = smokeSourceText.trim() || getTranslationTestPlaceholder(smokeSourceLanguage)

    const sourceLanguage = smokeSourceLanguage.trim() || DEFAULT_TRANSLATION_SMOKE_SOURCE_LANGUAGE
    const targetLanguage = translationTargetLanguage.trim() || DEFAULT_TRANSLATION_TARGET_LANGUAGE

    setSmokeRunning(true)
    setSmokeError(null)
    setSmokeResult('')
    try {
      const result = await runSingleTranslation({
        engineId: effectiveTranslationEngineId,
        sourceLanguage,
        targetLanguage,
        model:
          effectiveTranslationEngineId === 'local' ? nmtModel.trim() : aiModel.trim() || undefined,
        selectedGroupId:
          effectiveTranslationEngineId === 'local' ? effectiveLocalSelectedGroupId : undefined,
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
                void refreshTranslationCapability(translationTargetLanguage, { initialize: true })
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
                if (translationEnabled && effectiveTranslationEngineId === 'browser') {
                  void refreshTranslationCapability(targetLanguage, { initialize: true })
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
                          void refreshTranslationCapability(translationTargetLanguage, {
                            initialize: translationEnabled,
                          })
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
                      size="icon-md"
                      variant="ghost"
                      aria-label="Open translation test"
                      onClick={() => setTranslationTestOpen(true)}
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
                      translationCapabilityLoading ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      ) : translationCapability?.availability === 'available' ? (
                        <Tooltip content="Installed" delay={0}>
                          <button
                            type="button"
                            aria-label="Installed"
                            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-emerald-500"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        </Tooltip>
                      ) : translationCapability?.availability === 'downloadable' ||
                        translationCapability?.availability === 'downloading' ? (
                        <Download className="h-4 w-4 shrink-0 text-sky-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                      )
                    ) : selectedEngine?.status === 'available' ? (
                      <Tooltip content="Installed" delay={0}>
                        <button
                          type="button"
                          aria-label="Installed"
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-emerald-500"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                    )}
                    <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                      {engineStatusMessage}
                    </span>
                  </div>
                </div>
                {effectiveTranslationEngineId === 'browser' ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void refreshTranslationCapability(translationTargetLanguage, {
                        initialize: translationEnabled,
                      })
                    }
                    disabled={translationCapabilityLoading}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Check
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {effectiveTranslationEngineId === 'openai' ? (
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
        {effectiveTranslationEngineId === 'local' ? (
          <div className="border-border/60 border-t pt-3">
            <div className="space-y-3 text-xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium">Local Model</label>
                  <LocalProviderSettingsPopover
                    value={nmtHfEndpoint}
                    resolvedEndpoint={nmtResolvedHfEndpoint}
                    onValueChange={setNmtHfEndpoint}
                    onCommit={(endpoint) => {
                      saveGlobalSettingsMutation.mutate({
                        translationEngines: { local: { hfEndpoint: endpoint } },
                      })
                      setNmtRemoteOptions([])
                    }}
                  />
                </div>
                <div className="@[42rem]:grid-cols-[minmax(0,1fr)_auto] grid gap-2">
                  <LocalModelCombobox
                    value={nmtModel}
                    query={nmtModelQuery}
                    localOptions={nmtLocalOptions}
                    remoteOptions={nmtRemoteOptions}
                    remoteLoading={nmtRemoteLoading}
                    onQueryChange={setNmtModelQuery}
                    onChange={(nextModel) => {
                      setNmtModel(nextModel)
                      setNmtModelQuery(nextModel)
                    }}
                    onCommit={async (model) => {
                      await trpcClient.localModels.markSelected.mutate({ modelId: model })
                      saveGlobalSettingsMutation.mutate({
                        translationEngines: { local: { model, selectedGroupId: undefined } },
                      })
                      saveTranslationConfigMutation.mutate({
                        engines: { local: { model, selectedGroupId: undefined } },
                      })
                      setNmtSelectedGroupId(undefined)
                    }}
                  />
                  <div className="text-muted-foreground inline-flex min-w-0 items-center text-[11px] leading-5 [overflow-wrap:anywhere]">
                    HF: {nmtResolvedHfEndpoint}
                  </div>
                </div>
                <LocalDownloadGroupSelector
                  groups={nmtDownloadGroups}
                  selectedGroupId={effectiveLocalSelectedGroupId}
                  asset={selectedLocalAsset}
                  loading={localPlanLoading}
                  disabled={nmtGroupSelectionDisabled}
                  onSelectGroup={(groupId) => {
                    setNmtSelectedGroupId(groupId)
                    saveGlobalSettingsMutation.mutate({
                      translationEngines: { local: { selectedGroupId: groupId } },
                    })
                    saveTranslationConfigMutation.mutate({
                      engines: { local: { selectedGroupId: groupId } },
                    })
                  }}
                />
              </div>
              <LocalDownloadFilesCard
                plan={localDownloadPlan}
                state={displayedLocalAsset}
                selectedGroupId={effectiveLocalSelectedGroupId}
                progressPercent={nmtProgressPercent}
                loading={localPlanLoading}
                error={localPlanError}
                onDownload={() => {
                  updateSelectedLocalLifecycle('downloading', {
                    progress: selectedLocalAsset?.progress ?? 0,
                  })
                  downloadLocalModelMutation.mutate({
                    modelId: nmtModelId,
                    selectedGroupId: effectiveLocalSelectedGroupId,
                  })
                }}
                onPause={() => {
                  updateSelectedLocalLifecycle('paused', { resumable: true })
                  pauseLocalModelMutation.mutate(nmtModelId)
                }}
                onResume={() => {
                  updateSelectedLocalLifecycle('downloading', {
                    progress: selectedLocalAsset?.progress ?? 0,
                    resumable: true,
                  })
                  resumeLocalModelMutation.mutate({
                    modelId: nmtModelId,
                    selectedGroupId: effectiveLocalSelectedGroupId,
                  })
                }}
                onDelete={() => {
                  updateSelectedLocalLifecycle('deleting')
                  deleteLocalModelMutation.mutate(nmtModelId)
                }}
                knownSize={nmtKnownSize}
                modelId={nmtModelId}
              />
              <p className="text-muted-foreground leading-5">
                Local models stay at the top of the chooser. Remote Hugging Face search continues in
                the background, and entries without a concrete ONNX size stay disabled until the
                download cost is known.
              </p>
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
  value,
  query,
  localOptions,
  remoteOptions,
  remoteLoading,
  onQueryChange,
  onChange,
  onCommit,
}: {
  value: string
  query: string
  localOptions: LocalModelCatalogItem[]
  remoteOptions: LocalModelCatalogItem[]
  remoteLoading: boolean
  onQueryChange: (value: string) => void
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

  const options = useMemo(() => {
    const merged = new Map<string, LocalModelCatalogItem>()
    for (const item of localOptions) merged.set(item.id, item)
    for (const item of remoteOptions) {
      if (!merged.has(item.id)) merged.set(item.id, item)
    }
    return [...merged.values()]
  }, [localOptions, remoteOptions])

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

  const handleToggle = useCallback((event: ReactToggleEvent<HTMLDivElement>) => {
    setOpen(event.newState === 'open')
  }, [])

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Local model"
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
            onChange={(event) => onQueryChange(event.target.value)}
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
      {groups.slice(0, 5).map((group) => (
        <span
          key={group.id}
          className={`border-border inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] ${
            group.selectable ? 'text-muted-foreground' : 'text-muted-foreground/60'
          }`}
        >
          <span>{group.label}</span>
          <span>{formatByteSize(group.estimatedTotalBytes)}</span>
        </span>
      ))}
    </span>
  )
}

function LocalDownloadGroupSelector({
  groups,
  selectedGroupId,
  asset,
  loading,
  disabled,
  onSelectGroup,
}: {
  groups: TranslationDownloadGroupPlan[]
  selectedGroupId?: string
  asset: LocalModelAssetState | null
  loading: boolean
  disabled: boolean
  onSelectGroup: (groupId: string) => void
}) {
  const loadingIndicator = loading ? (
    <div className="text-muted-foreground flex items-center gap-2 text-[11px] leading-5">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Resolving download profiles…
    </div>
  ) : null

  if (groups.length === 0) {
    return loadingIndicator
  }

  return (
    <>
      {loadingIndicator}
      <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Local download profiles">
        {groups.map((group) => {
          const selected = group.id === selectedGroupId
          const locallyAvailable = isLocalDownloadGroupLocallyAvailable(group, asset)
          return (
            <button
              key={group.id}
              type="button"
              disabled={!group.selectable || disabled}
              onClick={() => onSelectGroup(group.id)}
              className={`border-border inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] leading-none transition-colors ${
                locallyAvailable ? 'border-solid' : 'border-dashed'
              } ${
                selected ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/60'
              } disabled:cursor-not-allowed disabled:opacity-50`}
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

function isLocalDownloadGroupLocallyAvailable(
  group: TranslationDownloadGroupPlan,
  asset: LocalModelAssetState | null
): boolean {
  if (!asset || group.files.length === 0) return false
  const localFileByPath = new Map(asset.files.map((file) => [file.path, file]))
  return group.files.every((file) => {
    const localFile = localFileByPath.get(file.path)
    return (
      file.sizeBytes !== undefined &&
      localFile?.downloadedBytes !== undefined &&
      localFile.downloadedBytes >= file.sizeBytes
    )
  })
}

function findLocalModelAssetSnapshot(
  localOptions: LocalModelCatalogItem[],
  modelId: string
): LocalModelAssetState | null {
  const item = localOptions.find((option) => option.id === modelId)
  if (!item) return null
  if (hasLocalModelAssetTruth(item.asset)) return item.asset
  return null
}

function hasLocalModelAssetTruth(state: LocalModelAssetState): boolean {
  if (state.status === 'downloaded') return state.files.length > 0 || Boolean(state.plan)
  if (state.status === 'downloading' || state.status === 'paused' || state.status === 'deleting') {
    return state.files.length > 0 || Boolean(state.plan)
  }
  return false
}

function createLocalPlanFromAssetState(
  state: LocalModelAssetState,
  selectedGroupId?: string
): TranslationModelDownloadPlan | null {
  if (state.plan) {
    return {
      ...state.plan,
      selectedGroupId: selectedGroupId ?? state.plan.selectedGroupId,
    }
  }
  if (state.files.length === 0) return null
  const files = state.files.map((file) => ({
    path: file.path,
    sizeBytes: file.sizeBytes,
    required: true,
  }))
  const totalBytes =
    state.totalBytes ??
    files.reduce(
      (total, file) => (file.sizeBytes === undefined ? total : total + file.sizeBytes),
      0
    )
  return {
    modelId: state.modelId,
    estimatedTotalBytes: totalBytes,
    selectedGroupId,
    files,
  }
}

function mergeLocalPlanSnapshots(
  current: TranslationModelDownloadPlan | null,
  next: TranslationModelDownloadPlan | null
): TranslationModelDownloadPlan | null {
  if (!current) return next
  if (!next) return current
  const currentGroups = current.groups ?? []
  const nextGroups = next.groups ?? []
  const nextGroupIds = new Set(nextGroups.map((group) => group.id))
  return {
    ...current,
    ...next,
    selectedGroupId: next.selectedGroupId ?? current.selectedGroupId,
    groups:
      nextGroups.length > 0
        ? [...nextGroups, ...currentGroups.filter((group) => !nextGroupIds.has(group.id))]
        : current.groups,
  }
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

function buildOptimisticLocalModelState(input: {
  current: LocalModelAssetState | null
  modelId: string
  status: LocalModelAssetState['status']
  plan: TranslationModelDownloadPlan | null
  selectedGroupId?: string
  patch: Partial<
    Pick<LocalModelAssetState, 'progress' | 'bytesDownloaded' | 'totalBytes' | 'resumable'>
  >
}): LocalModelAssetState {
  const selectedGroup =
    input.plan?.groups?.find((group) => group.id === input.selectedGroupId) ??
    input.plan?.groups?.find((group) => group.selected) ??
    null
  const planFiles = selectedGroup?.files ?? input.plan?.files ?? []
  const files =
    input.current?.files.length || planFiles.length === 0
      ? (input.current?.files ?? [])
      : planFiles.map((file) => ({
          path: file.path,
          sizeBytes: file.sizeBytes,
          downloadedBytes: file.sizeBytes === undefined ? undefined : 0,
        }))
  const totalBytes =
    input.patch.totalBytes ??
    input.current?.totalBytes ??
    selectedGroup?.estimatedTotalBytes ??
    input.plan?.estimatedTotalBytes
  return {
    modelId: input.modelId,
    status: input.status,
    selected: true,
    installedAt: input.current?.installedAt,
    updatedAt: Date.now(),
    bytesDownloaded: input.patch.bytesDownloaded ?? input.current?.bytesDownloaded,
    totalBytes,
    progress: input.patch.progress ?? input.current?.progress,
    resumable: input.patch.resumable ?? input.current?.resumable ?? false,
    error: input.status === 'error' ? input.current?.error : undefined,
    plan: input.current?.plan ?? input.plan ?? undefined,
    files,
  }
}

function deriveLocalGroupAssetState(input: {
  state: LocalModelAssetState | null
  plan: TranslationModelDownloadPlan | null
  selectedGroupId?: string
}): LocalModelAssetState | null {
  if (!input.state) return null
  if (!input.selectedGroupId || input.state.status === 'deleting') return input.state

  const selectedGroup = selectLocalDownloadGroup(
    input.plan ?? input.state.plan ?? null,
    input.selectedGroupId
  )
  if (!selectedGroup) return input.state

  const sourceFiles = input.state.files
  const sourceFileByPath = new Map(sourceFiles.map((file) => [file.path, file]))
  const files = selectedGroup.files.map((file) => {
    const current = sourceFileByPath.get(file.path)
    return {
      path: file.path,
      sizeBytes: file.sizeBytes,
      downloadedBytes: current?.downloadedBytes,
    }
  })
  const completedBytes = files.reduce((total, file) => {
    const downloaded = file.downloadedBytes ?? 0
    const max = file.sizeBytes
    return total + (max === undefined ? downloaded : Math.min(downloaded, max))
  }, 0)
  const totalBytes = selectedGroup.estimatedTotalBytes
  const allCached =
    files.length > 0 &&
    files.every(
      (file) =>
        file.sizeBytes !== undefined &&
        file.downloadedBytes !== undefined &&
        file.downloadedBytes >= file.sizeBytes
    )
  const groupMatchesPersistedSelection =
    input.selectedGroupId === input.state.plan?.selectedGroupId ||
    input.selectedGroupId === input.plan?.selectedGroupId
  const status =
    allCached && groupMatchesPersistedSelection
      ? 'downloaded'
      : input.state.status === 'downloading' && groupMatchesPersistedSelection
        ? 'downloading'
        : input.state.status === 'paused' && completedBytes > 0
          ? 'paused'
          : input.state.status === 'error' && groupMatchesPersistedSelection
            ? 'error'
            : 'not-downloaded'
  const progress =
    totalBytes && totalBytes > 0
      ? Math.max(0, Math.min(1, completedBytes / totalBytes))
      : status === 'downloaded'
        ? 1
        : 0

  return {
    ...input.state,
    status,
    bytesDownloaded: completedBytes,
    totalBytes,
    progress,
    resumable: status === 'paused' || (completedBytes > 0 && completedBytes < (totalBytes ?? 0)),
    files,
  }
}

function LocalDownloadFilesCard({
  plan,
  state,
  selectedGroupId,
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
  state: LocalModelAssetState | null
  selectedGroupId?: string
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
  const groups = plan?.groups ?? state?.plan?.groups ?? []
  const selectedGroup =
    groups.find((group) => group.id === selectedGroupId) ??
    groups.find((group) => group.selected) ??
    null
  const planFiles = selectedGroup?.files ?? plan?.files ?? state?.plan?.files ?? []
  const stateFileByPath = new Map(state?.files.map((file) => [file.path, file]) ?? [])
  const displayFiles =
    planFiles.length > 0
      ? planFiles.map((file) => ({
          ...file,
          downloadedBytes: stateFileByPath.get(file.path)?.downloadedBytes,
        }))
      : (state?.files ?? [])

  return (
    <div className="space-y-3">
      {!loading && plan && !knownSize ? (
        <div className="text-amber-600">
          This model is not downloadable here until a concrete ONNX size is known.
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
            {loading ? (
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px] font-normal">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Resolving…
              </span>
            ) : plan ? (
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
                    <Play className="h-3.5 w-3.5" />
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
        {loading ? (
          <div className="text-muted-foreground mt-2 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading model files…
          </div>
        ) : isDeleting ? (
          <div className="text-muted-foreground mt-2 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Removing local model files…
          </div>
        ) : error ? (
          <div className="text-destructive mt-2 flex items-center gap-2 leading-5">
            <XCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : displayFiles.length > 0 ? (
          <>
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
          </>
        ) : (
          <div className="text-muted-foreground mt-2">No runtime download plan available.</div>
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
