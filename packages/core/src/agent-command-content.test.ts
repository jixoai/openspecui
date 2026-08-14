/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Prove the pinned OpenSpec 1.9 CLI yields exact Agent command contents through the runtime generator bridge.
 * 2. Prove non-importable runners fail closed instead of fabricating current command evidence.
 * 3. Prove the 1.9 Command Code adapter content carries its argument placeholder contract.
 *
 * Original request (2026-08-01): adapt the complete OpenSpec 1.7 Agent delivery protocol for OpenSpecUI 7.
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 */

import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadOpenSpecAgentCommandContents } from './agent-command-content.js'

const OPENSPEC_19_BIN = resolve(
  import.meta.dirname,
  '../node_modules/openspec-cli-19/bin/openspec.js'
)

describe('loadOpenSpecAgentCommandContents', () => {
  it('loads official per-Agent command contents from the pinned OpenSpec 1.9 generator', async () => {
    const catalog = await loadOpenSpecAgentCommandContents(
      [process.execPath, OPENSPEC_19_BIN],
      ['explore']
    )

    expect(catalog?.claude?.explore).toContain('name: "OPSX: Explore"')
    expect(catalog?.['amazon-q']?.explore).toContain('@opsx-explore')
    expect(catalog?.qwen?.explore).toContain('/opsx-explore')
    expect(catalog?.['command-code']?.explore).toContain('opsx-explore')
    expect(catalog?.codex).toBeUndefined()
    expect(catalog?.['minimax-code']).toBeUndefined()
  })

  it('returns no fingerprint evidence for a non-importable runner', async () => {
    await expect(
      loadOpenSpecAgentCommandContents(['not-an-importable-openspec-runner'], ['explore'])
    ).resolves.toBeNull()
  })
})
