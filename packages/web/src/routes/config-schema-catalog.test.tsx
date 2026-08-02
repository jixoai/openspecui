/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Verify Schema catalog loading, retained-error, current-empty, and settled entity geometry.
 * 2. Verify Schema identities navigate through encoded detail routes rather than dynamic tabs.
 * 3. Verify catalog failures remain direct without inventing empty conclusions.
 *
 * Owner Config-workbench decision (2026-08-01): Schema entities belong to catalog/detail routes.
 * Owner-reported debt (2026-07-22): avoid false empty conclusions while projection data is loading or stale.
 * Original request (2026-08-01): "还得再调查，config页面存在很多不完善的设计。"
 */
import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfigSchemaCatalog } from './config-schema-catalog'

const { configBundleMock, isStaticModeMock } = vi.hoisted(() => ({
  configBundleMock: vi.fn(),
  isStaticModeMock: vi.fn(),
}))

vi.mock('@/lib/static-mode', () => ({
  getBasePath: () => '/',
  isStaticMode: isStaticModeMock,
}))

vi.mock('@/lib/use-opsx', () => ({
  useOpsxConfigBundleSubscription: configBundleMock,
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  VTLink: ({
    children,
    to,
    ...props
  }: { children?: ReactNode; to: string } & Omit<ComponentProps<'a'>, 'href'>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

function schema(name = 'project/schema') {
  return {
    name,
    description: 'Project workflow',
    artifacts: ['proposal', 'tasks'],
    source: 'project' as const,
  }
}

describe('Config Schema catalog route', () => {
  beforeEach(() => {
    isStaticModeMock.mockReturnValue(false)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows catalog loading inside mounted page geometry without an empty conclusion', () => {
    configBundleMock.mockReturnValue({ data: undefined, isLoading: true, error: null })

    render(<ConfigSchemaCatalog />)

    expect(screen.getByTestId('config-workbench')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Loading Schema catalog' })).toBeTruthy()
    expect(screen.queryByText('No schemas available.')).toBeNull()
  })

  it('shows an absent-catalog error without loading or an empty conclusion', () => {
    configBundleMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Catalog transport failed.'),
    })

    render(<ConfigSchemaCatalog />)

    expect(screen.getByRole('alert')).toHaveTextContent('Catalog transport failed.')
    expect(screen.queryByRole('region', { name: 'Loading Schema catalog' })).toBeNull()
    expect(screen.queryByText('No schemas available.')).toBeNull()
  })

  it('keeps retained Schema entities beside a refresh error and routes encoded identity', () => {
    configBundleMock.mockReturnValue({
      data: {
        schemas: [schema()],
        schemaDetails: {},
        schemaResolutions: {},
      },
      isLoading: false,
      error: new Error('Catalog refresh failed.'),
    })

    render(<ConfigSchemaCatalog />)

    expect(screen.getByRole('alert')).toHaveTextContent('Catalog refresh failed.')
    expect(screen.getByRole('link', { name: /project\/schema/ })).toHaveAttribute(
      'href',
      '/config/schemas/project%2Fschema'
    )
    expect(screen.queryByRole('button', { name: /Schema\(/ })).toBeNull()
    expect(screen.queryByText('No schemas available.')).toBeNull()
  })

  it('does not relabel a retained-empty error as current empty', () => {
    configBundleMock.mockReturnValue({
      data: { schemas: [], schemaDetails: {}, schemaResolutions: {} },
      isLoading: false,
      error: new Error('Retained empty refresh failed.'),
    })

    render(<ConfigSchemaCatalog />)

    expect(screen.getByRole('alert')).toHaveTextContent('Retained empty refresh failed.')
    expect(screen.queryByText('No schemas available.')).toBeNull()
  })

  it('shows the settled current-empty catalog state', () => {
    configBundleMock.mockReturnValue({
      data: { schemas: [], schemaDetails: {}, schemaResolutions: {} },
      isLoading: false,
      error: null,
    })

    render(<ConfigSchemaCatalog />)

    expect(screen.getByText('No schemas available.')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
