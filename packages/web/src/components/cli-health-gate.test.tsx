import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CliHealthGate } from './cli-health-gate'

interface CliAvailability {
  available: boolean
  version?: string
  error?: string
}

let availability: CliAvailability = { available: true, version: '1.4.1' }

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: () => false,
}))

vi.mock('@/lib/use-subscription', () => ({
  useConfigSubscription: () => ({ data: undefined }),
}))

vi.mock('@/lib/trpc', () => ({
  queryClient: {
    invalidateQueries: async () => undefined,
  },
  trpc: {
    cli: {
      checkAvailability: {
        queryOptions: () => ({
          queryKey: ['cli.checkAvailability'],
          queryFn: async () => availability,
        }),
        queryFilter: () => ({ queryKey: ['cli.checkAvailability'] }),
      },
    },
    config: {
      getEffectiveCliCommand: {
        queryFilter: () => ({ queryKey: ['config.getEffectiveCliCommand'] }),
      },
    },
  },
  trpcClient: {
    config: {
      update: {
        mutate: async () => ({ success: true }),
      },
    },
  },
}))

function renderGate() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <CliHealthGate />
    </QueryClientProvider>
  )
}

describe('CliHealthGate', () => {
  beforeEach(() => {
    availability = { available: true, version: '1.4.1' }
  })

  afterEach(() => {
    cleanup()
  })

  it('does not render for current OpenSpec CLI 1.4.x', async () => {
    renderGate()

    await waitFor(() => {
      expect(screen.queryByText(/OpenSpec CLI .* Required/)).not.toBeInTheDocument()
      expect(screen.queryByText(/legacy-compatible/)).not.toBeInTheDocument()
    })
  })

  it('renders a non-blocking legacy-compatible notice for OpenSpec CLI 1.3.x', async () => {
    availability = { available: true, version: '1.3.0' }

    renderGate()

    expect(await screen.findByText('OpenSpec CLI 1.3.0 is legacy-compatible')).toBeInTheDocument()
    expect(screen.queryByText(/OpenSpec CLI .* Required/)).not.toBeInTheDocument()
  })

  it('blocks unsupported OpenSpec CLI versions', async () => {
    availability = { available: true, version: '1.2.0' }

    renderGate()

    expect(await screen.findByText(/OpenSpec CLI >=1.3.0 <1.6.0 Required/)).toBeInTheDocument()
    expect(screen.getByText(/Detected OpenSpec CLI 1.2.0/)).toBeInTheDocument()
  })

  it('offers a skip-version-check escape hatch when the CLI is available', async () => {
    availability = { available: true, version: '1.6.0' }

    renderGate()

    expect(await screen.findByText(/Skip version check/)).toBeInTheDocument()
  })

  it('clears the blocking dialog after skipping the version check', async () => {
    availability = { available: true, version: '1.6.0' }

    renderGate()

    const skip = await screen.findByText(/Skip version check/)
    fireEvent.click(skip)

    await waitFor(() => {
      expect(screen.queryByText(/OpenSpec CLI >=1.3.0 <1.6.0 Required/)).not.toBeInTheDocument()
    })
  })

  it('does not offer a skip escape hatch when the CLI is unavailable', async () => {
    availability = { available: false, error: 'command not found' }

    renderGate()

    expect(await screen.findByText(/OpenSpec CLI >=1.3.0 <1.6.0 Required/)).toBeInTheDocument()
    expect(screen.queryByText(/Skip version check/)).not.toBeInTheDocument()
  })
})
