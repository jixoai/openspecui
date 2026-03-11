import { afterEach, describe, expect, it } from 'vitest'
import {
  getApiBaseUrl,
  getHealthUrl,
  getHostedApiState,
  getPtyWsUrl,
  getTrpcUrl,
  getWsUrl,
} from './api-config'

function setLocation(pathAndSearch: string) {
  window.history.replaceState({}, '', pathAndSearch)
}

afterEach(() => {
  setLocation('/')
})

describe('api-config', () => {
  it('uses api query parameter for hosted traffic', () => {
    setLocation('/versions/latest/index.html?api=http://localhost:3100/')

    expect(getHostedApiState()).toEqual({
      hosted: true,
      apiBaseUrl: 'http://localhost:3100',
      sessionId: null,
    })
    expect(getApiBaseUrl()).toBe('http://localhost:3100')
    expect(getTrpcUrl()).toBe('http://localhost:3100/trpc')
    expect(getHealthUrl()).toBe('http://localhost:3100/api/health')
    expect(getWsUrl()).toBe('ws://localhost:3100/trpc')
    expect(getPtyWsUrl()).toBe('ws://localhost:3100/ws/pty')
  })

  it('marks version entries without api as hosted but disconnected', () => {
    setLocation('/versions/v2.0/index.html')

    expect(getHostedApiState()).toEqual({
      hosted: true,
      apiBaseUrl: null,
      sessionId: null,
    })
    expect(getApiBaseUrl()).toBe('')
  })

  it('uses same-origin when no hosted override is present', () => {
    setLocation('/dashboard')

    expect(getHostedApiState()).toEqual({
      hosted: false,
      apiBaseUrl: null,
      sessionId: null,
    })
    expect(getApiBaseUrl()).toBe('')
    expect(getTrpcUrl()).toBe('/trpc')
    expect(getHealthUrl()).toBe('/api/health')
    expect(getWsUrl()).toBe(
      `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/trpc`
    )
    expect(getPtyWsUrl()).toBe(
      `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/pty`
    )
  })
})
