/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Prove the pinned OpenSpec 1.9 CLI yields exact Agent command contents through the runtime generator bridge.
 * 2. Prove non-importable runners fail closed instead of fabricating current command evidence.
 * 3. Prove a CLI line without one adapter keeps every unrelated adapter's evidence (1.8 Command Code).
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

const OPENSPEC_18_BIN = resolve(
  import.meta.dirname,
  '../node_modules/openspec-cli-18/bin/openspec.js'
)

describe('loadOpenSpecAgentCommandContents', () => {
  it('loads official per-Agent command contents from the pinned OpenSpec 1.9 generator', async () => {
    const result = await loadOpenSpecAgentCommandContents(
      [process.execPath, OPENSPEC_19_BIN],
      ['explore']
    )
    const catalog = result?.catalog

    expect(catalog?.claude?.explore).toContain('name: "OPSX: Explore"')
    expect(catalog?.['amazon-q']?.explore).toContain('@opsx-explore')
    expect(catalog?.qwen?.explore).toContain('/opsx-explore')
    expect(catalog?.['command-code']?.explore).toContain('opsx-explore')
    expect(catalog?.codex).toBeUndefined()
    expect(catalog?.['minimax-code']).toBeUndefined()
    // The 1.9 runner ships every registry adapter, so nothing is version-unavailable.
    expect(result?.unavailableTools).toEqual({})
  })

  it("isolates the 1.8 line's missing Command Code adapter without erasing other evidence", async () => {
    const result = await loadOpenSpecAgentCommandContents(
      [process.execPath, OPENSPEC_18_BIN],
      ['explore']
    )

    // One missing adapter must not fail the whole observation.
    expect(result).not.toBeNull()
    // Unrelated adapters keep their exact generated command evidence.
    expect(result?.catalog?.claude?.explore).toContain('name: "OPSX: Explore"')
    expect(result?.catalog?.['amazon-q']?.explore).toContain('@opsx-explore')
    expect(result?.catalog?.qwen?.explore).toContain('/opsx-explore')
    // Command Code never shipped on 1.8: version-scoped unavailability, not absence.
    expect(result?.catalog?.['command-code']).toBeUndefined()
    expect(result?.unavailableTools?.['command-code']).toContain(
      'first ships with OpenSpec CLI 1.9'
    )
  })

  it('returns no fingerprint evidence for a non-importable runner', async () => {
    await expect(
      loadOpenSpecAgentCommandContents(['not-an-importable-openspec-runner'], ['explore'])
    ).resolves.toBeNull()
  })
})
