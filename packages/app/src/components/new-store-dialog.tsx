/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Render the index-level New Store flow (setup/register) with current authority pinning (7.6).
 * 2. Lifecycle feedback (accepted -> running -> terminal) without inventing success.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
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

export interface NewStoreDialogProps {
  open: boolean
  onClose: () => void
  /** Whether the current Environment authority is valid for the mutation. */
  hasAuthority: boolean
  /** Lifecycle state of the in-flight mutation. */
  lifecycle: NewStoreLifecycleState
  /** Concrete error from the mutation, if any. */
  error?: string | null
  /** Submit the New Store mutation. The backend pins the current authority at dispatch. */
  onSubmit: (input: { kind: NewStoreKind; path: string; storeId?: string }) => void
}

export function NewStoreDialog({
  open,
  onClose,
  hasAuthority,
  lifecycle,
  error = null,
  onSubmit,
}: NewStoreDialogProps) {
  const [kind, setKind] = useState<NewStoreKind>('register')
  const [path, setPath] = useState('')
  const [storeId, setStoreId] = useState('')

  const pending = lifecycle === 'pending'

  const submit = () => {
    const trimmedPath = path.trim()
    if (!trimmedPath || pending || !hasAuthority) return
    onSubmit({
      kind,
      path: trimmedPath,
      ...(storeId.trim() ? { storeId: storeId.trim() } : {}),
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
            disabled={pending || !hasAuthority || path.trim().length === 0}
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
          <p className="text-xs text-amber-600">
            No current Environment authority. Select an Environment before creating a Store.
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
        {kind === 'register' ? (
          <div className="space-y-1.5">
            <label htmlFor="new-store-id" className="text-sm font-medium">
              Store id (optional)
            </label>
            <input
              id="new-store-id"
              type="text"
              value={storeId}
              disabled={pending}
              onChange={(event) => setStoreId(event.target.value)}
              placeholder="my-store"
              className="border-border bg-background focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none disabled:opacity-50"
            />
          </div>
        ) : null}
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
        {lifecycle === 'succeeded' ? (
          <p className="text-xs text-emerald-600">Store created successfully.</p>
        ) : null}
      </div>
    </Dialog>
  )
}
