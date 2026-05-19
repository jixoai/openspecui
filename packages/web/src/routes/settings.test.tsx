import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Settings } from './settings'

const { useConfigSubscriptionMock, staticModeMock, useServerStatusMock } = vi.hoisted(() => ({
  useConfigSubscriptionMock: vi.fn(),
  staticModeMock: vi.fn(() => false),
  useServerStatusMock: vi.fn(),
}))

const tocRenderMock = vi.hoisted(() => vi.fn())

const { prepareBrowserTranslationMock, updateConfigMock } = vi.hoisted(() => ({
  prepareBrowserTranslationMock: vi.fn(),
  updateConfigMock: vi.fn(),
}))

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
    if (key === 'globalSettings.get') {
      return { data: { translationCache: { entryLimit: 10000 } }, refetch: vi.fn() }
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
  prepareBrowserTranslation: prepareBrowserTranslationMock,
  probeBrowserTranslation: vi.fn(async () => ({ availability: 'available' })),
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
        mutate: vi.fn(),
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
  },
}))

describe('Settings', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
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
    expect(screen.getByRole('switch', { name: 'Enable translation cache' })).toBeTruthy()

    fireEvent.click(screen.getByRole('switch', { name: 'Enable document translation' }))

    await waitFor(() =>
      expect(updateConfigMock).toHaveBeenCalledWith({ translation: { enabled: true } })
    )
    await waitFor(() =>
      expect(prepareBrowserTranslationMock).toHaveBeenCalledWith('zh', expect.any(AbortSignal))
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
    dispatchPopoverToggle(
      screen.getByRole('dialog', { name: 'Select translation target language' }),
      'open'
    )
    const searchInput = screen.getByRole('textbox', { name: 'Search translation languages' })
    fireEvent.change(searchInput, { target: { value: '繁體' } })
    fireEvent.click(await screen.findByRole('option', { name: /Chinese \(Traditional\) 繁體中文/ }))

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
    dispatchPopoverToggle(
      screen.getByRole('dialog', { name: 'Select translation target language' }),
      'open'
    )
    const searchInput = screen.getByRole('textbox', { name: 'Search translation languages' })

    expect(screen.getByRole('button', { name: 'Translation target language' })).toHaveTextContent(
      'Chinese 中文'
    )
    expect(searchInput).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeTruthy()
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
    const popover = screen.getByRole('dialog', { name: 'Select translation target language' })
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
    const popover = screen.getByRole('dialog', { name: 'Select translation target language' })
    dispatchPopoverToggle(popover, 'open')
    const searchInput = screen.getByRole('textbox', { name: 'Search translation languages' })
    fireEvent.change(searchInput, { target: { value: 'japanese' } })

    expect(searchInput).toHaveValue('japanese')

    dispatchPopoverToggle(popover, 'closed')

    expect(screen.getByRole('button', { name: 'Translation target language' })).toHaveTextContent(
      'Chinese 中文'
    )
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeTruthy()
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
