/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Prove native file/sound resource requests are classified by origin and protected path.
 * 2. Prove the resource bridge adds Authorization without modifying the request URL.
 *
 * Original request (2026-07-24): "完整审计 Project Web 的 raw resource 网络路径。"
 */
import { describe, expect, it } from 'vitest'
import {
  authorizeResourceRequest,
  isProtectedResourceRequest,
} from './access-gate-resource-request'

describe('Access Gate native resource request bridge', () => {
  it('protects backend data resources but not immutable shell assets or another origin', () => {
    expect(
      isProtectedResourceRequest(
        new Request('https://backend.example/api/file-preview/hash/index.html'),
        'https://backend.example'
      )
    ).toBe(true)
    expect(
      isProtectedResourceRequest(
        new Request('https://backend.example/api/sounds/custom/hash'),
        'https://backend.example'
      )
    ).toBe(true)
    expect(
      isProtectedResourceRequest(
        new Request('https://backend.example/assets/main.js'),
        'https://backend.example'
      )
    ).toBe(false)
    expect(
      isProtectedResourceRequest(
        new Request('https://other.example/api/file-preview/hash/index.html'),
        'https://backend.example'
      )
    ).toBe(false)
  })

  it('clones a resource with Authorization and no URL credential', () => {
    const original = new Request('https://backend.example/api/file-preview/hash/resource/file.pdf')
    const authorized = authorizeResourceRequest(original, 'Bearer secret-a')

    expect(authorized.headers.get('Authorization')).toBe('Bearer secret-a')
    expect(authorized.url).toBe(original.url)
    expect(authorized.url).not.toContain('secret-a')
  })
})
