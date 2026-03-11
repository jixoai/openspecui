import { join } from 'node:path'

export type DevTask = {
  id: string
  name: string
  description: string
  command: string
  args: string[]
  env?: Record<string, string>
  autoStart: boolean
}

export type DevTaskConfig = {
  apiUrl: string
  dir?: string
  port: number
  webDistDir: string
  webPackageVersion: string
}

function createServerArgs({ dir, port }: Pick<DevTaskConfig, 'dir' | 'port'>): string[] {
  const args = ['--filter', '@openspecui/server', 'dev', '--', '--port', String(port)]
  if (dir) {
    args.push('--dir', dir)
  }
  return args
}

export function createDevTasks(config: DevTaskConfig): DevTask[] {
  const { apiUrl, dir, port, webDistDir, webPackageVersion } = config

  return [
    {
      id: 'core-dev',
      name: 'Core Watch Build',
      description: 'Build and watch @openspecui/core dist output.',
      command: 'pnpm',
      args: ['--filter', '@openspecui/core', 'dev'],
      autoStart: true,
    },
    {
      id: 'search-dev',
      name: 'Search Watch Build',
      description: 'Build and watch @openspecui/search dist output.',
      command: 'pnpm',
      args: ['--filter', '@openspecui/search', 'dev'],
      autoStart: true,
    },
    {
      id: 'server-dev',
      name: 'Server Dev',
      description: `Run @openspecui/server on port ${port}.`,
      command: 'pnpm',
      args: createServerArgs({ dir, port }),
      autoStart: true,
    },
    {
      id: 'web-dev',
      name: 'Web Dev',
      description: `Run @openspecui/web with VITE_API_URL=${apiUrl}.`,
      command: 'pnpm',
      args: ['--filter', '@openspecui/web', 'dev'],
      env: {
        VITE_API_URL: apiUrl,
        OPENSPEC_SERVER_PORT: String(port),
      },
      autoStart: true,
    },
    {
      id: 'app-dev',
      name: 'Hosted App Dev',
      description: `Run @openspecui/app and seed the hosted shell with ${apiUrl}.`,
      command: 'pnpm',
      args: ['--filter', '@openspecui/app', 'dev'],
      env: {
        OPENSPECUI_APP_DEV_MODE: '1',
        OPENSPECUI_APP_DEV_WEB_DIST: webDistDir,
        OPENSPECUI_APP_DEV_VERSION: webPackageVersion,
        VITE_OPENSPECUI_APP_DEFAULT_API_URL: apiUrl,
      },
      autoStart: true,
    },
    {
      id: 'website-dev',
      name: 'Website Dev',
      description: 'Optional task. Starts only when you press Enter.',
      command: 'pnpm',
      args: ['--filter', '@openspecui/website', 'dev'],
      autoStart: false,
    },
    {
      id: 'web-tsc-watch',
      name: 'Web Typecheck Watch',
      description: 'Optional task. Starts only when you press Enter.',
      command: 'pnpm',
      args: ['--filter', '@openspecui/web', 'exec', 'tsc', '--noEmit', '--watch'],
      autoStart: false,
    },
  ]
}

export function getHostedAppWebDistPath(repoRoot: string): string {
  return join(repoRoot, 'packages', 'web', 'dist')
}
