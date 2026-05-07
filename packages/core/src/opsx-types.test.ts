import { describe, expect, it } from 'vitest'
import { ApplyInstructionsSchema } from './opsx-types.js'

const baseApplyInstructions = {
  changeName: 'add-example',
  changeDir: '/repo/openspec/changes/add-example',
  schemaName: 'spec-driven',
  progress: {
    total: 1,
    complete: 0,
    remaining: 1,
  },
  tasks: [
    {
      id: '1',
      description: 'Do the work',
      done: false,
    },
  ],
  state: 'ready',
  instruction: 'Read context files and apply the change.',
} as const

describe('ApplyInstructionsSchema', () => {
  it('accepts OpenSpec CLI 1.3 contextFiles arrays', () => {
    const parsed = ApplyInstructionsSchema.parse({
      ...baseApplyInstructions,
      contextFiles: {
        proposal: ['/repo/openspec/changes/add-example/proposal.md'],
        specs: [
          '/repo/openspec/changes/add-example/specs/alpha/spec.md',
          '/repo/openspec/changes/add-example/specs/beta/spec.md',
        ],
        tasks: ['/repo/openspec/changes/add-example/tasks.md'],
      },
    })

    expect(parsed.contextFiles).toEqual({
      proposal: ['/repo/openspec/changes/add-example/proposal.md'],
      specs: [
        '/repo/openspec/changes/add-example/specs/alpha/spec.md',
        '/repo/openspec/changes/add-example/specs/beta/spec.md',
      ],
      tasks: ['/repo/openspec/changes/add-example/tasks.md'],
    })
  })

  it('normalizes legacy contextFiles strings to arrays', () => {
    const parsed = ApplyInstructionsSchema.parse({
      ...baseApplyInstructions,
      contextFiles: {
        proposal: '/repo/openspec/changes/add-example/proposal.md',
        specs: '/repo/openspec/changes/add-example/specs/alpha/spec.md',
        tasks: '/repo/openspec/changes/add-example/tasks.md',
      },
    })

    expect(parsed.contextFiles).toEqual({
      proposal: ['/repo/openspec/changes/add-example/proposal.md'],
      specs: ['/repo/openspec/changes/add-example/specs/alpha/spec.md'],
      tasks: ['/repo/openspec/changes/add-example/tasks.md'],
    })
  })
})
