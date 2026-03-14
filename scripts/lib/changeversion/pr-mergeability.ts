import { spawnSync } from 'node:child_process'

const DEFAULT_POLL_INTERVAL_MS = 5000
const READY_MERGE_STATES = new Set(['CLEAN', 'HAS_HOOKS', 'UNSTABLE'])

export type PrMergeability = {
  isDraft: boolean
  mergeStateStatus: string
  state: 'CLOSED' | 'MERGED' | 'OPEN'
}

type CaptureRunResult = {
  status: number
  stdout: string
  stderr: string
}

type WaitOptions = {
  now?: () => number
  pollIntervalMs?: number
  sleepMs?: (ms: number) => void
}

function commandForGh(): string {
  return process.platform === 'win32' ? 'gh.exe' : 'gh'
}

function runCaptureResult(args: string[]): CaptureRunResult {
  const result = spawnSync(commandForGh(), args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return {
    status: result.status ?? 1,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  }
}

function sleepMs(ms: number): void {
  const lock = new Int32Array(new SharedArrayBuffer(4))
  Atomics.wait(lock, 0, 0, ms)
}

export function isPrReadyToMerge(pr: PrMergeability): boolean {
  return pr.state === 'OPEN' && !pr.isDraft && READY_MERGE_STATES.has(pr.mergeStateStatus)
}

export function loadGhPrMergeability(prNumber: number): PrMergeability {
  const result = runCaptureResult([
    'pr',
    'view',
    String(prNumber),
    '--json',
    'isDraft,mergeStateStatus,state',
  ])
  if (result.status !== 0) {
    const detail = result.stderr || result.stdout || `gh pr view failed for PR #${prNumber}`
    throw new Error(detail)
  }
  return JSON.parse(result.stdout) as PrMergeability
}

export function waitForPrMergeability(
  readPr: () => PrMergeability,
  timeoutMs: number,
  options: WaitOptions = {}
): PrMergeability {
  const now = options.now ?? Date.now
  const wait = options.sleepMs ?? sleepMs
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const deadline = now() + timeoutMs
  let lastState: PrMergeability | null = null

  while (now() < deadline) {
    const current = readPr()
    lastState = current

    if (isPrReadyToMerge(current)) {
      return current
    }
    if (current.state !== 'OPEN') {
      throw new Error(`PR is no longer open (state: ${current.state}).`)
    }

    wait(pollIntervalMs)
  }

  const detail = lastState
    ? `Last mergeStateStatus=${lastState.mergeStateStatus}, draft=${String(lastState.isDraft)}.`
    : 'No mergeability state was observed.'
  throw new Error(`Timed out waiting for PR mergeability. ${detail}`)
}
