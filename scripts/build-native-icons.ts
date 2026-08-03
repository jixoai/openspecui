/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Project hand-designed App identity variants into platform-native catalogs.
 *
 * Original request (2026-08-02): "我手动设计了 ./app-icon，请将它配置(复制)到 native-icons 中，
 *   你可以参考 ../skill-creator-v2 的配置。Windows 平台使用 light 风格"
 * Owner correction (2026-08-02): macOS 用 Icon Composer 官方工具产出的 .icns 直传，
 *   不再从 PNG 二次生成（避免视觉重量与官方产物不一致）；Win/Linux 仍从 PNG 生成。
 *
 * 输出对标 skill-creator-v2/resources/app-icon 的物理布局：
 *   darwin-light/dark.icns、win32-light/dark.ico、linux/{N}x{N}/app-icon.png。
 * Windows 使用 light 风格：win32-light.ico 声明 variant:['default','light']。
 *
 * 该脚本职责单一：读取 app-icon/*.{icns,png} → 写入 resources/app-icon/。
 *   不负责 copy 进 packages/app/public（由 vite 插件在构建期同步）。
 */
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { IconIco } from '@shockpkg/icon-encoder'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

const SOURCE_DIR = join(rootDir, 'app-icon')
const OUTPUT_DIR = join(rootDir, 'resources', 'app-icon')
const CACHE_PATH = join(rootDir, 'node_modules', '.cache', 'openspecui', 'native-icons.json')

/** macOS 源：Icon Composer 官方产出的 .icns（含正确的尺寸集与 dark mode 内嵌）。 */
const DARWIN_LIGHT_SOURCE = join(SOURCE_DIR, 'app-icon.default.icns')
const DARWIN_DARK_SOURCE = join(SOURCE_DIR, 'app-icon.dark.icns')

/** Win/Linux 源：Default/Dark PNG（squircle 已 baked-in）。 */
const LIGHT_PNG_SOURCE = join(SOURCE_DIR, 'app-icon.default.png')
const DARK_PNG_SOURCE = join(SOURCE_DIR, 'app-icon.dark.png')

/** ICO 嵌入尺寸（Windows 标准，大尺寸用 PNG 编码）。 */
const ICO_SIZES = [256, 128, 64, 48, 32, 16] as const

/** Linux PNG 尺寸集（与 openTrayAppIconPlugin 既有输出一致）。 */
const LINUX_SIZES = [16, 32, 48, 64, 128, 256, 512] as const

interface CacheEntry {
  readonly sourceSha256: string
  readonly outputs: ReadonlyArray<string>
}

async function sha256OfFile(path: string): Promise<string> {
  const data = await readFile(path)
  return createHash('sha256').update(data).digest('hex')
}

async function readCache(): Promise<CacheEntry | null> {
  try {
    const raw = await readFile(CACHE_PATH, 'utf-8')
    return JSON.parse(raw) as CacheEntry
  } catch {
    return null
  }
}

async function writeCache(entry: CacheEntry): Promise<void> {
  await mkdir(dirname(CACHE_PATH), { recursive: true })
  await writeFile(CACHE_PATH, JSON.stringify(entry, null, 2))
}

/** 将 1024² 源 PNG resize 到指定尺寸的 PNG Buffer。 */
async function resizePng(source: string, size: number): Promise<Buffer> {
  return sharp(source).resize(size, size, { fit: 'fill' }).png().toBuffer()
}

/** 从单一源生成 ICO：各尺寸 PNG 嵌入（256 等大尺寸自动用 PNG 编码）。 */
async function buildIco(source: string): Promise<Uint8Array> {
  const ico = new IconIco()
  for (const size of ICO_SIZES) {
    const png = await resizePng(source, size)
    await ico.addFromPng(png, null, false)
  }
  return ico.encode()
}

async function writeBytes(path: string, data: Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, data)
}

async function main(): Promise<void> {
  for (const source of [
    DARWIN_LIGHT_SOURCE,
    DARWIN_DARK_SOURCE,
    LIGHT_PNG_SOURCE,
    DARK_PNG_SOURCE,
  ]) {
    if (!existsSync(source)) {
      throw new Error(`hand-designed app-icon source not found: ${source}`)
    }
  }

  const sourceHash = createHash('sha256')
  sourceHash.update(await sha256OfFile(DARWIN_LIGHT_SOURCE))
  sourceHash.update(await sha256OfFile(DARWIN_DARK_SOURCE))
  sourceHash.update(await sha256OfFile(LIGHT_PNG_SOURCE))
  sourceHash.update(await sha256OfFile(DARK_PNG_SOURCE))
  const sourceSha256 = sourceHash.digest('hex')

  const cache = await readCache()
  const outputs = [
    join(OUTPUT_DIR, 'darwin-light.icns'),
    join(OUTPUT_DIR, 'darwin-dark.icns'),
    join(OUTPUT_DIR, 'win32-light.ico'),
    join(OUTPUT_DIR, 'win32-dark.ico'),
    ...LINUX_SIZES.map((s) => join(OUTPUT_DIR, 'linux', `${s}x${s}`, 'app-icon.png')),
  ]
  if (cache && cache.sourceSha256 === sourceSha256 && outputs.every((p) => existsSync(p))) {
    // 校验输出确实非空（避免空文件命中缓存误判）
    const allNonEmpty = await Promise.all(outputs.map((p) => stat(p).then((s) => s.size > 0)))
    if (allNonEmpty.every(Boolean)) {
      console.log(`✓ native-icons up to date (sha256 ${sourceSha256.slice(0, 12)})`)
      return
    }
  }

  console.log('▸ generating native app-icon variants from hand-designed sources...')
  await rm(OUTPUT_DIR, { force: true, recursive: true })
  await mkdir(OUTPUT_DIR, { recursive: true })

  // Darwin ICNS：直接 copy Icon Composer 官方产出的 .icns（light=default, dark）
  await writeBytes(join(OUTPUT_DIR, 'darwin-light.icns'), await readFile(DARWIN_LIGHT_SOURCE))
  await writeBytes(join(OUTPUT_DIR, 'darwin-dark.icns'), await readFile(DARWIN_DARK_SOURCE))

  // Windows ICO：light=default，dark=dark（用户要求 Windows 使用 light 风格）
  await writeBytes(join(OUTPUT_DIR, 'win32-light.ico'), await buildIco(LIGHT_PNG_SOURCE))
  await writeBytes(join(OUTPUT_DIR, 'win32-dark.ico'), await buildIco(DARK_PNG_SOURCE))

  // Linux PNG：复用 light 源（Linux 无明暗变体概念，隐式 default）
  for (const size of LINUX_SIZES) {
    const png = await resizePng(LIGHT_PNG_SOURCE, size)
    await writeBytes(join(OUTPUT_DIR, 'linux', `${size}x${size}`, 'app-icon.png'), png)
  }

  await writeCache({ sourceSha256, outputs })
  console.log(`✓ native-icons generated → ${OUTPUT_DIR} (${outputs.length} files)`)
}

await main()
