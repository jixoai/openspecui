/**
 * Orthogonal intents (updated 2026-09-03 Asia/Shanghai):
 * 1. Prove the pinned OpenSpec CLI yields exact Agent command contents through the runtime generator bridge.
 * 2. Prove non-importable runners fail closed instead of fabricating current command evidence.
 * 3. Prove a CLI line without one adapter keeps every unrelated adapter's evidence
 *    (retired 1.11 lacks codeassistant; historical 1.8 lacks Command Code).
 * 4. Prove command-content equivalence tolerates exactly the OpenCode provided-arguments
 *    injection line and nothing else for tools without that adapter contract.
 *
 * Original request (2026-08-01): adapt the complete OpenSpec 1.7 Agent delivery protocol for OpenSpecUI 7.
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 */

import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isEquivalentAgentCommandContent,
  loadOpenSpecAgentCommandContents,
  OPENCODE_PROVIDED_ARGUMENTS_LINE,
} from './agent-command-content.js'

const OPENSPEC_112_BIN = resolve(
  import.meta.dirname,
  '../node_modules/openspec-cli-112/bin/openspec.js'
)

// Retired runner (1.11 line, below the admitted single-series window): SourceCraft
// Code Assistant is the registry tool whose command adapter this line never shipped,
// so the retained executable proves the new minCliSeries boundary as a real
// version-scoped unavailability. It is capability-boundary rejection evidence, not
// an admission of 1.11 support.
const OPENSPEC_111_BIN_RETIRED = resolve(
  import.meta.dirname,
  '../node_modules/openspec-cli-111/bin/openspec.js'
)

// Historical runner (1.8 line): Command Code is the one registry tool whose command
// adapter this older runner lacks, exemplifying the same version-scoped mechanism
// one line further back. It is historical compatibility evidence for that
// mechanism, not an admission of 1.8 support.
const OPENSPEC_18_BIN_HISTORICAL = resolve(
  import.meta.dirname,
  '../node_modules/openspec-cli-18/bin/openspec.js'
)

describe('loadOpenSpecAgentCommandContents', () => {
  it('loads official per-Agent command contents from the pinned OpenSpec 1.12 generator', async () => {
    const result = await loadOpenSpecAgentCommandContents(
      [process.execPath, OPENSPEC_112_BIN],
      ['explore']
    )
    const catalog = result?.catalog

    expect(catalog?.claude?.explore).toContain('name: "OPSX: Explore"')
    expect(catalog?.claude?.explore).toContain('allowed-tools:')
    // 1.12 adapters rewrite the invocation reference to each tool's own syntax.
    expect(catalog?.['amazon-q']?.explore).toContain('`@opsx-explore`')
    expect(catalog?.qwen?.explore).toContain('`/opsx-explore`')
    expect(catalog?.['command-code']?.explore).toContain('`/opsx-explore`')
    // Command Code renders the bare body without YAML frontmatter and injects its own
    // argument passthrough line after the input contract.
    expect(catalog?.['command-code']?.explore?.startsWith('---')).toBe(false)
    expect(catalog?.['command-code']?.explore).toContain(OPENCODE_PROVIDED_ARGUMENTS_LINE)
    // SourceCraft Code Assistant ships description-only YAML frontmatter commands.
    expect(catalog?.codeassistant?.explore?.startsWith('---\ndescription:')).toBe(true)
    expect(catalog?.opencode?.explore).toContain(OPENCODE_PROVIDED_ARGUMENTS_LINE)
    expect(catalog?.codex).toBeUndefined()
    expect(catalog?.['minimax-code']).toBeUndefined()
    // The 1.12 runner ships every registry adapter, so nothing is version-unavailable.
    expect(result?.unavailableTools).toEqual({})
  })

  it('retired 1.11: isolates the missing codeassistant adapter without erasing other evidence', async () => {
    const result = await loadOpenSpecAgentCommandContents(
      [process.execPath, OPENSPEC_111_BIN_RETIRED],
      ['explore']
    )

    // One missing adapter must not fail the whole observation.
    expect(result).not.toBeNull()
    expect(result?.catalog?.claude?.explore).toContain('name: "OPSX: Explore"')
    // Codeassistant first ships with the 1.12 line: version-scoped unavailability,
    // not absence of the tool from the registry.
    expect(result?.catalog?.codeassistant).toBeUndefined()
    expect(result?.unavailableTools?.codeassistant).toContain('first ships with OpenSpec CLI 1.12')
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
