/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Render the index-level New Store flow (setup/register) with current authority pinning (7.6).
 * 2. Lifecycle feedback (accepted -> running -> terminal) without inventing success.
 * 3. Project the official setup/register parameter surface with secondary options disclosed on demand.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Owner-reported confusion (2026-07-31): Setup requires Store name, path, and Advanced Options.
 * Spec: hosted-app-distribution › "Product-Shaped Store Index And Detail" (New Store flow).
 *
 * The flow uses the current Environment authority (pinned at submit) and the backend-owned mutation lifecycle.
 * It is a Dialog opened from the Stores index, not a separate route.
 */
import { Dialog } from '@openspecui/web-src/components/dialog'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'

export type NewStoreKind = 'setup' | 'register'

export type NewStoreLifecycleState = 'idle' | 'pending' | 'succeeded' | 'failed'

export type NewStoreSubmitInput =
  | {
      kind: 'setup'
      path: string
      storeId: string
      initGit?: boolean
      remote?: string
    }
  | {
      kind: 'register'
      path: string
      storeId?: string
      confirmIdentity?: boolean
    }

export interface NewStoreDialogProps {
  open: boolean
  onClose: () => void
  /** Whether the current Environment authority is valid for the mutation. */
  hasAuthority: boolean
  /** Lifecycle state of the in-flight mutation. */
  lifecycle: NewStoreLifecycleState
  /** Concrete error from the mutation, if any. */
  error?: string | null
  unavailableReason?: string | null
  /** Submit the New Store mutation. The backend pins the current authority at dispatch. */
  onSubmit: (input: NewStoreSubmitInput) => void
}

export function NewStoreDialog({
  open,
  onClose,
  hasAuthority,
  lifecycle,
  error = null,
  unavailableReason = null,
  onSubmit,
}: NewStoreDialogProps) {
  const [kind, setKind] = useState<NewStoreKind>('setup')
  const [path, setPath] = useState('')
  const [storeId, setStoreId] = useState('')
  const [gitMode, setGitMode] = useState<'default' | 'init' | 'skip'>('default')
  const [remote, setRemote] = useState('')
  const [confirmIdentity, setConfirmIdentity] = useState(false)

  const pending = lifecycle === 'pending'

  const submit = () => {
    const trimmedPath = path.trim()
    const trimmedStoreId = storeId.trim()
    if (!trimmedPath || pending || !hasAuthority || (kind === 'setup' && !trimmedStoreId)) return
    if (kind === 'setup') {
      onSubmit({
        kind,
        path: trimmedPath,
        storeId: trimmedStoreId,
        ...(gitMode === 'default' ? {} : { initGit: gitMode === 'init' }),
        ...(remote.trim() ? { remote: remote.trim() } : {}),
      })
      return
    }
    onSubmit({
      kind,
      path: trimmedPath,
      ...(trimmedStoreId ? { storeId: trimmedStoreId } : {}),
      ...(confirmIdentity ? { confirmIdentity: true } : {}),
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={<span className="text-lg font-semibold">New Store</span>}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="hover:bg-muted rounded-md px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={
              pending ||
              !hasAuthority ||
              path.trim().length === 0 ||
              (kind === 'setup' && storeId.trim().length === 0)
            }
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {kind === 'setup' ? 'Setup' : 'Register'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {!hasAuthority ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
            Store creation is temporarily unavailable.{' '}
            {unavailableReason ??
              'Choose a connected Environment and wait for Store data to finish loading.'}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setKind('register')}
            className={`flex-1 rounded-md border px-3 py-2 text-sm ${
              kind === 'register'
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border text-muted-foreground'
            }`}
          >
            Register existing root
          </button>
          <button
            type="button"
            onClick={() => setKind('setup')}
            className={`flex-1 rounded-md border px-3 py-2 text-sm ${
              kind === 'setup'
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border text-muted-foreground'
            }`}
          >
            Setup new Store
          </button>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="new-store-path" className="text-sm font-medium">
            Directory path
          </label>
          <input
            id="new-store-path"
            type="text"
            value={path}
            disabled={pending}
            onChange={(event) => setPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
            }}
            placeholder="/path/to/store-root"
            className="border-border bg-background focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none disabled:opacity-50"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="new-store-id" className="text-sm font-medium">
            {kind === 'setup' ? 'Store name' : 'Store id (optional)'}
          </label>
          <input
            id="new-store-id"
            type="text"
            value={storeId}
            disabled={pending}
            onChange={(event) => setStoreId(event.target.value)}
            placeholder="accept-ref"
            className="border-border bg-background focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none disabled:opacity-50"
          />
          {kind === 'setup' ? (
            <p className="text-muted-foreground text-xs">
              Passed as the Store id in `openspec store setup &lt;name&gt;`.
            </p>
          ) : null}
        </div>
        <details className="border-border rounded-md border px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">Advanced Options</summary>
          <div className="mt-3 space-y-3">
            {kind === 'setup' ? (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="new-store-git" className="text-sm font-medium">
                    Git initialization
                  </label>
                  <select
                    id="new-store-git"
                    value={gitMode}
                    disabled={pending}
                    onChange={(event) =>
                      setGitMode(event.target.value as 'default' | 'init' | 'skip')
                    }
                    className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="default">OpenSpec default</option>
                    <option value="init">Initialize Git and create the initial commit</option>
                    <option value="skip">Skip all Git actions (--no-init-git)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="new-store-remote" className="text-sm font-medium">
                    Canonical remote URL (optional)
                  </label>
                  <input
                    id="new-store-remote"
                    type="url"
                    value={remote}
                    disabled={pending}
                    onChange={(event) => setRemote(event.target.value)}
                    placeholder="https://github.com/org/store.git"
                    className="border-border bg-background focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none disabled:opacity-50"
                  />
                </div>
              </>
            ) : (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmIdentity}
                  disabled={pending}
                  onChange={(event) => setConfirmIdentity(event.target.checked)}
                />
                Confirm creation of missing Store identity metadata (`--yes`)
              </label>
            )}
          </div>
        </details>
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
        {lifecycle === 'succeeded' ? (
          <p className="text-xs text-emerald-600">Store created successfully.</p>
        ) : null}
      </div>
    </Dialog>
  )
}
