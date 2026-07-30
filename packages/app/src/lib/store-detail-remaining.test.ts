/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove New Store flow gates on authority + lifecycle (7.6).
 * 2. Prove Environment evidence subpage renders observed-only facts + conflict (7.7).
 * 3. Prove Open-as-Workspace resolves available only with a real capability (7.13).
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 */
import { describe, expect, it, vi } from 'vitest'
import {
  resolveOpenStoreAsWorkspace,
  type OpenStoreAsWorkspaceCapability,
} from './open-store-as-workspace'

describe('Open-as-Workspace capability resolution (7.13)', () => {
  it('resolves available when a real owner can open the Store root', () => {
    const capability: OpenStoreAsWorkspaceCapability = {
      canOpen: () => true,
      open: vi.fn(async () => 'ws-store'),
    }
    const result = resolveOpenStoreAsWorkspace(capability, '/stores/team')
    expect(result.kind).toBe('available')
  })

  it('resolves unavailable when no capability owner exists (omit the action)', () => {
    const result = resolveOpenStoreAsWorkspace(null, '/stores/team')
    expect(result.kind).toBe('unavailable')
    if (result.kind === 'unavailable') {
      expect(result.reason).toMatch(/No daemon or backend owner/)
    }
  })

  it('resolves unavailable when the owner cannot open this root', () => {
    const capability: OpenStoreAsWorkspaceCapability = {
      canOpen: () => false,
      open: vi.fn(async () => 'ws'),
    }
    const result = resolveOpenStoreAsWorkspace(capability, '/stores/team')
    expect(result.kind).toBe('unavailable')
  })
})
