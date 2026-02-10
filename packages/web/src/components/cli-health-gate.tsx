import { isStaticMode } from '@/lib/static-mode'
import { trpc } from '@/lib/trpc'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { AlertCircle } from 'lucide-react'

interface Semver {
  major: number
  minor: number
  patch: number
}

const MIN_VERSION: Semver = { major: 1, minor: 1, patch: 0 }

function parseVersion(raw: string | undefined): Semver | null {
  if (!raw) return null
  const match = raw.match(/(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

function isAtLeast(version: Semver, required: Semver): boolean {
  if (version.major !== required.major) return version.major > required.major
  if (version.minor !== required.minor) return version.minor > required.minor
  return version.patch >= required.patch
}

export function CliHealthGate() {
  if (isStaticMode()) return null

  const { data, isLoading } = useQuery({
    ...trpc.cli.checkAvailability.queryOptions(),
  })

  if (isLoading) {
    return null
  }

  const version = parseVersion(data?.version)
  const compatible = version ? isAtLeast(version, MIN_VERSION) : false

  if (data?.available && compatible) {
    return null
  }

  const reason = !data?.available
    ? data?.error || 'OpenSpec CLI not found.'
    : data?.version
      ? `Detected ${data.version}, requires >= ${MIN_VERSION.major}.${MIN_VERSION.minor}.${MIN_VERSION.patch}.`
      : 'Unable to parse CLI version.'

  return (
    <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="border-border mx-4 max-w-xl space-y-4 rounded-lg border bg-background p-6 shadow-xl">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          OpenSpec CLI Required
        </div>
        <p className="text-muted-foreground text-sm">{reason}</p>
        <div className="text-muted-foreground text-sm">
          Install or upgrade the CLI:
          <code className="bg-muted ml-2 rounded px-1">npm install -g @fission-ai/openspec</code>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/settings"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm hover:opacity-90"
          >
            Open Settings
          </Link>
        </div>
      </div>
    </div>
  )
}
