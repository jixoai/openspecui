/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Build Direct/hosted worktree navigation on the target child Server origin.
 * 2. Carry the parent in-memory Access Gate only through the private child fragment.
 *
 * Original request (2026-07-24): "A protected parent must not hand off to an unreachable child."
 */
import type { GitWorktreeHandoff } from '@openspecui/core'
import { ACCESS_GATE_CREDENTIAL_FRAGMENT_PARAM } from '@openspecui/core/hosted-app'
import { getAccessGateCredential } from './access-gate-credential'
import { getHostedApiBootstrapState } from './hosted-session'

function bindAccessGateCredential(targetUrl: URL): void {
  const credential = getAccessGateCredential()
  if (!credential) return
  const fragment = new URLSearchParams(targetUrl.hash.slice(1))
  fragment.set(ACCESS_GATE_CREDENTIAL_FRAGMENT_PARAM, credential)
  targetUrl.hash = fragment.toString()
}

export function buildServerHandoffHref(options: {
  handoff: GitWorktreeHandoff
  location: Pick<Location, 'href' | 'pathname' | 'search' | 'hash'>
}): string {
  const { handoff, location } = options
  const currentUrl = new URL(location.href)
  const targetUrl = new URL(handoff.serverUrl)
  const hostedState = getHostedApiBootstrapState({
    search: location.search,
  })

  if (hostedState.hosted) {
    targetUrl.pathname = currentUrl.pathname
    targetUrl.search = currentUrl.search
    targetUrl.hash = currentUrl.hash
    targetUrl.searchParams.set('api', handoff.serverUrl)
    bindAccessGateCredential(targetUrl)
    return targetUrl.toString()
  }

  targetUrl.pathname = currentUrl.pathname
  targetUrl.search = currentUrl.search
  targetUrl.hash = currentUrl.hash
  bindAccessGateCredential(targetUrl)
  return targetUrl.toString()
}

export function navigateToServerHandoff(options: {
  handoff: GitWorktreeHandoff
  location: Pick<Location, 'href' | 'pathname' | 'search' | 'hash'>
}): void {
  window.location.assign(buildServerHandoffHref(options))
}
