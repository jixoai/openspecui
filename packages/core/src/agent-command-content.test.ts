/**
 * Orthogonal intents (created 2026-08-01 Asia/Shanghai):
 * 1. Prove the pinned OpenSpec 1.7 CLI yields exact Agent command contents through the runtime generator bridge.
 * 2. Prove non-importable runners fail closed instead of fabricating current command evidence.
 *
 * Original request (2026-08-01): adapt the complete OpenSpec 1.7 Agent delivery protocol for OpenSpecUI 7.
 */

import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadOpenSpecAgentCommandContents } from './agent-command-content.js'

const OPENSPEC_17_BIN = resolve(import.meta.dirname, '../../../references/openspec/bin/openspec.js')

describe('loadOpenSpecAgentCommandContents', () => {
  it('loads official per-Agent command contents from the pinned OpenSpec 1.7 generator', async () => {
    const catalog = await loadOpenSpecAgentCommandContents(
      [process.execPath, OPENSPEC_17_BIN],
      ['explore']
    )

    expect(catalog?.claude?.explore).toContain('name: "OPSX: Explore"')
    expect(catalog?.['amazon-q']?.explore).toContain('@opsx-explore')
    expect(catalog?.qwen?.explore).toContain('/opsx-explore')
    expect(catalog?.codex).toBeUndefined()
  })

  it('returns no fingerprint evidence for a non-importable runner', async () => {
    await expect(
      loadOpenSpecAgentCommandContents(['not-an-importable-openspec-runner'], ['explore'])
    ).resolves.toBeNull()
  })
})
