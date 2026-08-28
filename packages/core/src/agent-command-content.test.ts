/**
 * Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
 * 1. Prove the pinned OpenSpec CLI yields exact Agent command contents through the runtime generator bridge.
 * 2. Prove non-importable runners fail closed instead of fabricating current command evidence.
 * 3. Prove a CLI line without one adapter keeps every unrelated adapter's evidence
 *    (historical 1.8 Command Code exemplar; the admitted 1.10/1.11 pair shares one inventory).
 * 4. Prove command-content equivalence tolerates exactly the OpenCode provided-arguments
 *    injection line and nothing else for tools without that adapter contract.
 *
 * Original request (2026-08-01): adapt the complete OpenSpec 1.7 Agent delivery protocol for OpenSpecUI 7.
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 */

import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isEquivalentAgentCommandContent,
  loadOpenSpecAgentCommandContents,
  OPENCODE_PROVIDED_ARGUMENTS_LINE,
} from './agent-command-content.js'

const OPENSPEC_111_BIN = resolve(
  import.meta.dirname,
  '../node_modules/openspec-cli-111/bin/openspec.js'
)

const OPENSPEC_110_BIN = resolve(
  import.meta.dirname,
  '../node_modules/openspec-cli-110/bin/openspec.js'
)

// Historical runner (1.8 line): Command Code is the one registry tool whose command
// adapter a real installed runner can still lack. The admitted 1.10/1.11 pair ships
// identical command-adapter inventories, so this runner remains the only executable
// exemplar of version-scoped adapter unavailability. It is historical compatibility
// evidence for that mechanism, not an admission of 1.8 support.
const OPENSPEC_18_BIN_HISTORICAL = resolve(
  import.meta.dirname,
  '../node_modules/openspec-cli-18/bin/openspec.js'
)

describe('loadOpenSpecAgentCommandContents', () => {
  it('loads official per-Agent command contents from the pinned OpenSpec 1.11 generator', async () => {
    const result = await loadOpenSpecAgentCommandContents(
      [process.execPath, OPENSPEC_111_BIN],
      ['explore']
    )
    const catalog = result?.catalog

    expect(catalog?.claude?.explore).toContain('name: "OPSX: Explore"')
    expect(catalog?.claude?.explore).toContain('allowed-tools:')
    // 1.11 adapters rewrite the invocation reference to each tool's own syntax.
    expect(catalog?.['amazon-q']?.explore).toContain('`@opsx-explore`')
    expect(catalog?.qwen?.explore).toContain('`/opsx-explore`')
    expect(catalog?.['command-code']?.explore).toContain('`/opsx-explore`')
    // Command Code renders the bare body without YAML frontmatter and injects its own
    // argument passthrough line after the input contract.
    expect(catalog?.['command-code']?.explore?.startsWith('---')).toBe(false)
    expect(catalog?.['command-code']?.explore).toContain(OPENCODE_PROVIDED_ARGUMENTS_LINE)
    expect(catalog?.codex).toBeUndefined()
    expect(catalog?.['minimax-code']).toBeUndefined()
    // The 1.11 runner ships every registry adapter, so nothing is version-unavailable.
    expect(result?.unavailableTools).toEqual({})
  })

  it('keeps the admitted 1.10 generator on the same adapter inventory and injection behavior', async () => {
    const result = await loadOpenSpecAgentCommandContents(
      [process.execPath, OPENSPEC_110_BIN],
      ['explore']
    )

    // The admitted series pair (1.10/1.11) has no command-adapter divergence; the
    // per-series generator facts they share are the complete inventory and the 1.10+
    // OpenCode provided-arguments injection appended by the adapter itself.
    expect(result?.unavailableTools).toEqual({})
    expect(result?.catalog?.claude?.explore).toContain('name: "OPSX: Explore"')
    expect(result?.catalog?.opencode?.explore).toContain(OPENCODE_PROVIDED_ARGUMENTS_LINE)
  })

  it("historical 1.8: isolates the line's missing Command Code adapter without erasing other evidence", async () => {
    const result = await loadOpenSpecAgentCommandContents(
      [process.execPath, OPENSPEC_18_BIN_HISTORICAL],
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

describe('isEquivalentAgentCommandContent', () => {
  const baseContent = `---
description: "probe"
---

Body with an input contract.

**Input**: the argument after the command

---

Tail.
`

  const injectedContent = `---
description: "probe"
---

Body with an input contract.

**Input**: the argument after the command
${OPENCODE_PROVIDED_ARGUMENTS_LINE}

---

Tail.
`

  it('tolerates the OpenCode provided-arguments injection line in either direction', () => {
    expect(isEquivalentAgentCommandContent('opencode', injectedContent, baseContent)).toBe(true)
    expect(isEquivalentAgentCommandContent('opencode', baseContent, injectedContent)).toBe(true)
    expect(isEquivalentAgentCommandContent('opencode', baseContent, baseContent)).toBe(true)
  })

  it('keeps strict equivalence for tools without the injection contract', () => {
    expect(isEquivalentAgentCommandContent('claude', injectedContent, baseContent)).toBe(false)
    expect(isEquivalentAgentCommandContent('qwen', baseContent, baseContent)).toBe(true)
  })

  it('does not mask other content drift beside the injection line', () => {
    const drifted = injectedContent.replace('Tail.', 'Drifted.')
    expect(isEquivalentAgentCommandContent('opencode', drifted, baseContent)).toBe(false)
  })

  it('does not strip a body line that merely starts with the injection text', () => {
    // A genuine body line that begins with the passthrough text and continues with more
    // content is not the generator-owned injection line: stripping must never remove it,
    // so content that adds or removes such a line stays a real difference.
    const withContentLine = baseContent.replace(
      'Tail.',
      `${OPENCODE_PROVIDED_ARGUMENTS_LINE} and further prose.\nTail.`
    )
    expect(isEquivalentAgentCommandContent('opencode', withContentLine, baseContent)).toBe(false)
    expect(isEquivalentAgentCommandContent('opencode', baseContent, withContentLine)).toBe(false)
  })

  it('does not manufacture equivalence by cropping an injection prefix inside a longer line', () => {
    // Regression for substring deletion: a disk line that starts with the passthrough
    // text and continues must never be cropped down until it equals a joined drift on
    // the other side. Only a standalone line exactly matching the injection is removed.
    const withLongerLine =
      '**Input**: the argument after the command\n' +
      `${OPENCODE_PROVIDED_ARGUMENTS_LINE} passthrough is documented here.\n`
    const joinedDrift =
      '**Input**: the argument after the command passthrough is documented here.\n'
    expect(isEquivalentAgentCommandContent('opencode', withLongerLine, joinedDrift)).toBe(false)
    expect(isEquivalentAgentCommandContent('opencode', joinedDrift, withLongerLine)).toBe(false)
  })

  it('normalizes checkout-only BOM and CRLF differences before comparing', () => {
    const bomAndCrlf = `\uFEFF${baseContent.replaceAll('\n', '\r\n')}`
    expect(isEquivalentAgentCommandContent('claude', bomAndCrlf, baseContent)).toBe(true)
  })
})
