/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove every Store mutation kind registers only its resolved HTTP admission record.
 * 2. Preserve exact normalized-locator correlation ownership outside lifecycle evidence.
 * 3. Prove rejection and missing authority register nothing.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import type { StoreMutationStartResponse } from '@openspecui/core/store-mutation-protocol'
import { describe, expect, it, vi } from 'vitest'
import type { BackendStoreMutateInput } from './backend-client'
import {
  correlateStoreMutationAdmissions,
  type StoreActionAuthority,
  type StoreMutationDispatcher,
} from './store-action'

const AUTHORITY: StoreActionAuthority = {
  tabId: 'tab-a',
  sessionId: 'session-a',
  apiBaseUrl: 'http://localhost:3100/',
  tabCreatedAt: 1,
  observationGeneration: 1,
}

function admission(input: BackendStoreMutateInput): StoreMutationStartResponse {
  return {
    requestId: input.requestId,
    envUri: 'env:a',
    kind: input.kind,
    status: 'accepted',
    ...(input.storeId ? { storeId: input.storeId } : {}),
    observedAt: 1,
    rejoined: false,
  }
}

describe('Store admission correlation dispatcher', () => {
  it.each([
    { requestId: 'setup', kind: 'setup', path: '/stores/setup' },
    { requestId: 'register', kind: 'register', path: '/stores/register' },
    { requestId: 'unregister', kind: 'unregister', storeId: 'store-a' },
    { requestId: 'remove', kind: 'remove', storeId: 'store-a', confirmDelete: true },
  ] satisfies BackendStoreMutateInput[])('registers resolved $kind admission', async (input) => {
    const register = vi.fn()
    const dispatch: StoreMutationDispatcher = vi.fn(async (_authority, current) =>
      admission(current)
    )
    const correlated = correlateStoreMutationAdmissions(dispatch, register)

    await expect(correlated(AUTHORITY, input)).resolves.toMatchObject({
      requestId: input.requestId,
      status: 'accepted',
    })
    expect(register).toHaveBeenCalledExactlyOnceWith(
      AUTHORITY.apiBaseUrl,
      expect.objectContaining({ requestId: input.requestId, status: 'accepted' })
    )
  })

  it('does not register a rejected request or an authority-retired null result', async () => {
    const register = vi.fn()
    const rejection = new Error('HTTP admission rejected.')
    const rejectDispatch: StoreMutationDispatcher = async () => {
      throw rejection
    }
    const retiredDispatch: StoreMutationDispatcher = async () => null

    await expect(
      correlateStoreMutationAdmissions(rejectDispatch, register)(AUTHORITY, {
        requestId: 'rejected',
        kind: 'remove',
        storeId: 'store-a',
        confirmDelete: true,
      })
    ).rejects.toBe(rejection)
    await expect(
      correlateStoreMutationAdmissions(retiredDispatch, register)(null, {
        requestId: 'retired',
        kind: 'register',
        path: '/stores/retired',
      })
    ).resolves.toBeNull()
    expect(register).not.toHaveBeenCalled()
  })
})
