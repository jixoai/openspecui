// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import {
  parseHostedLaunchParams,
  registerHostedServiceWorker,
  stripHostedLaunchParams,
  type HostedBootstrapRuntime,
  type HostedServiceWorkerRuntime,
} from './bootstrap'

describe('hosted app bootstrap helpers', () => {
  it('parses api-based launch parameters', () => {
    expect(parseHostedLaunchParams('?api=http://localhost:13000/')).toEqual({
      request: {
        apiBaseUrl: 'http://localhost:13000',
      },
      error: null,
      hasLaunchParams: true,
    })
  })

  it('reports stale launch parameters without api', () => {
    expect(parseHostedLaunchParams('?version=v2.1')).toEqual({
      request: null,
      error: 'Hosted launch URLs require ?api.',
      hasLaunchParams: true,
    })
  })

  it('removes launch parameters after the shell consumes them', () => {
    expect(
      stripHostedLaunchParams(
        'https://app.openspecui.com/?version=v2.1&api=http%3A%2F%2Flocalhost%3A13000#shell'
      )
    ).toBe('/#shell')
  })

  it('skips service worker registration in dev mode', async () => {
    const register = vi.fn(async () => ({ update: vi.fn(async () => {}) }))
    const runtime: HostedBootstrapRuntime = {
      dev: true,
      location: window.location,
      serviceWorker: {
        register,
      },
    }

    await registerHostedServiceWorker(runtime)
    expect(register).not.toHaveBeenCalled()
  })

  it('registers the root service worker in production mode', async () => {
    const register = vi.fn(async () => ({ update: vi.fn(async () => {}) }))
    const serviceWorker: HostedServiceWorkerRuntime = {
      register,
    }
    const runtime: HostedBootstrapRuntime = {
      dev: false,
      location: window.location,
      serviceWorker,
    }

    await registerHostedServiceWorker(runtime)

    expect(register).toHaveBeenCalledWith('/service-worker.js', {
      scope: '/',
    })
  })
})
