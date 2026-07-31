/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Verify root development task selection, arguments, and startup policy.
 * 2. Protect the separate browser-HMR and daemon-consumed App build boundaries.
 *
 * Original request (2026-07-30): "pnpm dev整理同时启动多个构建相关的任务，是不是缺了 app 项目的构建，如果是了，请你补充一下。"
 */
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
    const webDistTask = tasks.find((task) => task.id === 'web-dist-dev')
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
    expect(webDistTask?.args).toEqual(['--filter', '@openspecui/web', 'dev:dist'])
    expect(webTask?.args).toEqual(['--filter', '@openspecui/web', 'dev'])
  })

  it('auto-starts dist watch and keeps the Vite dev server optional', () => {
    const tasks = createDevTasks({
      apiUrl: 'http://localhost:3200',
      port: 3200,
      webDistDir: '/repo/packages/web/dist',
      webPackageVersion: '2.1.0',
    })

    expect(tasks.find((task) => task.id === 'web-dist-dev')).toMatchObject({
      autoStart: true,
      env: {
        VITE_API_URL: 'http://localhost:3200',
        OPENSPEC_SERVER_PORT: '3200',
      },
    })
    expect(tasks.find((task) => task.id === 'web-dev')).toMatchObject({
      autoStart: false,
      env: {
        VITE_API_URL: 'http://localhost:3200',
        OPENSPEC_SERVER_PORT: '3200',
      },
    })
    expect(tasks.find((task) => task.id === 'app-dist-dev')).toMatchObject({
      autoStart: true,
      args: ['--filter', '@openspecui/app', 'dev:dist'],
      command: 'pnpm',
    })
  })
})
