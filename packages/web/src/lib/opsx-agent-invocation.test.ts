import { describe, expect, it } from 'vitest'
import {
  buildOpsxProposeComposePrompt,
  buildOpsxSlashCommand,
  resolveOpsxInvocationMode,
} from './opsx-agent-invocation'

describe('opsx agent invocation helpers', () => {
  it('builds a self-contained propose compose prompt', () => {
    const prompt = buildOpsxProposeComposePrompt(' add auth ')

    expect(prompt).toContain('Propose a new OpenSpec change for: add auth')
    expect(prompt).toContain('openspec new change "<name>"')
    expect(prompt).toContain('openspec instructions <artifact-id>')
  })

  it('builds an empty propose compose prompt that asks for intent first', () => {
    const prompt = buildOpsxProposeComposePrompt('   ')

    expect(prompt).toContain('Propose a new OpenSpec change.')
    expect(prompt).toContain('Ask me what to build')
  })

  it('builds propose slash commands', () => {
    expect(buildOpsxSlashCommand({ action: 'propose', text: ' add auth ' })).toBe(
      '/opsx:propose add auth'
    )
    expect(buildOpsxSlashCommand({ action: 'propose', text: '   ' })).toBe('/opsx:propose')
  })

  it('preserves existing opsx slash commands for propose', () => {
    expect(buildOpsxSlashCommand({ action: 'propose', text: '/opsx:propose add auth' })).toBe(
      '/opsx:propose add auth'
    )
  })

  it('builds change-scoped slash commands for equivalent actions', () => {
    expect(buildOpsxSlashCommand({ action: 'apply', changeId: ' add-auth ' })).toBe(
      '/opsx:apply add-auth'
    )
    expect(buildOpsxSlashCommand({ action: 'archive', changeId: 'add-auth' })).toBe(
      '/opsx:archive add-auth'
    )
  })

  it('rejects slash command generation for non-equivalent actions', () => {
    expect(buildOpsxSlashCommand({ action: 'continue', changeId: 'add-auth' })).toBeNull()
    expect(buildOpsxSlashCommand({ action: 'ff', changeId: 'add-auth' })).toBeNull()
  })

  it('falls back to compose for command requests that are not command-equivalent', () => {
    expect(resolveOpsxInvocationMode('continue', 'command')).toMatchObject({
      requestedMode: 'command',
      actualMode: 'compose',
    })
    expect(resolveOpsxInvocationMode('ff', 'command')).toMatchObject({
      requestedMode: 'command',
      actualMode: 'compose',
    })
  })

  it('keeps command mode for command-equivalent actions', () => {
    expect(resolveOpsxInvocationMode('propose', 'command')).toEqual({
      requestedMode: 'command',
      actualMode: 'command',
      fallbackReason: null,
    })
  })
})
