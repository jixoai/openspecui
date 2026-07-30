/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Prove launch parsing, sanitization, and credential-free URL cleanup.
 * 2. Prove native presentation capture is explicit and closed to unknown values.
 * 3. Prove service-worker registration remains production-only and eagerly refreshed.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Owner correction (2026-07-30): the self-drawn titlebar must survive App route navigation.
 */
// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import {
  parseHostedAppPresentation,
  parseHostedLaunchParams,
  registerHostedServiceWorker,
  stripHostedLaunchParams,
  type HostedBootstrapRuntime,
  type HostedServiceWorkerRuntime,
} from './bootstrap'

describe('hosted app bootstrap helpers', () => {
  it('captures only the declared OpenTray overlay presentation', () => {
    expect(parseHostedAppPresentation('?appMode=opentray-overlay')).toBe('opentray-overlay')
    expect(parseHostedAppPresentation('?appMode=browser')).toBeUndefined()
    expect(parseHostedAppPresentation('')).toBeUndefined()
  })

  it('parses api-based launch parameters', () => {
    expect(parseHostedLaunchParams('?api=http://localhost:13000/')).toEqual({
      request: {
        apiBaseUrl: 'http://localhost:13000',
      },
      error: null,
      hasLaunchParams: true,
    })
  })

  it('ignores legacy launch parameters without api', () => {
    expect(parseHostedLaunchParams('?version=v2.1')).toEqual({
      request: null,
      error: null,
      hasLaunchParams: false,
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

  it('registers and eagerly updates the root service worker in production mode', async () => {
    const update = vi.fn(async () => {})
    const register = vi.fn(async () => ({ update }))
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
      type: 'module',
    })
    expect(update).toHaveBeenCalledTimes(1)
  })
})
