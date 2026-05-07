import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CliHealthGate } from './cli-health-gate'

interface CliAvailability {
  available: boolean
  version?: string
  error?: string
}

let availability: CliAvailability = { available: true, version: '1.3.1' }

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
    availability = { available: true, version: '1.3.1' }
  })

  it('does not render for current OpenSpec CLI 1.3.x', async () => {
    renderGate()

    await waitFor(() => {
      expect(screen.queryByText(/OpenSpec CLI .* Required/)).not.toBeInTheDocument()
      expect(screen.queryByText(/legacy-compatible/)).not.toBeInTheDocument()
    })
  })

  it('renders a non-blocking legacy-compatible notice for OpenSpec CLI 1.2.x', async () => {
    availability = { available: true, version: '1.2.0' }

    renderGate()

    expect(await screen.findByText('OpenSpec CLI 1.2.0 is legacy-compatible')).toBeInTheDocument()
    expect(screen.queryByText(/OpenSpec CLI .* Required/)).not.toBeInTheDocument()
  })

  it('blocks unsupported OpenSpec CLI versions', async () => {
    availability = { available: true, version: '1.1.1' }

    renderGate()

    expect(await screen.findByText(/OpenSpec CLI >=1.2.0 <1.4.0 Required/)).toBeInTheDocument()
    expect(screen.getByText(/Detected OpenSpec CLI 1.1.1/)).toBeInTheDocument()
  })
})
