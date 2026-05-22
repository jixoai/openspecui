import type {
  NmtModelAssetState,
  NmtModelCatalogItem,
  TranslationModelDownloadPlan,
} from '@openspecui/core/translator'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Settings } from './settings'

const {
  useConfigSubscriptionMock,
  useGlobalSettingsSubscriptionMock,
  staticModeMock,
  useServerStatusMock,
} = vi.hoisted(() => ({
  useConfigSubscriptionMock: vi.fn(),
  useGlobalSettingsSubscriptionMock: vi.fn(),
  staticModeMock: vi.fn(() => false),
  useServerStatusMock: vi.fn(),
}))

const tocRenderMock = vi.hoisted(() => vi.fn())

const { prepareBrowserTranslationMock, updateConfigMock, updateGlobalSettingsMock } = vi.hoisted(
  () => ({
    prepareBrowserTranslationMock: vi.fn(),
    updateConfigMock: vi.fn(),
    updateGlobalSettingsMock: vi.fn(),
  })
)

const browserTranslationMock = vi.hoisted(() => ({
  probe: vi.fn(async () => ({ availability: 'available' })),
  createExecution: vi.fn(() => ({
    factory: {
      create: vi.fn(async () => ({
        translate: vi.fn(async (input: string) => `browser:${input}`),
        destroy: vi.fn(),
      })),
    },
    cacheIdentity: {
      engineId: 'browser',
      translatorContractVersion: 1,
    },
  })),
}))

const { translationEnginesMock, nmtModelsMock, restoreTranslationMocks } = vi.hoisted(() => {
  const createDefaultNmtDownloadPlan = (modelId: string): TranslationModelDownloadPlan => ({
    modelId,
    estimatedTotalBytes: 246415360,
    selectedGroupId: 'q8',
    files: [
      { path: 'config.json', sizeBytes: 1503, required: true },
      { path: 'generation_config.json', sizeBytes: 293, required: true },
      { path: 'source.spm', sizeBytes: 806435, required: true },
      { path: 'target.spm', sizeBytes: 804600, required: true },
      { path: 'onnx/encoder_model_quantized.onnx', sizeBytes: 52848230, required: true },
      { path: 'onnx/decoder_model_merged_quantized.onnx', sizeBytes: 193567130, required: true },
    ],
    groups: [
      {
        id: 'q8',
        label: 'q8 (8-bit)',
        description: '8-bit quantized ONNX profile.',
        profile: 'q8',
        dtype: 'q8',
        estimatedTotalBytes: 246415360,
        selectable: true,
        selected: true,
        files: [
          { path: 'config.json', sizeBytes: 1503, required: true },
          { path: 'generation_config.json', sizeBytes: 293, required: true },
          { path: 'source.spm', sizeBytes: 806435, required: true },
          { path: 'target.spm', sizeBytes: 804600, required: true },
          { path: 'onnx/encoder_model_quantized.onnx', sizeBytes: 52848230, required: true },
          {
            path: 'onnx/decoder_model_merged_quantized.onnx',
            sizeBytes: 193567130,
            required: true,
          },
        ],
      },
      {
        id: 'fp16',
        label: 'fp16',
        description: 'fp16 ONNX profile.',
        profile: 'fp16',
        dtype: 'fp16',
        estimatedTotalBytes: 734003200,
        selectable: true,
        selected: false,
        files: [
          { path: 'config.json', sizeBytes: 1503, required: true },
          { path: 'generation_config.json', sizeBytes: 293, required: true },
          { path: 'source.spm', sizeBytes: 806435, required: true },
          { path: 'target.spm', sizeBytes: 804600, required: true },
          { path: 'onnx/encoder_model_fp16.onnx', sizeBytes: 209715200, required: true },
          { path: 'onnx/decoder_model_merged_fp16.onnx', sizeBytes: 524288000, required: true },
        ],
      },
    ],
  })
  const createDefaultNmtAssetState = (modelId: string): NmtModelAssetState => {
    const plan = createDefaultNmtDownloadPlan(modelId)
    return {
      modelId,
      status: 'not-downloaded',
      selected: true,
      progress: 0,
      resumable: false,
      plan,
      files: plan.files.map((file) => ({
        path: file.path,
        sizeBytes: file.sizeBytes,
        downloadedBytes: 0,
      })),
      updatedAt: 100,
    }
  }
  const createDefaultLocalModel = (): NmtModelCatalogItem => {
    const asset = createDefaultNmtAssetState('onnx-community/opus-mt-en-zh')
    return {
      id: 'onnx-community/opus-mt-en-zh',
      label: 'onnx-community/opus-mt-en-zh',
      summary: 'Previously selected local model. Estimated download 235 MB.',
      downloads: 0,
      likes: 0,
      tags: ['local'],
      compatibility: {
        transformersJs: true,
        onnx: true,
        localRuntimeVerified: true,
      },
      size: {
        estimatedTotalBytes: 246415360,
        primaryBytes: 246415360,
      },
      downloadGroups: asset.plan?.groups,
      languageMatch: {
        sourceMatched: false,
        targetMatched: true,
        directionalScore: 0,
      },
      asset,
      selectable: true,
      local: true,
    }
  }
  const createDefaultRemoteItems = (): NmtModelCatalogItem[] => [
    {
      id: 'onnx-community/opus-mt-en-zh',
      label: 'onnx-community/opus-mt-en-zh',
      summary:
        'Verified Transformers.js + ONNX model. Estimated download 235 MB. Tagged for translation.',
      downloads: 63,
      likes: 0,
      trendingScore: 4,
      tags: ['transformers.js', 'onnx', 'translation', 'en', 'zh'],
      compatibility: {
        transformersJs: true,
        onnx: true,
        localRuntimeVerified: true,
      },
      size: {
        estimatedTotalBytes: 246415360,
        primaryBytes: 246415360,
      },
      downloadGroups: [
        {
          id: 'q8',
          label: 'q8 (8-bit)',
          description: '8-bit quantized ONNX profile.',
          profile: 'q8',
          dtype: 'q8',
          estimatedTotalBytes: 246415360,
          selectable: true,
          selected: true,
          files: [
            { path: 'config.json', sizeBytes: 1503, required: true },
            { path: 'generation_config.json', sizeBytes: 293, required: true },
            { path: 'source.spm', sizeBytes: 806435, required: true },
            { path: 'target.spm', sizeBytes: 804600, required: true },
            { path: 'onnx/encoder_model_quantized.onnx', sizeBytes: 52848230, required: true },
            {
              path: 'onnx/decoder_model_merged_quantized.onnx',
              sizeBytes: 193567130,
              required: true,
            },
          ],
        },
        {
          id: 'fp16',
          label: 'fp16',
          description: 'fp16 ONNX profile.',
          profile: 'fp16',
          dtype: 'fp16',
          estimatedTotalBytes: 734003200,
          selectable: true,
          selected: false,
          files: [
            { path: 'config.json', sizeBytes: 1503, required: true },
            { path: 'generation_config.json', sizeBytes: 293, required: true },
            { path: 'source.spm', sizeBytes: 806435, required: true },
            { path: 'target.spm', sizeBytes: 804600, required: true },
            { path: 'onnx/encoder_model_fp16.onnx', sizeBytes: 209715200, required: true },
            {
              path: 'onnx/decoder_model_merged_fp16.onnx',
              sizeBytes: 524288000,
              required: true,
            },
          ],
        },
      ],
      languageMatch: {
        sourceMatched: false,
        targetMatched: true,
        directionalScore: 1,
      },
      asset: {
        modelId: 'onnx-community/opus-mt-en-zh',
        status: 'not-downloaded',
        selected: true,
        progress: 0,
        resumable: false,
        updatedAt: 100,
        files: [],
      },
      selectable: true,
      local: false,
    },
    {
      id: 'Xenova/unknown-model',
      label: 'Xenova/unknown-model',
      summary: 'Missing known file size.',
      downloads: 10,
      likes: 1,
      tags: ['transformers.js', 'onnx', 'translation'],
      compatibility: {
        transformersJs: true,
        onnx: true,
        localRuntimeVerified: true,
      },
      size: {
        estimatedTotalBytes: undefined,
        primaryBytes: undefined,
      },
      downloadGroups: [
        {
          id: 'q8',
          label: 'q8 (8-bit)',
          description: '8-bit quantized ONNX profile.',
          profile: 'q8',
          dtype: 'q8',
          selectable: false,
          selected: false,
          files: [
            { path: 'onnx/encoder_model_quantized.onnx', required: true },
            { path: 'onnx/decoder_model_merged_quantized.onnx', required: true },
          ],
        },
      ],
      languageMatch: {
        sourceMatched: false,
        targetMatched: true,
        directionalScore: 1,
      },
      asset: {
        modelId: 'Xenova/unknown-model',
        status: 'not-downloaded',
        selected: false,
        updatedAt: 100,
        resumable: false,
        files: [],
      },
      selectable: false,
      local: false,
    },
  ]
  const translationEnginesMock = {
    install: vi.fn(),
    cancelInstall: vi.fn(),
    subscribeLogs: vi.fn(() => ({ unsubscribe: vi.fn() })),
    getModelDownloadPlan: vi.fn(),
    translate: vi.fn(),
  }
  const nmtModelsMock = {
    listLocal: vi.fn(),
    searchRemote: vi.fn(),
    searchRemoteStream: vi.fn(
      (
        input: { requestId: string; query?: string; targetLanguage?: string; limit?: number },
        handlers: {
          onData: (event: {
            requestId: string
            phase: 'candidates' | 'enriched' | 'complete' | 'error'
            items?: NmtModelCatalogItem[]
          }) => void
          onError?: (error: unknown) => void
        }
      ) => {
        const unsubscribe = vi.fn()
        queueMicrotask(async () => {
          if (unsubscribe.mock.calls.length > 0) return
          const remote = (await nmtModelsMock.searchRemote()) as { items: NmtModelCatalogItem[] }
          handlers.onData({
            requestId: input.requestId,
            phase: 'candidates',
            items: remote.items.map((item) => ({ ...item, downloadGroups: undefined })),
          })
          if (unsubscribe.mock.calls.length > 0) return
          handlers.onData({
            requestId: input.requestId,
            phase: 'enriched',
            items: remote.items,
          })
          if (unsubscribe.mock.calls.length > 0) return
          handlers.onData({
            requestId: input.requestId,
            phase: 'complete',
            items: remote.items,
          })
        })
        return { unsubscribe }
      }
    ),
    state: vi.fn(),
    subscribeLogs: vi.fn(() => ({ unsubscribe: vi.fn() })),
    markSelected: vi.fn(async () => ({ success: true })),
    download: vi.fn(async () => ({ sessionId: 'session-1' })),
    pause: vi.fn(async () => ({ success: true })),
    resume: vi.fn(async () => ({ sessionId: 'session-2' })),
    delete: vi.fn(async () => ({ success: true })),
  }
  const restoreTranslationMocks = () => {
    translationEnginesMock.getModelDownloadPlan.mockImplementation(
      async ({ model }: { model: string }): Promise<TranslationModelDownloadPlan | null> =>
        createDefaultNmtDownloadPlan(model)
    )
    translationEnginesMock.translate.mockImplementation(async ({ text }: { text?: string }) => ({
      text: `server:${text ?? ''}`,
    }))
    nmtModelsMock.listLocal.mockImplementation(
      async (): Promise<{ items: NmtModelCatalogItem[] }> => ({
        items: [createDefaultLocalModel()],
      })
    )
    nmtModelsMock.searchRemote.mockImplementation(
      async (): Promise<{ items: NmtModelCatalogItem[] }> => ({
        items: createDefaultRemoteItems(),
      })
    )
    nmtModelsMock.state.mockImplementation(
      async ({ modelId }: { modelId: string }): Promise<NmtModelAssetState> =>
        createDefaultNmtAssetState(modelId)
    )
  }
  restoreTranslationMocks()
  return { translationEnginesMock, nmtModelsMock, restoreTranslationMocks }
})

function dispatchPopoverToggle(element: Element, newState: 'open' | 'closed') {
  const event = new Event('toggle')
  Object.defineProperty(event, 'newState', {
    value: newState,
  })
  Object.defineProperty(event, 'oldState', {
    value: newState === 'open' ? 'closed' : 'open',
  })
  fireEvent(element, event)
}

function createQ8PlanFilesForTest(): TranslationModelDownloadPlan['files'] {
  return [
    { path: 'config.json', sizeBytes: 1503, required: true },
    { path: 'generation_config.json', sizeBytes: 293, required: true },
    { path: 'source.spm', sizeBytes: 806435, required: true },
    { path: 'target.spm', sizeBytes: 804600, required: true },
    { path: 'onnx/encoder_model_quantized.onnx', sizeBytes: 52848230, required: true },
    { path: 'onnx/decoder_model_merged_quantized.onnx', sizeBytes: 193567130, required: true },
  ]
}

function createQ8PlanForTest(modelId: string): TranslationModelDownloadPlan {
  return {
    modelId,
    estimatedTotalBytes: 246415360,
    selectedGroupId: 'q8',
    files: createQ8PlanFilesForTest(),
    groups: [
      {
        id: 'q8',
        label: 'q8 (8-bit)',
        description: '8-bit quantized ONNX profile.',
        profile: 'q8',
        dtype: 'q8',
        estimatedTotalBytes: 246415360,
        selectable: true,
        selected: true,
        files: createQ8PlanFilesForTest(),
      },
    ],
  }
}

function createFp16PlanFilesForTest(): TranslationModelDownloadPlan['files'] {
  return [
    { path: 'config.json', sizeBytes: 1503, required: true },
    { path: 'generation_config.json', sizeBytes: 293, required: true },
    { path: 'source.spm', sizeBytes: 806435, required: true },
    { path: 'target.spm', sizeBytes: 804600, required: true },
    { path: 'onnx/encoder_model_fp16.onnx', sizeBytes: 209715200, required: true },
    { path: 'onnx/decoder_model_merged_fp16.onnx', sizeBytes: 524288000, required: true },
  ]
}

function createGroupedNmtPlanForTest(modelId: string): TranslationModelDownloadPlan {
  const q8Files = createQ8PlanFilesForTest()
  const fp16Files = createFp16PlanFilesForTest()
  return {
    modelId,
    estimatedTotalBytes: 246415360,
    selectedGroupId: 'q8',
    files: q8Files,
    groups: [
      {
        id: 'q8',
        label: 'q8 (8-bit)',
        description: '8-bit quantized ONNX profile.',
        profile: 'q8',
        dtype: 'q8',
        estimatedTotalBytes: 246415360,
        selectable: true,
        selected: true,
        files: q8Files,
      },
      {
        id: 'fp16',
        label: 'fp16',
        description: 'fp16 ONNX profile.',
        profile: 'fp16',
        dtype: 'fp16',
        estimatedTotalBytes: 734003200,
        selectable: true,
        selected: false,
        files: fp16Files,
      },
    ],
  }
}

function createQ8AssetFilesForTest(
  downloadedBytesByPath: Partial<Record<string, number>>
): NmtModelAssetState['files'] {
  return createQ8PlanFilesForTest().map((file) => ({
    path: file.path,
    sizeBytes: file.sizeBytes,
    downloadedBytes: downloadedBytesByPath[file.path] ?? 0,
  }))
}

function createDownloadedQ8AssetFilesForTest(): NmtModelAssetState['files'] {
  return createQ8PlanFilesForTest().map((file) => ({
    path: file.path,
    sizeBytes: file.sizeBytes,
    downloadedBytes: file.sizeBytes,
  }))
}

function createDownloadedLocalNmtModelForTest(modelId: string): NmtModelCatalogItem {
  const plan = createGroupedNmtPlanForTest(modelId)
  return {
    id: modelId,
    label: modelId,
    summary: 'Downloaded local model.',
    downloads: 0,
    likes: 0,
    tags: ['local'],
    compatibility: {
      transformersJs: true,
      onnx: true,
      localRuntimeVerified: true,
    },
    size: {
      estimatedTotalBytes: 246415360,
      primaryBytes: 246415360,
    },
    downloadGroups: plan.groups,
    languageMatch: {
      sourceMatched: false,
      targetMatched: true,
      directionalScore: 0,
    },
    asset: {
      modelId,
      status: 'downloaded',
      selected: true,
      progress: 1,
      bytesDownloaded: 246415360,
      totalBytes: 246415360,
      resumable: false,
      plan,
      files: createDownloadedQ8AssetFilesForTest(),
      updatedAt: 100,
    },
    selectable: true,
    local: true,
  }
}

function getTranslationTargetLanguageDialog() {
  return screen.getByRole('dialog', { name: 'Select translation target language' })
}

vi.mock('@tanstack/react-query', () => ({
  useMutation: ({ mutationFn }: { mutationFn?: (variables: unknown) => unknown }) => ({
    mutate: vi.fn((variables: unknown) => {
      mutationFn?.(variables)
    }),
    isPending: false,
    isSuccess: false,
  }),
  useQuery: ({ queryKey }: { queryKey?: readonly string[] }) => {
    const key = queryKey?.join('.') ?? ''
    if (key === 'cli.getAllTools') {
      return { data: [{ value: 'claude', name: 'Claude', available: true }], isLoading: false }
    }
    if (key === 'cli.getDetectedProjectTools') {
      return { data: [{ value: 'claude', name: 'Claude' }], isLoading: false, refetch: vi.fn() }
    }
    if (key === 'cli.getProfileState') {
      return {
        data: {
          available: true,
          delivery: 'both',
          workflows: [],
          profile: 'core',
          driftStatus: 'in-sync',
          warningText: null,
        },
        isLoading: false,
        refetch: vi.fn(),
      }
    }
    if (key === 'cli.getToolInitStates') {
      return {
        data: [
          {
            toolId: 'claude',
            toolName: 'Claude',
            status: 'uninitialized',
            hasAnyArtifacts: false,
            expectedSkillCount: 0,
            presentExpectedSkillCount: 0,
            detectedSkillCount: 0,
            expectedCommandCount: 0,
            presentExpectedCommandCount: 0,
            detectedCommandCount: 0,
            missingSkillWorkflows: [],
            missingCommandWorkflows: [],
            unexpectedSkillWorkflows: [],
            unexpectedCommandWorkflows: [],
            legacyCommandWorkflows: [],
          },
        ],
        refetch: vi.fn(),
      }
    }
    if (key === 'cli.sniffGlobalCli') {
      return { data: { hasGlobal: true, version: '1.3.0', hasUpdate: false }, isLoading: false }
    }
    if (key === 'cli.checkAvailability') {
      return { data: { available: true, version: '1.3.0' }, isLoading: false, refetch: vi.fn() }
    }
    if (key === 'config.getEffectiveCliCommand') {
      return { data: 'openspec', refetch: vi.fn() }
    }
    if (key === 'config.get') {
      return {
        data: useConfigSubscriptionMock().data,
        isLoading: false,
        refetch: vi.fn(),
      }
    }
    if (key === 'globalSettings.get') {
      return {
        data: {
          translationCache: { entryLimit: 10000 },
          translationEngines: {
            extensions: {
              engines: {
                nmt: { status: 'not-installed' },
                ai: { status: 'not-installed' },
              },
            },
            ai: { baseUrl: '', token: '', model: 'gpt-4.1-mini' },
            nmt: { model: 'Xenova/opus-mt-no-de', selectedGroupId: 'q8', hfEndpoint: '' },
          },
        },
        refetch: vi.fn(),
      }
    }
    if (key === 'translationEngines.list') {
      return {
        data: [
          {
            id: 'browser',
            label: 'Browser',
            description: 'Uses the browser Translator API and future browser-side providers.',
            technicalSummary:
              'Browser-native Web Translator adapter. Package payload is about 5 KB; browser language packs are managed by the browser.',
            runtime: 'browser',
            builtin: true,
            installable: false,
            selected: true,
            status: 'available',
          },
          {
            id: 'nmt',
            label: 'NMT',
            description: 'Runs a local server-side neural machine translation model.',
            technicalSummary:
              'Server-side Transformers.js NMT adapter. Package payload is about 5 KB; the selected model is downloaded separately and can be hundreds of MB.',
            runtime: 'server',
            builtin: false,
            installable: true,
            selected: false,
            status: 'not-installed',
            model: 'Xenova/opus-mt-no-de',
          },
          {
            id: 'ai',
            label: 'AI',
            description:
              'Uses an OpenAI-compatible TanStack AI provider for context-aware translation.',
            technicalSummary:
              'Server-side TanStack AI adapter for OpenAI-compatible APIs. Package payload is about 5 KB; model size stays with the remote provider.',
            runtime: 'server',
            builtin: false,
            installable: true,
            selected: false,
            status: 'available',
            model: 'gpt-4.1-mini',
          },
        ],
        isLoading: false,
        refetch: vi.fn(),
      }
    }
    if (key === 'nmtModels.listLocal') {
      return { data: undefined, isLoading: false, refetch: vi.fn() }
    }
    if (key === 'nmtModels.searchRemote') {
      return { data: undefined, isLoading: false, refetch: vi.fn() }
    }
    if (key === 'translationCache.stats') {
      return { data: { enabled: false, entryLimit: 10000, entries: 0 }, refetch: vi.fn() }
    }
    return { data: undefined, isLoading: false, refetch: vi.fn() }
  },
}))

vi.mock('@/components/terminal/terminal-invocation-settings', () => ({
  TerminalInvocationSettings: () => <div data-testid="terminal-invocation-settings" />,
}))

vi.mock('@/components/notifications/notification-settings', () => ({
  NotificationSettings: () => <div data-testid="notification-settings" />,
}))

vi.mock('@/components/sound-setting-control', () => ({
  SoundSettingControl: () => <div data-testid="sound-setting-control" />,
}))

vi.mock('@/components/cli-terminal', () => ({
  CliTerminal: () => <div data-testid="cli-terminal" />,
}))

vi.mock('@/components/toc', () => ({
  generateTimelineScope: () => '',
  Toc: ({ className, items }: { className?: string; items: { id: string; label: string }[] }) => {
    tocRenderMock({ className, itemIds: items.map((item) => item.id) })
    return <aside data-testid="settings-toc" className={className} />
  },
  TocSection: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
}))

vi.mock('@/lib/browser-translation', () => ({
  createBrowserTranslationExecution: browserTranslationMock.createExecution,
  prepareBrowserTranslation: prepareBrowserTranslationMock,
  probeBrowserTranslation: browserTranslationMock.probe,
}))

vi.mock('@/lib/static-mode', () => ({
  getBasePath: () => '/',
  isStaticMode: () => staticModeMock(),
}))

vi.mock('@/lib/use-server-status', () => ({
  useServerStatus: () => useServerStatusMock(),
}))

vi.mock('@/lib/use-subscription', () => ({
  useConfigSubscription: () => useConfigSubscriptionMock(),
  useGlobalSettingsSubscription: () => useGlobalSettingsSubscriptionMock(),
}))

vi.mock('@/lib/use-cli-runner', () => ({
  useCliRunner: () => ({
    lines: [],
    status: 'idle',
    commands: {
      replaceAll: vi.fn(),
      runAll: vi.fn(),
    },
    cancel: vi.fn(),
    reset: vi.fn(),
  }),
}))

vi.mock('@/lib/terminal-bell-sound-engine', () => ({
  TerminalBellSoundEngine: class {
    init(): void {}
    async play(): Promise<void> {}
  },
}))

vi.mock('@/lib/terminal-controller', () => {
  return {
    GOOGLE_FONT_PRESETS: [],
    TERMINAL_RENDERER_ENGINES: ['xterm'],
    isTerminalRendererEngine: (value: string): value is 'xterm' => value === 'xterm',
    terminalController: {
      getConfig: () => ({
        fontSize: 13,
        fontFamily: '',
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 1000,
        useTheme: 'app',
        lightTheme: 'default-light',
        darkTheme: 'default-dark',
        rendererEngine: 'xterm',
        bellSound: 'builtin:Blow',
        bellVolume: 1,
      }),
      applyConfig: vi.fn(),
      setRendererEngine: vi.fn(),
    },
  }
})

vi.mock('@/lib/api-config', () => ({
  getApiBaseUrl: () => '',
}))

vi.mock('@/lib/theme', () => ({
  applyTheme: vi.fn(),
  getStoredTheme: () => 'system',
  persistTheme: vi.fn(),
}))

vi.mock('@/lib/trpc', () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
  },
  trpc: {
    cli: {
      sniffGlobalCli: {
        queryOptions: () => ({ queryKey: ['cli.getAllTools'] }),
        queryFilter: () => ({ queryKey: ['cli.sniffGlobalCli'] }),
      },
      checkAvailability: {
        queryOptions: () => ({ queryKey: ['cli.checkAvailability'] }),
        queryFilter: () => ({ queryKey: ['cli.checkAvailability'] }),
      },
      getAllTools: {
        queryOptions: () => ({ queryKey: ['cli.getAllTools'] }),
      },
      getDetectedProjectTools: {
        queryOptions: () => ({ queryKey: ['cli.getDetectedProjectTools'] }),
      },
      getProfileState: {
        queryOptions: () => ({ queryKey: ['cli.getProfileState'] }),
      },
      getToolInitStates: {
        queryOptions: () => ({ queryKey: ['cli.getToolInitStates'] }),
      },
    },
    config: {
      get: {
        queryOptions: () => ({ queryKey: ['config.get'] }),
      },
      getEffectiveCliCommand: {
        queryOptions: () => ({ queryKey: ['config.getEffectiveCliCommand'] }),
        queryFilter: () => ({ queryKey: ['config.getEffectiveCliCommand'] }),
      },
    },
    globalSettings: {
      get: {
        queryOptions: () => ({ queryKey: ['globalSettings.get'] }),
      },
    },
    translationCache: {
      stats: {
        queryOptions: () => ({ queryKey: ['translationCache.stats'] }),
      },
    },
    translationEngines: {
      list: {
        queryOptions: () => ({ queryKey: ['translationEngines.list'] }),
      },
    },
    nmtModels: {
      listLocal: {
        queryOptions: () => ({ queryKey: ['nmtModels.listLocal'] }),
      },
      searchRemote: {
        queryOptions: () => ({ queryKey: ['nmtModels.searchRemote'] }),
      },
      state: {
        queryOptions: () => ({ queryKey: ['nmtModels.state'] }),
      },
    },
  },
  trpcClient: {
    cli: {
      execute: {
        mutate: vi.fn(),
      },
    },
    config: {
      update: {
        mutate: updateConfigMock,
      },
    },
    globalSettings: {
      update: {
        mutate: updateGlobalSettingsMock,
      },
    },
    translationCache: {
      clean: {
        mutate: vi.fn(),
      },
      clear: {
        mutate: vi.fn(),
      },
    },
    translationEngines: {
      subscribeLogs: {
        subscribe: translationEnginesMock.subscribeLogs,
      },
      getModelDownloadPlan: {
        query: translationEnginesMock.getModelDownloadPlan,
      },
      install: {
        mutate: translationEnginesMock.install,
      },
      cancelInstall: {
        mutate: translationEnginesMock.cancelInstall,
      },
      translate: {
        mutate: translationEnginesMock.translate,
      },
    },
    nmtModels: {
      listLocal: {
        query: nmtModelsMock.listLocal,
      },
      searchRemote: {
        query: nmtModelsMock.searchRemote,
      },
      searchRemoteStream: {
        subscribe: nmtModelsMock.searchRemoteStream,
      },
      state: {
        query: nmtModelsMock.state,
      },
      subscribeLogs: {
        subscribe: nmtModelsMock.subscribeLogs,
      },
      markSelected: {
        mutate: nmtModelsMock.markSelected,
      },
      download: {
        mutate: nmtModelsMock.download,
      },
      pause: {
        mutate: nmtModelsMock.pause,
      },
      resume: {
        mutate: nmtModelsMock.resume,
      },
      delete: {
        mutate: nmtModelsMock.delete,
      },
    },
  },
}))

describe('Settings', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    restoreTranslationMocks()
    vi.clearAllMocks()
    vi.useRealTimers()
  })
  beforeEach(() => {
    useGlobalSettingsSubscriptionMock.mockReturnValue({
      data: {
        translationCache: { entryLimit: 10000 },
        translationEngines: {
          extensions: {
            engines: {
              nmt: { status: 'not-installed' },
              ai: { status: 'not-installed' },
            },
          },
          ai: { baseUrl: '', token: '', model: 'gpt-4.1-mini' },
          nmt: { model: 'Xenova/opus-mt-no-de', selectedGroupId: 'q8', hfEndpoint: '' },
        },
      },
      isLoading: false,
      error: null,
    })
  })

  it('renders force init as the shared Switch control', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({ data: {} })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    const forceSwitch = await screen.findByRole('switch', { name: 'Force non-interactive init' })
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())

    expect(forceSwitch).toHaveAttribute('aria-checked', 'true')
    expect(forceSwitch.className).toContain('w-11')
  })

  it('renders translation settings and initializes browser support when enabled', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    prepareBrowserTranslationMock.mockResolvedValue({ availability: 'available' })
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(screen.getByRole('heading', { name: 'Translation' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Translation target language' })).toHaveTextContent(
      'Chinese 中文'
    )
    expect(screen.getByRole('button', { name: 'Direct' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bilingual' })).toBeTruthy()
    expect(
      screen.getByText(/Package payload is about 5 KB; browser language packs are managed/)
    ).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Enable translation cache' })).toBeTruthy()

    fireEvent.click(screen.getByRole('switch', { name: 'Enable document translation' }))

    await waitFor(() =>
      expect(updateConfigMock).toHaveBeenCalledWith({ translation: { enabled: true } })
    )
    await waitFor(() =>
      expect(prepareBrowserTranslationMock).toHaveBeenCalledWith('zh', expect.any(AbortSignal))
    )
  })

  it('checks browser translation capability automatically after selecting the browser engine', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    browserTranslationMock.probe.mockResolvedValue({ availability: 'available' })
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'nmt',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(browserTranslationMock.probe).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('combobox', { name: 'Engine' }))
    const browserOption = await screen.findByRole('option', { name: 'Browser' })
    fireEvent.mouseMove(browserOption)
    fireEvent.click(browserOption)

    await waitFor(() =>
      expect(updateConfigMock).toHaveBeenCalledWith({ translation: { engineId: 'browser' } })
    )
    await waitFor(() => expect(browserTranslationMock.probe).toHaveBeenCalledWith('zh'))
    expect(prepareBrowserTranslationMock).not.toHaveBeenCalled()
  })

  it('restores the persisted NMT engine before probing browser capability', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'nmt',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(screen.getByRole('combobox', { name: 'Engine' })).toHaveTextContent('NMT')
    expect(browserTranslationMock.probe).not.toHaveBeenCalled()
  })

  it('uses project NMT model settings before global settings resolve', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useGlobalSettingsSubscriptionMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'nmt',
          engines: {
            nmt: { model: 'Xenova/opus-mt-en-zh', selectedGroupId: 'fp16' },
            ai: {},
          },
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(screen.getByRole('combobox', { name: 'Engine' })).toHaveTextContent('NMT')
    expect(screen.getByRole('button', { name: 'NMT model' })).toHaveTextContent(
      'Xenova/opus-mt-en-zh'
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /fp16/i })).toHaveTextContent('700 MB')
    )
    expect(translationEnginesMock.getModelDownloadPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'Xenova/opus-mt-en-zh',
        selectedGroupId: 'fp16',
      })
    )
  })

  it('uses global install state while the engine list is still resolving', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useGlobalSettingsSubscriptionMock.mockReturnValue({
      data: {
        translationCache: { entryLimit: 10000 },
        translationEngines: {
          extensions: {
            engines: {
              nmt: {
                status: 'installed',
                version: '^3.7.2',
                message: 'Using local workspace package.',
                updatedAt: 100,
              },
              ai: { status: 'not-installed' },
            },
          },
          ai: { baseUrl: '', token: '', model: 'gpt-4.1-mini' },
          nmt: { model: 'Xenova/opus-mt-en-zh', selectedGroupId: 'q8', hfEndpoint: '' },
        },
      },
      isLoading: false,
      error: null,
    })
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'nmt',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(screen.getByRole('combobox', { name: 'Engine' })).toHaveTextContent('NMT')
    expect(screen.getByText('Using local workspace package.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Install' })).toBeNull()
  })

  it('hides engine progress after a service engine is already installed', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'ai',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(screen.getAllByRole('button', { name: 'Installed' }).length).toBeGreaterThan(0)
    expect(screen.queryByText('Install')).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('searches NMT models through the autocomplete popover and shows the download plan', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'nmt',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'NMT model' }))
    dispatchPopoverToggle(screen.getByRole('dialog', { name: 'Select NMT model' }), 'open')
    const input = screen.getByRole('textbox', { name: 'Search NMT models' })
    fireEvent.change(input, { target: { value: 'opus' } })

    await waitFor(() =>
      expect(nmtModelsMock.searchRemoteStream).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'opus', targetLanguage: 'de' }),
        expect.any(Object)
      )
    )
    expect(
      await screen.findByRole('option', { name: /onnx-community\/opus-mt-en-zh/ })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('option', { name: /onnx-community\/opus-mt-en-zh/ }))

    await waitFor(() => {
      expect(screen.getByText(/Download files/i)).toBeTruthy()
      expect(screen.getAllByText('235 MB').length).toBeGreaterThan(0)
    })
    expect(nmtModelsMock.listLocal).toHaveBeenCalled()
    await waitFor(() => expect(nmtModelsMock.searchRemoteStream).toHaveBeenCalled())
    expect(translationEnginesMock.getModelDownloadPlan).toHaveBeenCalled()
    expect(screen.getAllByText(/q8/).length).toBeGreaterThan(0)
    expect(screen.getByText('NMT Model')).toBeTruthy()
  })

  it('saves the NMT Hugging Face endpoint from the advanced provider popover', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'nmt',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'NMT provider settings' }))
    dispatchPopoverToggle(screen.getByRole('dialog', { name: 'NMT provider settings' }), 'open')
    const endpointInput = screen.getByLabelText('HF Endpoint')
    fireEvent.change(endpointInput, { target: { value: 'https://hf-mirror.com' } })
    fireEvent.keyDown(endpointInput, { key: 'Enter' })

    await waitFor(() =>
      expect(updateGlobalSettingsMock).toHaveBeenCalledWith({
        translationEngines: { nmt: { hfEndpoint: 'https://hf-mirror.com' } },
      })
    )
  })

  it('shows plan loading and a single-line NMT status message', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    translationEnginesMock.getModelDownloadPlan.mockImplementation(
      async () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                modelId: 'onnx-community/opus-mt-en-zh',
                estimatedTotalBytes: 246415360,
                selectedGroupId: 'q8',
                files: [
                  {
                    path: 'onnx/encoder_model_quantized.onnx',
                    sizeBytes: 52848230,
                    required: true,
                  },
                  {
                    path: 'onnx/decoder_model_merged_quantized.onnx',
                    sizeBytes: 193567130,
                    required: true,
                  },
                ],
                groups: [
                  {
                    id: 'q8',
                    label: 'q8 (8-bit)',
                    description: '8-bit quantized ONNX profile.',
                    profile: 'q8',
                    dtype: 'q8',
                    estimatedTotalBytes: 246415360,
                    selectable: true,
                    selected: true,
                    files: [
                      {
                        path: 'onnx/encoder_model_quantized.onnx',
                        sizeBytes: 52848230,
                        required: true,
                      },
                      {
                        path: 'onnx/decoder_model_merged_quantized.onnx',
                        sizeBytes: 193567130,
                        required: true,
                      },
                    ],
                  },
                ],
              }),
            20
          )
        )
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'nmt',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())

    expect(screen.getByText('Download files')).toBeTruthy()
    expect(screen.getByText('Resolving download profiles…')).toBeTruthy()
    expect(screen.getByText('Resolving…')).toBeTruthy()
    expect(screen.getAllByText(/Not downloaded/).length).toBeLessThanOrEqual(1)
  })

  it('shows a circular download control for an uninstalled NMT model and keeps unknown-size models disabled', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'nmt',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    const downloadButton = await screen.findByRole('button', { name: 'Download model' })
    expect(downloadButton).toHaveAttribute('data-nmt-plan-action', 'download')
    expect(downloadButton.className).not.toContain('group')
    expect(screen.queryByRole('button', { name: 'Pause download' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'NMT model' }))
    dispatchPopoverToggle(screen.getByRole('dialog', { name: 'Select NMT model' }), 'open')
    const disabledOption = await screen.findByRole('option', { name: /Xenova\/unknown-model/ })
    expect(disabledOption).toHaveAttribute('disabled')
  })

  it('only exposes the hover pause affordance while an NMT model is downloading', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    nmtModelsMock.state.mockImplementation(async () => ({
      modelId: 'Xenova/opus-mt-no-de',
      status: 'downloading',
      selected: true,
      progress: 0.42,
      bytesDownloaded: 103494451,
      totalBytes: 246415360,
      resumable: true,
      plan: createQ8PlanForTest('Xenova/opus-mt-no-de'),
      files: createQ8AssetFilesForTest({
        'config.json': 1503,
        'generation_config.json': 293,
        'source.spm': 806435,
        'target.spm': 804600,
        'onnx/encoder_model_quantized.onnx': 52848230,
        'onnx/decoder_model_merged_quantized.onnx': 50646221,
      }),
      updatedAt: 100,
    }))
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'nmt',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    const pauseButton = await screen.findByRole('button', { name: 'Pause download' })
    expect(pauseButton).toHaveAttribute('data-nmt-plan-action', 'pause')
    expect(pauseButton.className).toContain('group')
    expect(within(pauseButton).getByText('43%').className).toContain('group-hover:hidden')
    expect(
      within(screen.getByLabelText('NMT download profiles')).getByRole('button', { name: /q8/i })
        .className
    ).toContain('border-dashed')
    expect(screen.queryByRole('button', { name: 'Download model' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Resume download' })).toBeNull()
  })

  it('uses only the outer progress ring for downloaded NMT action styling', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    nmtModelsMock.state.mockImplementation(async () => ({
      modelId: 'Xenova/opus-mt-no-de',
      status: 'downloaded',
      selected: true,
      progress: 1,
      bytesDownloaded: 246415360,
      totalBytes: 246415360,
      resumable: false,
      plan: createQ8PlanForTest('Xenova/opus-mt-no-de'),
      files: createDownloadedQ8AssetFilesForTest(),
      updatedAt: 100,
    }))
    nmtModelsMock.listLocal.mockResolvedValueOnce({
      items: [createDownloadedLocalNmtModelForTest('Xenova/opus-mt-no-de')],
    })
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'nmt',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    const downloadedAction = await screen.findByLabelText('Downloaded', {
      selector: '[data-nmt-plan-action="downloaded"]',
    })
    expect(downloadedAction).toHaveAttribute('data-nmt-plan-action', 'downloaded')
    expect(downloadedAction.className).not.toContain('shadow')
    expect(downloadedAction.className).not.toContain('border')
    const deleteButton = screen.getByRole('button', { name: 'Delete model' })
    expect(deleteButton.className).not.toContain('border')
    expect(deleteButton.className).not.toContain('shadow')
  })

  it('switches the displayed download file list when a different NMT profile chip is selected', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'nmt',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(await screen.findByText('config.json')).toBeTruthy()
    expect(await screen.findByText('onnx/encoder_model_quantized.onnx')).toBeTruthy()
    expect(screen.queryByText('onnx/encoder_model_fp16.onnx')).toBeNull()

    const fp16Chip = screen.getByRole('button', { name: /fp16/i })
    expect(fp16Chip).toHaveTextContent('700 MB')
    fireEvent.click(fp16Chip)

    expect(await screen.findByText('config.json')).toBeTruthy()
    expect(await screen.findByText('onnx/encoder_model_fp16.onnx')).toBeTruthy()
    expect(screen.getByText('onnx/decoder_model_merged_fp16.onnx')).toBeTruthy()
    expect(screen.queryByText('onnx/encoder_model_quantized.onnx')).toBeNull()
  })

  it('renders NMT profile chips under the model selector instead of inside Download files', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'nmt',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    const modelButton = await screen.findByRole('button', { name: 'NMT model' })
    const downloadFiles = screen.getByText('Download files')
    const profileList = await screen.findByLabelText('NMT download profiles')
    const q8Chip = within(profileList).getByRole('button', { name: /q8/i })
    const fp16Chip = within(profileList).getByRole('button', { name: /fp16/i })

    expect(
      modelButton.compareDocumentPosition(profileList) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(
      profileList.compareDocumentPosition(downloadFiles) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(
      within(downloadFiles.closest('div') ?? document.body).queryByRole('button', { name: /q8/i })
    ).toBeNull()
    expect(q8Chip).toHaveTextContent('235 MB')
    expect(fp16Chip).toHaveTextContent('700 MB')
  })

  it('does not treat an uninstalled NMT profile as downloaded when another profile is cached', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    nmtModelsMock.state.mockImplementation(async () => ({
      modelId: 'Xenova/opus-mt-no-de',
      status: 'downloaded',
      selected: true,
      progress: 1,
      bytesDownloaded: 246415360,
      totalBytes: 246415360,
      resumable: false,
      plan: createQ8PlanForTest('Xenova/opus-mt-no-de'),
      files: createDownloadedQ8AssetFilesForTest(),
      updatedAt: 100,
    }))
    nmtModelsMock.listLocal.mockResolvedValueOnce({
      items: [createDownloadedLocalNmtModelForTest('Xenova/opus-mt-no-de')],
    })
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'nmt',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(
      await screen.findByLabelText('Downloaded', {
        selector: '[data-nmt-plan-action="downloaded"]',
      })
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /fp16/i }))

    expect(await screen.findByText('onnx/encoder_model_fp16.onnx')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Download model' })).toHaveAttribute(
      'data-nmt-plan-action',
      'download'
    )
    expect(
      within(screen.getByLabelText('NMT download profiles')).getByRole('button', { name: /fp16/i })
    ).toHaveTextContent('700 MB')
    const profileList = screen.getByLabelText('NMT download profiles')
    expect(within(profileList).getByRole('button', { name: /q8/i }).className).toContain(
      'border-solid'
    )
    expect(within(profileList).getByRole('button', { name: /fp16/i }).className).toContain(
      'border-dashed'
    )
    expect(screen.queryByLabelText('Downloaded', { selector: '[data-nmt-plan-action]' })).toBeNull()
  })

  it('locks deleting state and hides resume/delete actions while removal is in progress', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    nmtModelsMock.state.mockImplementation(async () => ({
      modelId: 'Xenova/opus-mt-no-de',
      status: 'deleting',
      selected: true,
      progress: 0.42,
      resumable: false,
      plan: createQ8PlanForTest('Xenova/opus-mt-no-de'),
      files: createQ8AssetFilesForTest({
        'onnx/encoder_model_quantized.onnx': 22196257,
        'onnx/decoder_model_merged_quantized.onnx': 81298194,
      }),
      updatedAt: 100,
    }))
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'nmt',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(screen.queryByRole('button', { name: 'Resume download' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete model' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Pause download' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Download model' })).toBeNull()
  })

  it('renders downloaded NMT plan as a ready card when runtime plan is unavailable', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    translationEnginesMock.getModelDownloadPlan.mockResolvedValueOnce(null)
    nmtModelsMock.state.mockImplementationOnce(async () => ({
      modelId: 'Xenova/opus-mt-no-de',
      status: 'downloaded',
      selected: true,
      progress: 1,
      bytesDownloaded: 246415360,
      totalBytes: 246415360,
      resumable: false,
      files: createDownloadedQ8AssetFilesForTest(),
      updatedAt: 100,
    }))
    nmtModelsMock.listLocal.mockResolvedValueOnce({
      items: [createDownloadedLocalNmtModelForTest('Xenova/opus-mt-no-de')],
    })
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'nmt',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(await screen.findByText('config.json')).toBeTruthy()
    expect(await screen.findByText('onnx/encoder_model_quantized.onnx')).toBeTruthy()
    expect(screen.queryByText('Local NMT model files are ready.')).toBeNull()
    expect(screen.queryByText('No runtime download plan available.')).toBeNull()
    expect(
      screen.getByLabelText('Downloaded', { selector: '[data-nmt-plan-action="downloaded"]' })
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete model' })).toBeTruthy()
  })

  it('loads downloaded NMT chips from local state before runtime plan resolution', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    translationEnginesMock.getModelDownloadPlan.mockImplementation(async () => {
      throw new Error('network should not block local truth')
    })
    const localPlan = createQ8PlanForTest('Xenova/opus-mt-no-de')
    const localAsset: NmtModelAssetState = {
      modelId: 'Xenova/opus-mt-no-de',
      status: 'downloaded',
      selected: true,
      progress: 1,
      bytesDownloaded: 246415360,
      totalBytes: 246415360,
      resumable: false,
      plan: localPlan,
      files: createDownloadedQ8AssetFilesForTest(),
      updatedAt: 100,
    }
    nmtModelsMock.listLocal.mockResolvedValueOnce({
      items: [
        {
          id: 'Xenova/opus-mt-no-de',
          label: 'Xenova/opus-mt-no-de',
          summary: 'Downloaded local model.',
          downloads: 0,
          likes: 0,
          tags: ['local'],
          compatibility: {
            transformersJs: true,
            onnx: true,
            localRuntimeVerified: true,
          },
          size: {
            estimatedTotalBytes: 246415360,
            primaryBytes: 246415360,
          },
          downloadGroups: localPlan.groups,
          languageMatch: {
            sourceMatched: false,
            targetMatched: true,
            directionalScore: 0,
          },
          asset: localAsset,
          selectable: true,
          local: true,
        },
      ],
    })
    nmtModelsMock.state.mockResolvedValue(localAsset)
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'nmt',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    await waitFor(() =>
      expect(
        screen.getByLabelText('Downloaded', { selector: '[data-nmt-plan-action="downloaded"]' })
      ).toBeTruthy()
    )
    expect(screen.getByText('config.json')).toBeTruthy()
    expect(screen.queryByText('Loading model files…')).toBeNull()
    expect(nmtModelsMock.state).not.toHaveBeenCalled()
    expect(translationEnginesMock.getModelDownloadPlan).not.toHaveBeenCalled()
  })

  it('runs a browser translation smoke test from the dialog beside the engine selector', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'browser',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(screen.queryByLabelText('Translation test source text')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open translation test' }))
    const dialog = screen.getByRole('dialog', { name: 'Translation Test', hidden: true })
    const sourceText = within(dialog).getByRole('textbox', { name: 'Translation test source text' })
    expect(sourceText).toHaveValue('')
    expect(sourceText).toHaveAttribute('placeholder', 'My name is Sarah and I live in London.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Run Test' }))

    expect(
      await within(dialog).findByText('browser:My name is Sarah and I live in London.')
    ).toBeTruthy()
    expect(translationEnginesMock.translate).not.toHaveBeenCalled()
  })

  it('runs a server translation smoke test for the selected service engine from the dialog', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'de',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'nmt',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Open translation test' }))
    const dialog = screen.getByRole('dialog', { name: 'Translation Test', hidden: true })
    const sourceText = within(dialog).getByRole('textbox', { name: 'Translation test source text' })
    expect(sourceText).toHaveValue('')
    expect(sourceText).toHaveAttribute('placeholder', 'My name is Sarah and I live in London.')
    await waitFor(() => expect(screen.getAllByText('q8 (8-bit)').length).toBeGreaterThan(0))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Run Test' }))

    expect(
      await within(dialog).findByText('server:My name is Sarah and I live in London.')
    ).toBeTruthy()
    expect(translationEnginesMock.translate).toHaveBeenCalledWith(
      expect.objectContaining({
        engineId: 'nmt',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        model: 'Xenova/opus-mt-no-de',
        selectedGroupId: 'q8',
        text: 'My name is Sarah and I live in London.',
      })
    )
  })

  it('switches the translation test placeholder with the selected source language', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'browser',
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Open translation test' }))
    const testDialog = screen.getByRole('dialog', { name: 'Translation Test', hidden: true })
    fireEvent.click(
      within(testDialog).getByRole('button', { name: 'Translation test source language' })
    )
    const dialog = screen.getByRole('dialog', { name: 'Select translation test source language' })
    dispatchPopoverToggle(dialog, 'open')
    const searchInput = screen.getByRole('textbox', {
      name: 'Search translation test source languages',
    })
    fireEvent.change(searchInput, { target: { value: 'deutsch' } })
    const option = await within(dialog).findByRole('option', { name: /German Deutsch/ })
    fireEvent.click(option)

    const sourceText = within(testDialog).getByRole('textbox', {
      name: 'Translation test source text',
    })
    expect(sourceText).toHaveValue('')
    expect(sourceText).toHaveAttribute(
      'placeholder',
      'Dies ist ein kurzer Satz zum Testen der Übersetzung.'
    )
  })

  it('searches translation languages by native label and stores the selected code', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Translation target language' }))
    const dialog = getTranslationTargetLanguageDialog()
    dispatchPopoverToggle(dialog, 'open')
    const searchInput = screen.getByRole('textbox', { name: 'Search translation languages' })
    fireEvent.change(searchInput, { target: { value: '繁體' } })
    const option = await within(dialog).findByRole('option', {
      name: /Chinese \(Traditional\) 繁體中文/,
    })
    fireEvent.click(option)

    await waitFor(() =>
      expect(updateConfigMock).toHaveBeenCalledWith({ translation: { targetLanguage: 'zh-Hant' } })
    )
  })

  it('keeps the selected language on open and exposes an explicit clear action', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Translation target language' }))
    const dialog = getTranslationTargetLanguageDialog()
    dispatchPopoverToggle(dialog, 'open')
    const searchInput = screen.getByRole('textbox', { name: 'Search translation languages' })

    expect(screen.getByRole('button', { name: 'Translation target language' })).toHaveTextContent(
      'Chinese 中文'
    )
    expect(searchInput).toHaveValue('')
    expect(dialog.querySelector('[aria-label="Clear search"]')).toBeTruthy()
  })

  it('uses popover theme tokens for the translation language dialog in dark mode-safe surfaces', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Translation target language' }))
    const popover = getTranslationTargetLanguageDialog()
    dispatchPopoverToggle(popover, 'open')

    expect(popover.className).toContain('bg-popover')
    expect(popover.className).toContain('text-popover-foreground')
    const selectedOption = screen
      .getAllByRole('option', { name: /Chinese 中文/ })
      .find((option) => popover.contains(option))
    expect(selectedOption?.className).toContain('bg-primary/10')
  })

  it('keeps the popover open when the inner search input is clicked', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Translation target language' }))
    const popover = getTranslationTargetLanguageDialog()
    dispatchPopoverToggle(popover, 'open')

    const searchInput = screen.getByRole('textbox', { name: 'Search translation languages' })
    fireEvent.click(searchInput)

    expect(screen.getByRole('button', { name: 'Translation target language' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(searchInput).toHaveValue('')
  })

  it('restores the previous valid language when the popover closes without a selection', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({
      data: {
        translation: {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
        },
      },
    })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Translation target language' }))
    const popover = getTranslationTargetLanguageDialog()
    dispatchPopoverToggle(popover, 'open')
    const searchInput = screen.getByRole('textbox', { name: 'Search translation languages' })
    fireEvent.change(searchInput, { target: { value: 'japanese' } })

    expect(searchInput).toHaveValue('japanese')

    dispatchPopoverToggle(popover, 'closed')

    expect(screen.getByRole('button', { name: 'Translation target language' })).toHaveTextContent(
      'Chinese 中文'
    )
    expect(popover.querySelector('[aria-label="Clear search"]')).toBeTruthy()
    expect(updateConfigMock).not.toHaveBeenCalledWith({ translation: { targetLanguage: '' } })
  })

  it('renders the shared ToC before settings content so narrow mode can collapse above content', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    useConfigSubscriptionMock.mockReturnValue({ data: {} })
    useServerStatusMock.mockReturnValue({ projectDir: '/tmp/project' })

    render(<Settings />)

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull())
    expect(tocRenderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        className: expect.stringContaining('toc-page-sidebar'),
        itemIds: expect.arrayContaining(['settings-translation']),
      })
    )

    const toc = screen.getByTestId('settings-toc')
    const content = document.querySelector('.toc-page-content')
    expect(content).toBeInstanceOf(HTMLElement)
    if (!(content instanceof HTMLElement)) {
      throw new Error('Settings content element missing')
    }
    expect(toc.compareDocumentPosition(content)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })
})
