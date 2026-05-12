import type { OpenSpecUIHooksV1 } from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import type { HookRuntime } from './hook-runtime.js'
import { WorkflowInvocationService } from './workflow-invocation-service.js'

function createRuntime(hooks: OpenSpecUIHooksV1 = {}): HookRuntime {
  return {
    hooksPath: '/project/openspec/openspecui.hooks.ts',
    load: vi.fn().mockResolvedValue(hooks),
    onDispose: vi.fn(),
    dispose: vi.fn().mockResolvedValue(undefined),
  }
}

describe('WorkflowInvocationService', () => {
  it('builds default propose compose and command payloads', async () => {
    const service = new WorkflowInvocationService({
      projectDir: '/project',
      hookRuntime: createRuntime(),
    })

    await expect(
      service.runWorkflow({ action: 'propose', text: ' add auth ' }, 'compose')
    ).resolves.toMatchObject({
      kind: 'agent-prompt',
      text: expect.stringContaining('Propose a new OpenSpec change for: add auth'),
    })

    await expect(
      service.runWorkflow({ action: 'propose', text: ' add auth ' }, 'command')
    ).resolves.toMatchObject({
      kind: 'agent-command',
      text: '/opsx:propose add auth',
    })
  })

  it('uses CLI output for compose actions without replacing OpenSpec facts', async () => {
    const executeCli = vi.fn().mockResolvedValue({
      success: true,
      stdout: 'apply instructions',
      stderr: '',
      exitCode: 0,
    })
    const service = new WorkflowInvocationService({
      projectDir: '/project',
      hookRuntime: createRuntime(),
      executeCli,
    })

    const result = await service.runWorkflow({ action: 'apply', changeId: 'add-auth' }, 'compose')

    expect(result).toMatchObject({ kind: 'agent-prompt', text: 'apply instructions' })
    expect(executeCli).toHaveBeenCalledWith(['instructions', 'apply', '--change', 'add-auth'])
  })

  it('lets onRunWorkflow override the final invocation payload', async () => {
    const service = new WorkflowInvocationService({
      projectDir: '/project',
      hookRuntime: createRuntime({
        onRunWorkflow: async (_ctx, run) => {
          const result = await run()
          if (result.kind !== 'agent-prompt') return result
          return { ...result, text: `${result.text}\n\nProject policy appended.` }
        },
      }),
    })

    const result = await service.runWorkflow({ action: 'propose', text: 'add auth' }, 'compose')

    expect(result).toMatchObject({
      kind: 'agent-prompt',
      text: expect.stringContaining('Project policy appended.'),
    })
  })

  it('fails open to default payload when onRunWorkflow throws', async () => {
    const service = new WorkflowInvocationService({
      projectDir: '/project',
      hookRuntime: createRuntime({
        onRunWorkflow: async () => {
          throw new Error('policy daemon unavailable')
        },
      }),
    })

    const result = await service.runWorkflow({ action: 'propose', text: 'add auth' }, 'compose')

    expect(result).toMatchObject({
      kind: 'agent-prompt',
      text: expect.stringContaining('add auth'),
    })
    expect(result.diagnostics?.[0]?.message).toContain('policy daemon unavailable')
  })
})
