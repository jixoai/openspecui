#!/usr/bin/env node
/**
 * SSG CLI - Pre-render OpenSpec UI to static HTML
 *
 * This CLI uses prebuilt client/server assets to generate static HTML pages.
 * The client and server are built during `pnpm build` and bundled with the package.
 *
 * Usage:
 *   npx openspecui-ssg --data ./data.json --output ./dist
 *   npx openspecui-ssg -d ./data.json -o ./dist --base-path /docs
 */
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveSsgTemplatePath } from './template-path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Detect if running from source (dev mode) or from dist (production)
// In dev mode: __dirname is src/ssg/, assets are in dist-ssg/
// In production: __dirname is dist-ssg/, assets are in dist-ssg/
function getSSGDirs() {
  // Check if we're in src/ssg (dev mode with tsx)
  if (__dirname.endsWith('src/ssg') || __dirname.includes('src/ssg')) {
    const pkgRoot = resolve(__dirname, '../..')
    return {
      client: resolve(pkgRoot, 'dist-ssg/client'),
      server: resolve(pkgRoot, 'dist-ssg/server'),
    }
  }
  // Production mode: relative to dist-ssg/ssg-cli.mjs
  return {
    client: resolve(__dirname, 'client'),
    server: resolve(__dirname, 'server'),
  }
}

const { client: SSG_CLIENT_DIR, server: SSG_SERVER_DIR } = getSSGDirs()

interface Options {
  data: string
  output: string
  basePath: string
}

function parseArgs(): Options {
  const args = process.argv.slice(2)
  const options: Options = { data: '', output: '', basePath: '/' }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--data' || arg === '-d') options.data = args[++i]
    else if (arg === '--output' || arg === '-o') options.output = args[++i]
    else if (arg === '--base-path' || arg === '-b') options.basePath = args[++i]
    else if (arg === '--help' || arg === '-h') {
      console.log(`
OpenSpec UI SSG CLI

Usage:
  npx openspecui-ssg --data <data.json> --output <dir> [options]

Options:
  -d, --data <file>       Path to data.json (required)
  -o, --output <dir>      Output directory (required)
  -b, --base-path <path>  Base path for deployment (default: /)
  -h, --help              Show this help message
`)
      process.exit(0)
    }
  }

  if (!options.data || !options.output) {
    console.error('Error: --data and --output are required')
    console.error('Run with --help for usage information')
    process.exit(1)
  }

  return options
}

async function prerender(opts: {
  clientDir: string
  serverDir: string
  dataPath: string
  basePath: string
}) {
  const snapshot = JSON.parse(readFileSync(opts.dataPath, 'utf-8'))
  const template = readFileSync(resolveSsgTemplatePath(opts.clientDir), 'utf-8')

  const serverPath = join(opts.serverDir, 'entry-server.js')
  const { render, getRoutes, getTitle } = await import(serverPath)

  const routes = getRoutes(snapshot)
  console.log(`Routes: ${routes.length}`)
  let hasRootRoute = false

  const headTags = `
    <script>
      window.__OPENSPEC_BASE_PATH__ = '${opts.basePath}';
      window.__OPENSPEC_STATIC_MODE__ = true;
      window.__INITIAL_DATA__ = ${JSON.stringify(snapshot)};
    </script>`

  for (const route of routes) {
    const appHtml = await render(route, snapshot, opts.basePath)
    const title = getTitle(route, snapshot)
    const html = template
      .replace('<!--app-html-->', appHtml)
      .replace('<!--head-tags-->', headTags)
      .replace('<title>OpenSpec UI</title>', `<title>${title} - OpenSpec UI</title>`)

    if (route === '/') {
      hasRootRoute = true
      writeFileSync(join(opts.clientDir, 'index.html'), html)
    } else {
      const routeDir = join(opts.clientDir, route.slice(1))
      mkdirSync(routeDir, { recursive: true })
      writeFileSync(join(routeDir, 'index.html'), html)
    }
    console.log(`  ${route}`)
  }

  if (!hasRootRoute) {
    const fallbackRoute = routes[0]
    if (!fallbackRoute) {
      throw new Error('No routes generated for static output')
    }
    const fallbackPath =
      fallbackRoute === '/'
        ? join(opts.clientDir, 'index.html')
        : join(opts.clientDir, fallbackRoute.slice(1), 'index.html')
    copyFileSync(fallbackPath, join(opts.clientDir, 'index.html'))
  }

  copyFileSync(join(opts.clientDir, 'index.html'), join(opts.clientDir, '404.html'))
  copyFileSync(opts.dataPath, join(opts.clientDir, 'data.json'))
  rmSync(join(opts.clientDir, '.vite'), { recursive: true, force: true })
}

async function main() {
  const options = parseArgs()
  const outputDir = resolve(options.output)
  const dataPath = resolve(options.data)

  console.log('\n=== OpenSpec UI SSG ===\n')

  // Validate prebuilt assets exist
  if (!existsSync(SSG_CLIENT_DIR)) {
    console.error(`Error: SSG client not found: ${SSG_CLIENT_DIR}`)
    console.error('This usually means the package was not built correctly.')
    process.exit(1)
  }
  if (!existsSync(SSG_SERVER_DIR)) {
    console.error(`Error: SSG server not found: ${SSG_SERVER_DIR}`)
    console.error('This usually means the package was not built correctly.')
    process.exit(1)
  }

  // Validate data.json exists
  if (!existsSync(dataPath)) {
    console.error(`Error: Data file not found: ${dataPath}`)
    process.exit(1)
  }

  // Read and validate data.json
  const snapshot = JSON.parse(readFileSync(dataPath, 'utf-8'))
  console.log(
    `Data: ${snapshot.specs?.length || 0} specs, ${snapshot.changes?.length || 0} changes, ${snapshot.archives?.length || 0} archives`
  )

  // Copy client assets to output directory
  console.log('\nCopying client assets...')
  mkdirSync(outputDir, { recursive: true })
  cpSync(SSG_CLIENT_DIR, outputDir, { recursive: true })

  // Run prerender
  console.log('\nPre-rendering pages...')
  await prerender({
    clientDir: outputDir,
    serverDir: SSG_SERVER_DIR,
    dataPath,
    basePath: options.basePath,
  })

  console.log(`\nDone! Static site generated to ${outputDir}\n`)
}

main().catch((err) => {
  console.error('SSG failed:', err.message)
  process.exit(1)
})
