import { describe, expect, it } from 'vitest'

import { createDevTasks } from './dev-task-definitions'

describe('createDevTasks', () => {
  it('adds website dev as an optional task', () => {
    const tasks = createDevTasks({
      apiUrl: 'http://localhost:3102',
      dir: './example',
      port: 3102,
      webDistDir: '/repo/packages/web/dist',
      webPackageVersion: '2.0.0',
    })

    const websiteTask = tasks.find((task) => task.id === 'website-dev')
    expect(websiteTask).toBeDefined()
    expect(websiteTask).toMatchObject({
      autoStart: false,
      args: ['--filter', '@openspecui/website', 'dev'],
      command: 'pnpm',
    })
  })

  it('passes project dir through to the server task only', () => {
    const tasks = createDevTasks({
      apiUrl: 'http://localhost:3111',
      dir: './workspace',
      port: 3111,
      webDistDir: '/repo/packages/web/dist',
      webPackageVersion: '2.1.0',
    })

    const serverTask = tasks.find((task) => task.id === 'server-dev')
    const webTask = tasks.find((task) => task.id === 'web-dev')

    expect(serverTask?.args).toEqual([
      '--filter',
      '@openspecui/server',
      'dev',
      '--',
      '--port',
      '3111',
      '--dir',
      './workspace',
    ])
    expect(webTask?.args).toEqual(['--filter', '@openspecui/web', 'dev'])
  })
})
