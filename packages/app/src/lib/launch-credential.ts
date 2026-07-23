/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Consume an auto-launched Access Gate credential from the URL fragment once.
 * 2. Keep the credential in session memory only (never query params, persisted tabs, or localStorage).
 * 3. Strip the fragment immediately so it is not retained in history or visible state.
 *
 * Original request (2026-07-15): "我们可以在 cli 上新增一个 --auth 或者 --password。"
 * Section 8.12: auto-launch credential fragment is consumed once and credentials never enter query
 * parameters, persisted tabs, or localStorage.
 *
 * Invariants (AGENTS.md):
 *  - Credentials are held in session memory (sessionStorage, scoped to the tab session, cleared on close)
 *    — never in the URL query, persisted tab entries, or localStorage.
 *  - The fragment is removed from the URL immediately after consumption.
 */

/** sessionStorage key for the in-session Access Gate credential. */
export const LAUNCH_CREDENTIAL_SESSION_KEY = 'openspecui-app:launch-credential'

/** Query param name carried in the URL fragment (never in the query string). */
const CREDENTIAL_FRAGMENT_PARAM = 'credential'

function isStorageAvailable(storage: Storage | undefined | null): storage is Storage {
  return typeof storage !== 'undefined' && storage !== null
}

/**
 * Read and consume the auto-launched credential from the URL fragment. When present, it is stored in
 * session memory and the fragment is stripped from the URL via the provided history hook. Returns the
 * credential (or null), and never throws on storage/history absence.
 */
export function consumeLaunchCredential(options: {
  hash?: string
  replaceState?: (url: string) => void
  sessionStorage?: Storage | null
}): string | null {
  const hash = options.hash ?? (typeof window !== 'undefined' ? window.location.hash : '')
  if (!hash || !hash.startsWith('#')) return null
  const params = new URLSearchParams(hash.slice(1))
  const credential = params.get(CREDENTIAL_FRAGMENT_PARAM)
  if (!credential) return null

  const storage =
    options.sessionStorage ?? (typeof window !== 'undefined' ? window.sessionStorage : null)
  if (isStorageAvailable(storage)) {
    storage.setItem(LAUNCH_CREDENTIAL_SESSION_KEY, credential)
  }

  const replaceState =
    options.replaceState ??
    ((url: string) => {
      if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState({}, '', url)
      }
    })
  // Remove the credential fragment entirely so it does not persist in history or session restorations.
  const url = new URL(
    typeof window !== 'undefined' ? window.location.href : `http://localhost${hash}`
  )
  url.hash = ''
  // Drop only the credential param if other fragment params exist; otherwise clear the whole hash.
  params.delete(CREDENTIAL_FRAGMENT_PARAM)
  const remaining = params.toString()
  url.hash = remaining ? `#${remaining}` : ''
  replaceState(url.pathname + url.search + url.hash)
  return credential
}

/** Read the in-session Access Gate credential without consuming it. Returns null when absent. */
export function readLaunchCredential(
  storage: Storage | null | undefined = typeof window !== 'undefined' ? window.sessionStorage : null
): string | null {
  if (!isStorageAvailable(storage)) return null
  return storage.getItem(LAUNCH_CREDENTIAL_SESSION_KEY)
}

/** Clear the in-session credential (e.g. on explicit disconnect). */
export function clearLaunchCredential(
  storage: Storage | null | undefined = typeof window !== 'undefined' ? window.sessionStorage : null
): void {
  if (!isStorageAvailable(storage)) return
  storage.removeItem(LAUNCH_CREDENTIAL_SESSION_KEY)
}
