import { describe, expect, it } from 'vitest'
import {
  deriveDataState,
  hasRenderableData,
  isPendingState,
  type DataStateInput,
} from './data-state'

function input<T>(partial: Partial<DataStateInput<T>>): DataStateInput<T> {
  return { data: undefined, isLoading: false, hasFetched: false, error: null, ...partial }
}

describe('deriveDataState', () => {
  it('returns loading when first fetch in progress and no data', () => {
    expect(deriveDataState(input({ isLoading: true, hasFetched: false }))).toBe('loading')
  })

  it('returns idle when nothing fetched and no data', () => {
    expect(deriveDataState(input({}))).toBe('idle')
  })

  it('returns loaded when data present and stable', () => {
    expect(deriveDataState(input({ data: { a: 1 }, hasFetched: true }))).toBe('loaded')
  })

  it('returns updating when data present and background fetch in progress', () => {
    expect(deriveDataState(input({ data: { a: 1 }, isLoading: true, hasFetched: true }))).toBe(
      'updating'
    )
  })

  it('returns error when no data and request failed', () => {
    expect(
      deriveDataState(input({ error: new Error('boom'), isLoading: false, hasFetched: true }))
    ).toBe('error')
  })

  it('returns error-stale when data present but update failed', () => {
    expect(
      deriveDataState(input({ data: { a: 1 }, error: new Error('boom'), hasFetched: true }))
    ).toBe('error-stale')
  })
})

describe('hasRenderableData', () => {
  it('is true for loaded/updating/error-stale', () => {
    expect(hasRenderableData('loaded')).toBe(true)
    expect(hasRenderableData('updating')).toBe(true)
    expect(hasRenderableData('error-stale')).toBe(true)
  })

  it('is false for idle/loading/error', () => {
    expect(hasRenderableData('idle')).toBe(false)
    expect(hasRenderableData('loading')).toBe(false)
    expect(hasRenderableData('error')).toBe(false)
  })
})

describe('isPendingState', () => {
  it('is true for loading/idle', () => {
    expect(isPendingState('loading')).toBe(true)
    expect(isPendingState('idle')).toBe(true)
  })
})
