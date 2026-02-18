#!/usr/bin/env bun
/** @jsxImportSource @opentui/react */

import {
  createCliRenderer,
  type KeyEvent,
  RGBA,
  StyledText,
  type TabSelectOption,
  type TabSelectRenderable,
  type TextChunk,
} from '@opentui/core'
import { createRoot, useKeyboard, useRenderer, useTerminalDimensions } from '@opentui/react'
import { Terminal as HeadlessTerminal } from '@xterm/headless'
import { createServer } from 'node:net'
import process from 'node:process'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type CliOptions = {
  dir?: string
  port?: number
}

type DevTask = {
  id: string
  name: string
  description: string
  command: string
  args: string[]
  env?: Record<string, string>
  autoStart: boolean
}

type TaskSession = {
  taskId: string
  title: string
  output: StyledText
  startedAt: number
}

type TaskTerminalRuntime = {
  cols: number
  rows: number
  parser: HeadlessTerminal
  pty: Bun.Terminal | null
}

const HOME_TAB_ID = '__home__'
const MAX_LOG_LINES = 2000
const PORT_POLL_INTERVAL_MS = 1800
const CMD_TIMEOUT_MS = 2000
const UI_COLORS = {
  tableHeader: RGBA.fromInts(148, 163, 184),
  tableDivider: RGBA.fromInts(71, 85, 105),
  tableName: RGBA.fromInts(203, 213, 225),
  tableSelectedBg: RGBA.fromInts(30, 41, 59),
  tableSelectedFg: RGBA.fromInts(241, 245, 249),
  statusRunning: RGBA.fromInts(74, 222, 128),
  statusIdle: RGBA.fromInts(148, 163, 184),
  pid: RGBA.fromInts(125, 211, 252),
  detailLabel: RGBA.fromInts(148, 163, 184),
  detailValue: RGBA.fromInts(226, 232, 240),
} as const

function styledChunk(text: string, fg?: RGBA, bg?: RGBA): TextChunk {
  return {
    __isChunk: true,
    text,
    fg,
    bg,
  }
}

function getTerminalViewport(
  viewportWidth: number,
  viewportHeight: number
): {
  cols: number
  rows: number
} {
  // Root layout: padding(1) + header(3 lines: tabs/message/divider)
  const cols = Math.max(20, viewportWidth - 2)
  const rows = Math.max(8, viewportHeight - 5)
  return { cols, rows }
}

function plainStyledText(content: string): StyledText {
  return new StyledText([{ __isChunk: true, text: content }])
}

const ANSI_16_RGB: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [205, 49, 49],
  [13, 188, 121],
  [229, 229, 16],
  [36, 114, 200],
  [188, 63, 188],
  [17, 168, 205],
  [229, 229, 229],
  [102, 102, 102],
  [241, 76, 76],
  [35, 209, 139],
  [245, 245, 67],
  [59, 142, 234],
  [214, 112, 214],
  [41, 184, 219],
  [255, 255, 255],
]

function paletteIndexToRgb(index: number): RGBA {
  if (index >= 0 && index < 16) {
    const [r, g, b] = ANSI_16_RGB[index]!
    return RGBA.fromInts(r, g, b)
  }

  if (index >= 16 && index <= 231) {
    const value = index - 16
    const rIndex = Math.floor(value / 36)
    const gIndex = Math.floor((value % 36) / 6)
    const bIndex = value % 6
    const cube = [0, 95, 135, 175, 215, 255]
    return RGBA.fromInts(cube[rIndex]!, cube[gIndex]!, cube[bIndex]!)
  }

  const gray = Math.max(8, Math.min(238, 8 + (index - 232) * 10))
  return RGBA.fromInts(gray, gray, gray)
}

function packedRgbToRgba(rgb: number): RGBA {
  const r = (rgb >> 16) & 0xff
  const g = (rgb >> 8) & 0xff
  const b = rgb & 0xff
  return RGBA.fromInts(r, g, b)
}

function renderTerminalSnapshot(terminal: HeadlessTerminal): StyledText {
  const buffer = terminal.buffer.active
  const start = Math.max(0, buffer.length - MAX_LOG_LINES)
  const renderedLines: TextChunk[][] = []
  const cols = terminal.cols

  for (let lineIndex = start; lineIndex < buffer.length; lineIndex += 1) {
    const line = buffer.getLine(lineIndex)
    if (!line) continue

    const chunks: TextChunk[] = []
    for (let col = 0; col < cols; col += 1) {
      const cell = line.getCell(col)
      if (!cell) continue
      const width = cell.getWidth()
      if (width === 0) continue

      const chars = cell.getChars() || ' '
      let fg: RGBA | undefined
      let bg: RGBA | undefined

      if (!cell.isFgDefault()) {
        fg = cell.isFgRGB()
          ? packedRgbToRgba(cell.getFgColor())
          : paletteIndexToRgb(cell.getFgColor())
      }
      if (!cell.isBgDefault()) {
        bg = cell.isBgRGB()
          ? packedRgbToRgba(cell.getBgColor())
          : paletteIndexToRgb(cell.getBgColor())
      }

      if (cell.isInverse()) {
        const swappedFg = bg
        const swappedBg = fg
        fg = swappedFg
        bg = swappedBg
      }

      const prev = chunks[chunks.length - 1]
      if (
        prev &&
        prev.fg?.toString() === fg?.toString() &&
        prev.bg?.toString() === bg?.toString()
      ) {
        prev.text += chars
      } else {
        chunks.push({
          __isChunk: true,
          text: chars,
          fg,
          bg,
        })
      }
    }

    for (let i = chunks.length - 1; i >= 0; i -= 1) {
      const chunk = chunks[i]!
      const trimmed = chunk.text.replace(/\s+$/g, '')
      if (trimmed.length === chunk.text.length) break
      if (trimmed.length > 0) {
        chunk.text = trimmed
        break
      }
      chunks.pop()
    }

    if (line.isWrapped && renderedLines.length > 0) {
      const target = renderedLines[renderedLines.length - 1]!
      for (const chunk of chunks) {
        const prev = target[target.length - 1]
        if (
          prev &&
          prev.fg?.toString() === chunk.fg?.toString() &&
          prev.bg?.toString() === chunk.bg?.toString()
        ) {
          prev.text += chunk.text
        } else {
          target.push(chunk)
        }
      }
    } else {
      renderedLines.push(chunks)
    }
  }

  const outputChunks: TextChunk[] = []
  for (let i = 0; i < renderedLines.length; i += 1) {
    const lineChunks = renderedLines[i]!
    if (lineChunks.length === 0) {
      outputChunks.push({ __isChunk: true, text: '' })
    } else {
      outputChunks.push(...lineChunks)
    }
    if (i !== renderedLines.length - 1) {
      outputChunks.push({ __isChunk: true, text: '\n' })
    }
  }
  return new StyledText(outputChunks)
}

function supportsBunTerminal(): boolean {
  return process.platform !== 'win32'
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--dir' || arg === '-d') {
      options.dir = argv[index + 1]
      index += 1
      continue
    }
    if (arg === '--port' || arg === '-p') {
      const raw = argv[index + 1]
      if (raw) options.port = Number(raw)
      index += 1
    }
  }
  return options
}

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => {
      resolve(false)
    })
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, '127.0.0.1')
  })
}

async function findAvailablePort(start: number, tries = 10): Promise<number> {
  for (let index = 0; index <= tries; index += 1) {
    const candidate = start + index
    if (await isPortAvailable(candidate)) {
      return candidate
    }
  }
  throw new Error(`Unable to find available port near ${start}`)
}

function toCleanEnv(overrides?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value
  }
  return { ...env, ...overrides }
}

function isHomeShortcut(key: KeyEvent): boolean {
  return (
    key.sequence === '`' ||
    key.sequence === '·' ||
    key.name === '`' ||
    key.name === 'grave' ||
    key.name === 'backtick'
  )
}

function formatCell(content: string, width: number): string {
  if (width <= 0) return ''
  if (content.length <= width) return content.padEnd(width, ' ')
  if (width === 1) return content[0] ?? ' '
  return `${content.slice(0, width - 1)}…`
}

function fitLine(content: string, width: number): string {
  if (width <= 0) return ''
  if (content.length <= width) return content
  if (width === 1) return content[0] ?? ''
  return `${content.slice(0, width - 1)}…`
}

function renderFullLine(content: string, width: number): string {
  const fitted = fitLine(content, width)
  return fitted.padEnd(Math.max(0, width), ' ')
}

function extractPort(localAddress: string): string | null {
  const ipv6Match = localAddress.match(/\]:(\d+)$/)
  if (ipv6Match?.[1]) return ipv6Match[1]
  const ipv4Match = localAddress.match(/:(\d+)$/)
  return ipv4Match?.[1] ?? null
}

async function runTextCommand(
  cmd: string[],
  timeoutMs = CMD_TIMEOUT_MS
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  const child = Bun.spawn({
    cmd,
    cwd: process.cwd(),
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const timer = setTimeout(() => child.kill(), timeoutMs)
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text().catch(() => ''),
    new Response(child.stderr).text().catch(() => ''),
    child.exited.catch(() => null),
  ])
  clearTimeout(timer)

  return { exitCode, stdout, stderr }
}

function parseProcessTree(output: string): Map<number, number[]> {
  const childrenMap = new Map<number, number[]>()
  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split(/\s+/)
    if (parts.length < 2) continue
    const pid = Number(parts[0])
    const ppid = Number(parts[1])
    if (!Number.isFinite(pid) || !Number.isFinite(ppid)) continue
    const list = childrenMap.get(ppid) ?? []
    list.push(pid)
    childrenMap.set(ppid, list)
  }
  return childrenMap
}

async function getProcessTreePids(rootPid: number): Promise<number[]> {
  if (!Number.isFinite(rootPid) || rootPid <= 0) return []

  if (process.platform === 'win32') {
    const psCommand = [
      'powershell',
      '-NoProfile',
      '-Command',
      'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Csv -NoTypeInformation',
    ]
    const { stdout } = await runTextCommand(psCommand)
    const childrenMap = new Map<number, number[]>()
    for (const line of stdout.split('\n')) {
      const match = line.match(/"(\d+)","(\d+)"/)
      if (!match) continue
      const pid = Number(match[1])
      const ppid = Number(match[2])
      if (!Number.isFinite(pid) || !Number.isFinite(ppid)) continue
      const list = childrenMap.get(ppid) ?? []
      list.push(pid)
      childrenMap.set(ppid, list)
    }

    const queue = [rootPid]
    const all = new Set<number>(queue)
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const child of childrenMap.get(current) ?? []) {
        if (all.has(child)) continue
        all.add(child)
        queue.push(child)
      }
    }
    return [...all]
  }

  const { stdout } = await runTextCommand(['ps', '-eo', 'pid=,ppid='])
  const childrenMap = parseProcessTree(stdout)
  const queue = [rootPid]
  const all = new Set<number>(queue)
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const child of childrenMap.get(current) ?? []) {
      if (all.has(child)) continue
      all.add(child)
      queue.push(child)
    }
  }
  return [...all]
}

function tryKillPid(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(pid, signal)
  } catch {
    // Process may already be gone.
  }
}

async function terminateProcessTree(rootPid: number): Promise<void> {
  if (!Number.isFinite(rootPid) || rootPid <= 0) return

  if (process.platform === 'win32') {
    await runTextCommand(['taskkill', '/PID', String(rootPid), '/T', '/F'])
    return
  }

  const pids = await getProcessTreePids(rootPid)
  if (!pids.includes(rootPid)) pids.push(rootPid)
  const killList = [...new Set(pids)].sort((a, b) => b - a)

  for (const pid of killList) {
    tryKillPid(pid, 'SIGTERM')
  }
  await new Promise((resolve) => {
    setTimeout(resolve, 120)
  })
  for (const pid of killList) {
    tryKillPid(pid, 'SIGKILL')
  }
}

function parseDarwinPorts(output: string): string[] {
  const ports = new Set<string>()
  for (const line of output.split('\n')) {
    const match = line.match(/\b(TCP|UDP)\b\s+.+:(\d+)(?:\s+\(([^)]+)\))?/)
    if (!match) continue
    const protocol = match[1] as 'TCP' | 'UDP'
    const port = match[2]
    const state = match[3] ?? ''
    if (protocol === 'TCP' && !state.includes('LISTEN')) continue
    ports.add(`${protocol}:${port}`)
  }
  return [...ports].sort()
}

function parseLinuxPorts(output: string, pidSet: ReadonlySet<number>): string[] {
  const ports = new Set<string>()
  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const protocolToken = trimmed.split(/\s+/)[0] ?? ''
    const protocol = protocolToken.startsWith('tcp')
      ? 'TCP'
      : protocolToken.startsWith('udp')
        ? 'UDP'
        : null
    if (!protocol) continue

    let matchedPid = false
    for (const pidMatch of trimmed.matchAll(/pid=(\d+)/g)) {
      const pid = Number(pidMatch[1])
      if (pidSet.has(pid)) {
        matchedPid = true
        break
      }
    }
    if (!matchedPid) continue

    const fields = trimmed.split(/\s+/)
    const localAddress = fields[4] ?? ''
    const port = extractPort(localAddress)
    if (!port) continue
    ports.add(`${protocol}:${port}`)
  }
  return [...ports].sort()
}

function parseWindowsPorts(
  output: string,
  protocol: 'TCP' | 'UDP',
  pidSet: ReadonlySet<number>
): string[] {
  const ports = new Set<string>()
  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith(protocol)) continue
    const parts = trimmed.split(/\s+/)
    const local = parts[1] ?? ''
    const pidToken = protocol === 'TCP' ? parts[4] : parts[3]
    const pid = Number(pidToken)
    if (!Number.isFinite(pid) || !pidSet.has(pid)) continue
    const port = extractPort(local)
    if (!port) continue
    ports.add(`${protocol}:${port}`)
  }
  return [...ports]
}

async function collectPortsForPids(pids: number[]): Promise<string[]> {
  if (pids.length === 0) return []
  const pidSet = new Set(pids)

  if (process.platform === 'darwin') {
    const { stdout } = await runTextCommand([
      'lsof',
      '-nP',
      '-a',
      '-p',
      pids.join(','),
      '-iTCP',
      '-iUDP',
    ])
    return parseDarwinPorts(stdout)
  }

  if (process.platform === 'linux') {
    const { stdout } = await runTextCommand(['ss', '-H', '-ltnup'])
    return parseLinuxPorts(stdout, pidSet)
  }

  if (process.platform === 'win32') {
    const [tcpResult, udpResult] = await Promise.all([
      runTextCommand(['netstat', '-ano', '-p', 'tcp']),
      runTextCommand(['netstat', '-ano', '-p', 'udp']),
    ])
    return [
      ...parseWindowsPorts(tcpResult.stdout, 'TCP', pidSet),
      ...parseWindowsPorts(udpResult.stdout, 'UDP', pidSet),
    ].sort()
  }

  return []
}

function DevApp({ tasks }: { tasks: readonly DevTask[] }) {
  const renderer = useRenderer()
  const { width, height } = useTerminalDimensions()
  const [sessions, setSessions] = useState<TaskSession[]>([])
  const [activeTabId, setActiveTabId] = useState<string>(HOME_TAB_ID)
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(0)
  const [runningPidsByTask, setRunningPidsByTask] = useState<Record<string, number>>({})
  const [boundPortsByTask, setBoundPortsByTask] = useState<Record<string, string>>({})

  const processByTaskRef = useRef(new Map<string, Bun.Subprocess>())
  const restartQueueRef = useRef(new Set<string>())
  const shuttingDownRef = useRef(false)
  const didAutoStartRef = useRef(false)
  const activeTabRef = useRef(activeTabId)
  const tabSelectRef = useRef<TabSelectRenderable | null>(null)
  const terminalByTaskRef = useRef(new Map<string, TaskTerminalRuntime>())
  const writeQueueByTaskRef = useRef(new Map<string, Promise<void>>())
  const viewportRef = useRef({ width, height })
  const outputSnapshotByTaskRef = useRef(new Map<string, StyledText>())
  const dirtyOutputTasksRef = useRef(new Set<string>())
  const flushOutputTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    activeTabRef.current = activeTabId
  }, [activeTabId])

  useEffect(() => {
    viewportRef.current = { width, height }
  }, [width, height])

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])

  const tabs = useMemo(
    () => [
      { id: HOME_TAB_ID, name: 'Tasks' },
      ...sessions
        .slice()
        .sort((a, b) => a.startedAt - b.startedAt)
        .map((session) => ({ id: session.taskId, name: session.title })),
    ],
    [sessions]
  )

  const activeTabIndex = useMemo(
    () =>
      Math.max(
        0,
        tabs.findIndex((tab) => tab.id === activeTabId)
      ),
    [activeTabId, tabs]
  )

  const activeSession = useMemo(
    () => sessions.find((session) => session.taskId === activeTabId),
    [activeTabId, sessions]
  )
  const tabOptions = useMemo<TabSelectOption[]>(
    () =>
      tabs.map((tab, index) => ({
        name: `${index === 0 ? '`' : String(index)}:${tab.name}`,
        description: '',
        value: tab.id,
      })),
    [tabs]
  )

  const setTaskOutput = useCallback((taskId: string, output: StyledText) => {
    outputSnapshotByTaskRef.current.set(taskId, output)
    setSessions((prev) =>
      prev.map((session) =>
        session.taskId !== taskId
          ? session
          : {
              ...session,
              output,
            }
      )
    )
  }, [])

  const snapshotTaskOutput = useCallback(
    (taskId: string) => {
      const runtime = terminalByTaskRef.current.get(taskId)
      if (!runtime) return
      setTaskOutput(taskId, renderTerminalSnapshot(runtime.parser))
    },
    [setTaskOutput]
  )

  const flushTaskOutputSnapshots = useCallback(() => {
    flushOutputTimerRef.current = null
    const pendingTaskIds = [...dirtyOutputTasksRef.current]
    dirtyOutputTasksRef.current.clear()
    for (const taskId of pendingTaskIds) {
      const runtime = terminalByTaskRef.current.get(taskId)
      if (!runtime) continue
      const snapshot = renderTerminalSnapshot(runtime.parser)
      outputSnapshotByTaskRef.current.set(taskId, snapshot)
      if (taskId === activeTabRef.current) {
        setTaskOutput(taskId, snapshot)
      }
    }
  }, [setTaskOutput])

  const scheduleTaskOutputSnapshot = useCallback(
    (taskId: string) => {
      dirtyOutputTasksRef.current.add(taskId)
      if (flushOutputTimerRef.current !== null) return
      flushOutputTimerRef.current = setTimeout(() => {
        flushTaskOutputSnapshots()
      }, 33)
    },
    [flushTaskOutputSnapshots]
  )

  const enqueueTerminalWrite = useCallback(
    (taskId: string, chunk: string | Uint8Array) => {
      const runtime = terminalByTaskRef.current.get(taskId)
      if (!runtime) return

      const queue = writeQueueByTaskRef.current.get(taskId) ?? Promise.resolve()
      const nextQueue = queue
        .catch(() => undefined)
        .then(
          () =>
            new Promise<void>((resolve) => {
              runtime.parser.write(chunk, () => {
                scheduleTaskOutputSnapshot(taskId)
                resolve()
              })
            })
        )
        .catch((error) => {
          setTaskOutput(taskId, plainStyledText(`[render error] ${String(error)}`))
        })
      writeQueueByTaskRef.current.set(taskId, nextQueue)
    },
    [scheduleTaskOutputSnapshot, setTaskOutput]
  )

  const disposeTaskTerminal = useCallback((taskId: string) => {
    const runtime = terminalByTaskRef.current.get(taskId)
    if (runtime) {
      runtime.pty?.close()
      runtime.parser.dispose()
    }
    terminalByTaskRef.current.delete(taskId)
    writeQueueByTaskRef.current.delete(taskId)
    outputSnapshotByTaskRef.current.delete(taskId)
    dirtyOutputTasksRef.current.delete(taskId)
  }, [])

  const startTask = useCallback(
    (taskId: string, options?: { focus?: boolean }) => {
      const task = taskById.get(taskId)
      if (!task) return

      const running = processByTaskRef.current.get(task.id)
      if (running) {
        if (options?.focus) setActiveTabId(task.id)
        return
      }

      const commandLine = [task.command, ...task.args].join(' ')
      disposeTaskTerminal(task.id)
      const viewport = viewportRef.current
      const { cols, rows } = getTerminalViewport(viewport.width, viewport.height)
      const parser = new HeadlessTerminal({
        allowProposedApi: true,
        windowsMode: process.platform === 'win32',
        cols,
        rows,
        scrollback: MAX_LOG_LINES,
      })
      const pty = supportsBunTerminal()
        ? new Bun.Terminal({
            cols,
            rows,
            name: process.env.TERM ?? 'xterm-256color',
            data: (_terminal, data) => {
              if (!data) return
              enqueueTerminalWrite(task.id, data)
            },
          })
        : null
      terminalByTaskRef.current.set(task.id, {
        cols,
        rows,
        parser,
        pty,
      })
      writeQueueByTaskRef.current.set(task.id, Promise.resolve())
      outputSnapshotByTaskRef.current.set(task.id, plainStyledText(''))

      setSessions((prev) => [
        ...prev.filter((session) => session.taskId !== task.id),
        {
          taskId: task.id,
          title: task.name,
          output: plainStyledText(''),
          startedAt: Date.now(),
        },
      ])
      enqueueTerminalWrite(task.id, `$ ${commandLine}\r\n`)
      if (options?.focus) setActiveTabId(task.id)

      const spawnEnv = {
        ...task.env,
        COLUMNS: task.env?.COLUMNS ?? String(cols),
        LINES: task.env?.LINES ?? String(rows),
        TERM: task.env?.TERM ?? process.env.TERM ?? 'xterm-256color',
        COLORTERM: task.env?.COLORTERM ?? process.env.COLORTERM ?? 'truecolor',
        FORCE_COLOR: task.env?.FORCE_COLOR ?? process.env.FORCE_COLOR ?? '1',
      }

      const spawnCmd = [task.command, ...task.args]
      const child = pty
        ? Bun.spawn({
            cmd: spawnCmd,
            cwd: process.cwd(),
            env: toCleanEnv(spawnEnv),
            terminal: pty,
          })
        : Bun.spawn({
            cmd: spawnCmd,
            cwd: process.cwd(),
            env: toCleanEnv(spawnEnv),
            stdin: 'ignore',
            stdout: 'pipe',
            stderr: 'pipe',
          })
      processByTaskRef.current.set(task.id, child)
      setRunningPidsByTask((prev) => ({ ...prev, [task.id]: child.pid }))

      if (!pty) {
        const pipeOutput = async (stream: ReadableStream<Uint8Array> | null) => {
          if (!stream) return
          const reader = stream.getReader()
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            if (!value || value.byteLength === 0) continue
            enqueueTerminalWrite(task.id, value)
          }
        }

        void pipeOutput(child.stdout).catch((error) => {
          enqueueTerminalWrite(task.id, `\r\n[stdout error] ${String(error)}\r\n`)
        })
        void pipeOutput(child.stderr).catch((error) => {
          enqueueTerminalWrite(task.id, `\r\n[stderr error] ${String(error)}\r\n`)
        })
      }

      void child.exited.then((code) => {
        processByTaskRef.current.delete(task.id)
        setRunningPidsByTask((prev) => {
          const next = { ...prev }
          delete next[task.id]
          return next
        })
        setBoundPortsByTask((prev) => {
          const next = { ...prev }
          delete next[task.id]
          return next
        })

        const restartRequested = restartQueueRef.current.delete(task.id)
        setSessions((prev) => prev.filter((session) => session.taskId !== task.id))
        disposeTaskTerminal(task.id)
        if (activeTabRef.current === task.id) setActiveTabId(HOME_TAB_ID)

        if (!shuttingDownRef.current && restartRequested) {
          startTask(task.id, { focus: true })
          return
        }
        if (!shuttingDownRef.current && code !== 0) {
          console.error(`[${task.id}] exited with code ${code}`)
        }
      })
    },
    [disposeTaskTerminal, enqueueTerminalWrite, taskById]
  )

  const stopTask = useCallback((taskId: string) => {
    restartQueueRef.current.delete(taskId)
    const processRef = processByTaskRef.current.get(taskId)
    if (!processRef) return
    const pid = processRef.pid
    void terminateProcessTree(pid)
  }, [])

  const restartTask = useCallback(
    (taskId: string) => {
      const processRef = processByTaskRef.current.get(taskId)
      if (!processRef) {
        startTask(taskId, { focus: true })
        return
      }
      const pid = processRef.pid
      restartQueueRef.current.add(taskId)
      void terminateProcessTree(pid)
    },
    [startTask]
  )

  const terminateAll = useCallback(async () => {
    restartQueueRef.current.clear()
    const terminateTasks: Promise<void>[] = []
    for (const child of processByTaskRef.current.values()) {
      terminateTasks.push(terminateProcessTree(child.pid))
    }
    processByTaskRef.current.clear()
    for (const taskId of terminalByTaskRef.current.keys()) {
      disposeTaskTerminal(taskId)
    }
    await Promise.allSettled(terminateTasks)
  }, [disposeTaskTerminal])

  const shutdown = useCallback(() => {
    if (shuttingDownRef.current) return
    shuttingDownRef.current = true
    void (async () => {
      await terminateAll()
      renderer.destroy()
      process.exit(0)
    })()
  }, [renderer, terminateAll])

  useEffect(() => {
    if (didAutoStartRef.current) return
    didAutoStartRef.current = true
    for (const task of tasks) {
      if (task.autoStart) startTask(task.id)
    }
  }, [startTask, tasks])

  useEffect(() => {
    return () => {
      shuttingDownRef.current = true
      if (flushOutputTimerRef.current !== null) {
        clearTimeout(flushOutputTimerRef.current)
      }
      void terminateAll()
    }
  }, [terminateAll])

  useEffect(() => {
    const { cols, rows } = getTerminalViewport(width, height)
    for (const [taskId, runtime] of terminalByTaskRef.current.entries()) {
      runtime.cols = cols
      runtime.rows = rows
      runtime.pty?.resize(cols, rows)
      runtime.parser.resize(cols, rows)
      outputSnapshotByTaskRef.current.set(taskId, renderTerminalSnapshot(runtime.parser))
      if (taskId === activeTabRef.current) {
        snapshotTaskOutput(taskId)
      }
    }
  }, [height, snapshotTaskOutput, width])

  useEffect(() => {
    if (activeTabId === HOME_TAB_ID) return
    const cachedOutput = outputSnapshotByTaskRef.current.get(activeTabId)
    if (cachedOutput !== undefined) {
      setTaskOutput(activeTabId, cachedOutput)
      return
    }
    snapshotTaskOutput(activeTabId)
  }, [activeTabId, setTaskOutput, snapshotTaskOutput])

  useEffect(() => {
    let cancelled = false

    const pollPorts = async () => {
      const entries = Object.entries(runningPidsByTask)
      if (entries.length === 0) {
        if (!cancelled) setBoundPortsByTask({})
        return
      }

      const next: Record<string, string> = {}
      await Promise.all(
        entries.map(async ([taskId, pid]) => {
          const pids = await getProcessTreePids(pid)
          const ports = await collectPortsForPids(pids)
          next[taskId] = ports.length > 0 ? ports.join(',') : '-'
        })
      )

      if (!cancelled) setBoundPortsByTask(next)
    }

    void pollPorts()
    const timer = setInterval(() => {
      void pollPorts()
    }, PORT_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [runningPidsByTask])

  useKeyboard((key) => {
    const keyName = key.name ?? key.sequence

    if (key.ctrl && key.name === 'c') {
      shutdown()
      return
    }
    if (keyName === 'q') {
      shutdown()
      return
    }
    if (isHomeShortcut(key)) {
      setActiveTabId(HOME_TAB_ID)
      return
    }

    if (keyName === 'left') {
      const nextIndex = (activeTabIndex - 1 + tabs.length) % tabs.length
      setActiveTabId(tabs[nextIndex]!.id)
      return
    }
    if (keyName === 'right') {
      const nextIndex = (activeTabIndex + 1) % tabs.length
      setActiveTabId(tabs[nextIndex]!.id)
      return
    }

    if (keyName >= '1' && keyName <= '4') {
      const dynamicTabs = tabs.slice(1)
      const target = dynamicTabs[Number(keyName) - 1]
      if (target) setActiveTabId(target.id)
      return
    }

    if (activeTabId === HOME_TAB_ID && keyName === 'up') {
      setSelectedTaskIndex((prev) => Math.max(0, prev - 1))
      return
    }
    if (activeTabId === HOME_TAB_ID && keyName === 'down') {
      setSelectedTaskIndex((prev) => Math.min(tasks.length - 1, prev + 1))
      return
    }
    if (activeTabId === HOME_TAB_ID && keyName === 'enter') {
      const selectedTask = tasks[selectedTaskIndex]
      if (selectedTask) startTask(selectedTask.id, { focus: true })
      return
    }

    const selectedTask = tasks[selectedTaskIndex]
    const targetTaskId = activeTabId === HOME_TAB_ID ? selectedTask?.id : activeTabId
    if (!targetTaskId) return

    if (keyName === 's') {
      stopTask(targetTaskId)
      return
    }
    if (keyName === 'r') {
      restartTask(targetTaskId)
    }
  })

  useEffect(() => {
    tabSelectRef.current?.setSelectedIndex(activeTabIndex)
  }, [activeTabIndex, tabOptions.length])

  const selectedTask = tasks[selectedTaskIndex]
  const selectedTaskPorts = selectedTask ? (boundPortsByTask[selectedTask.id] ?? '-') : '-'

  const homeStyled = useMemo(() => {
    const innerWidth = Math.max(36, width - 2)
    const statusWidth = 8
    const pidWidth = 8
    const nameWidth = Math.max(10, innerWidth - statusWidth - pidWidth - 6)
    const chunks: TextChunk[] = []
    const appendLine = (lineChunks: TextChunk[]): void => {
      chunks.push(...lineChunks, styledChunk('\n'))
    }

    appendLine([
      styledChunk(formatCell('name', nameWidth), UI_COLORS.tableHeader),
      styledChunk(' | ', UI_COLORS.tableDivider),
      styledChunk(formatCell('status', statusWidth), UI_COLORS.tableHeader),
      styledChunk(' | ', UI_COLORS.tableDivider),
      styledChunk(formatCell('pid', pidWidth), UI_COLORS.tableHeader),
    ])

    appendLine([
      styledChunk(
        `${'-'.repeat(nameWidth)}-+-${'-'.repeat(statusWidth)}-+-${'-'.repeat(pidWidth)}`,
        UI_COLORS.tableDivider
      ),
    ])

    for (let index = 0; index < tasks.length; index += 1) {
      const task = tasks[index]!
      const status = runningPidsByTask[task.id] ? 'running' : 'idle'
      const pid = runningPidsByTask[task.id] ? String(runningPidsByTask[task.id]) : '-'
      const name = index === selectedTaskIndex ? `> ${task.name}` : `  ${task.name}`
      const rowBg = index === selectedTaskIndex ? UI_COLORS.tableSelectedBg : undefined
      const nameFg = rowBg ? UI_COLORS.tableSelectedFg : UI_COLORS.tableName
      const statusFg =
        status === 'running'
          ? UI_COLORS.statusRunning
          : rowBg
            ? UI_COLORS.tableSelectedFg
            : UI_COLORS.statusIdle
      const pidFg = rowBg ? UI_COLORS.tableSelectedFg : UI_COLORS.pid

      appendLine([
        styledChunk(formatCell(name, nameWidth), nameFg, rowBg),
        styledChunk(' | ', UI_COLORS.tableDivider, rowBg),
        styledChunk(formatCell(status, statusWidth), statusFg, rowBg),
        styledChunk(' | ', UI_COLORS.tableDivider, rowBg),
        styledChunk(formatCell(pid, pidWidth), pidFg, rowBg),
      ])
    }

    appendLine([styledChunk('')])

    const appendDetailLine = (label: string, value: string): void => {
      const prefix = `${label}: `
      const remaining = Math.max(0, innerWidth - prefix.length)
      appendLine([
        styledChunk(prefix, UI_COLORS.detailLabel),
        styledChunk(formatCell(value, remaining), UI_COLORS.detailValue),
      ])
    }

    appendDetailLine('description', selectedTask?.description ?? '-')
    appendDetailLine(
      'command',
      selectedTask ? [selectedTask.command, ...selectedTask.args].join(' ') : '-'
    )
    appendDetailLine('ports', selectedTaskPorts)

    if (chunks.length > 0 && chunks[chunks.length - 1]?.text === '\n') {
      chunks.pop()
    }
    return new StyledText(chunks)
  }, [runningPidsByTask, selectedTask, selectedTaskIndex, selectedTaskPorts, tasks, width])

  const innerWidth = Math.max(8, width - 2)
  const messageLine = renderFullLine(
    'Enter:start  S:stop  R:restart  <-/->:tab  1-4  `:home  Q/Ctrl+C:quit',
    innerWidth
  )
  const divider = '─'.repeat(Math.max(8, width - 2))

  return (
    <box width="100%" height="100%" padding={1} flexDirection="column">
      <box height={1} width="100%">
        <tab-select
          ref={tabSelectRef}
          focused={false}
          width="100%"
          height={1}
          options={tabOptions}
          tabWidth={16}
          showDescription={false}
          showUnderline={false}
          showScrollArrows
          wrapSelection
          backgroundColor="transparent"
          focusedBackgroundColor="transparent"
          textColor="#d1d5db"
          focusedTextColor="#d1d5db"
          selectedBackgroundColor="#d1d5db"
          selectedTextColor="#111827"
          onChange={(_, option) => {
            if (typeof option?.value === 'string') {
              setActiveTabId(option.value)
            }
          }}
        />
      </box>
      <box height={1}>
        <text>{messageLine}</text>
      </box>
      <box height={1}>
        <text>{divider}</text>
      </box>

      <box flexGrow={1}>
        {activeTabId === HOME_TAB_ID ? (
          <scrollbox key="home" focused height="100%">
            <text content={homeStyled} />
          </scrollbox>
        ) : (
          <scrollbox key={`tab:${activeTabId}`} focused height="100%">
            <text
              content={
                activeSession?.output ||
                outputSnapshotByTaskRef.current.get(activeTabId) ||
                plainStyledText('No output.')
              }
            />
          </scrollbox>
        )}
      </box>
    </box>
  )
}

const options = parseArgs(Bun.argv.slice(2))
const preferredPort =
  options.port ?? Number(process.env.OPENSPEC_SERVER_PORT || process.env.PORT || 3100)
const port = await findAvailablePort(preferredPort, 10)
const apiUrl = process.env.VITE_API_URL || `http://localhost:${port}`

const bootstrap = Bun.spawnSync({
  cmd: ['pnpm', '--filter', '@openspecui/core', 'build'],
  cwd: process.cwd(),
  stdout: 'inherit',
  stderr: 'inherit',
})
if (bootstrap.exitCode !== 0) {
  throw new Error(`Failed to build @openspecui/core (exit ${bootstrap.exitCode})`)
}
const searchBootstrap = Bun.spawnSync({
  cmd: ['pnpm', '--filter', '@openspecui/search', 'build'],
  cwd: process.cwd(),
  stdout: 'inherit',
  stderr: 'inherit',
})
if (searchBootstrap.exitCode !== 0) {
  throw new Error(`Failed to build @openspecui/search (exit ${searchBootstrap.exitCode})`)
}

const serverArgs = ['--filter', '@openspecui/server', 'dev', '--', '--port', String(port)]
if (options.dir) {
  serverArgs.push('--dir', options.dir)
}

const tasks: DevTask[] = [
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
    args: serverArgs,
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
    id: 'web-tsc-watch',
    name: 'Web Typecheck Watch',
    description: 'Optional task. Starts only when you press Enter.',
    command: 'pnpm',
    args: ['--filter', '@openspecui/web', 'exec', 'tsc', '--noEmit', '--watch'],
    autoStart: false,
  },
]

const renderer = await createCliRenderer({ exitOnCtrlC: false })
createRoot(renderer).render(<DevApp tasks={tasks} />)
